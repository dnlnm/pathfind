import db, { generateId } from "./db";
import { fetchUrlMetadata } from "./metadata-fetcher";
import { generateEmbedding } from "./gemini";
import Parser from "rss-parser";
import fs from "fs";

let isWorkerRunning = false;
const parser = new Parser();

function logDebug(msg: string) {
    const time = new Date().toISOString();
    const formatted = `[${time}] ${msg}\n`;
    console.log(msg);
    fs.appendFileSync("worker-debug.log", formatted);
}

// ---------------------------------------------------------------------------
// Worker entrypoint — launches parallel "lanes" so different job types
// can run simultaneously without blocking each other.
// ---------------------------------------------------------------------------

export async function startWorker() {
    if (isWorkerRunning) return;
    isWorkerRunning = true;
    logDebug("[Worker] Background worker started");

    // Parallel lanes — each one processes its own job types independently
    runWorkerLane("fast", ["metadata_fetch"]);
    runWorkerLane("sync", ["reddit_rss_sync", "github_starred_sync"]);
    runWorkerLane("bulk", ["backfill_thumbnails", "backfill_embeddings"]);
    runSchedulerLoop();
}

// ---------------------------------------------------------------------------
// Lane runner — polls for jobs of the given types
// ---------------------------------------------------------------------------

async function runWorkerLane(laneName: string, types: string[]) {
    logDebug(`[Worker] Lane "${laneName}" started for types: ${types.join(", ")}`);
    const placeholders = types.map(() => "?").join(", ");

    while (true) {
        try {
            const processed = await processNextJobForLane(laneName, types, placeholders);
            if (!processed) {
                await new Promise(resolve => setTimeout(resolve, 3000));
            } else {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } catch (e) {
            logDebug(`[Worker] Lane "${laneName}" error: ` + e);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

async function processNextJobForLane(laneName: string, types: string[], placeholders: string): Promise<boolean> {
    const job = db.prepare(`
        SELECT * FROM jobs 
        WHERE type IN (${placeholders})
        AND (status = 'pending' OR (status = 'failed' AND attempts < 3))
        AND (available_at IS NULL OR available_at <= datetime('now'))
        ORDER BY created_at ASC 
        LIMIT 1
    `).get(...types) as any;

    if (!job) return false;

    db.prepare("UPDATE jobs SET status = 'processing', updated_at = datetime('now') WHERE id = ?").run(job.id);

    try {
        const payload = JSON.parse(job.payload);

        switch (job.type) {
            case 'metadata_fetch':
                await handleMetadataFetch(job, payload);
                break;
            case 'reddit_rss_sync':
                await handleRedditRssSync(job, payload);
                break;
            case 'github_starred_sync':
                await handleGithubStarredSync(job, payload);
                break;
            case 'backfill_thumbnails':
                await handleBackfillThumbnails(job, payload);
                break;
            case 'backfill_embeddings':
                await handleBackfillEmbeddings(job, payload);
                break;
            default:
                logDebug(`[Worker] Unknown job type: ${job.type}`);
        }

        db.prepare("UPDATE jobs SET status = 'completed', progress = 100, updated_at = datetime('now') WHERE id = ?").run(job.id);
        return true;
    } catch (e: any) {
        logDebug(`[Worker] Job ${job.id} failed: ` + e);
        const attempt = (job.attempts || 0) + 1;
        // Exponential backoff: attempt^2 * 5 minutes
        const backoffMinutes = attempt * attempt * 5;
        db.prepare(`
            UPDATE jobs 
            SET status = 'failed', 
                attempts = ?, 
                error = ?, 
                available_at = datetime('now', '+${backoffMinutes} minutes'),
                updated_at = datetime('now') 
            WHERE id = ?
        `).run(attempt, e.message || String(e), job.id);
        return true;
    }
}

// ---------------------------------------------------------------------------
// Helper: check if a bulk job has been cancelled between iterations
// ---------------------------------------------------------------------------

function isJobCancelled(jobId: string): boolean {
    const row = db.prepare("SELECT status FROM jobs WHERE id = ?").get(jobId) as { status: string } | undefined;
    return !row || row.status === 'cancelled';
}

// ---------------------------------------------------------------------------
// Scheduler loop — creates periodic sync jobs
// ---------------------------------------------------------------------------

async function runSchedulerLoop() {
    logDebug("[Worker] Scheduler loop started");
    while (true) {
        try {
            // Find users for Reddit sync
            const redditUsers = db.prepare(`
                SELECT id FROM users 
                WHERE reddit_rss_url IS NOT NULL 
                AND reddit_sync_enabled = 1
                AND (
                    last_reddit_sync_at IS NULL 
                    OR last_reddit_sync_at < datetime('now', '-1 hour')
                )
            `).all() as { id: string }[];

            for (const user of redditUsers) {
                const userId = user.id;
                const existingJob = db.prepare(`
                    SELECT id FROM jobs 
                    WHERE user_id = ? 
                    AND type = 'reddit_rss_sync' 
                    AND status IN ('pending', 'processing')
                `).get(userId);

                if (!existingJob) {
                    logDebug(`[Worker] Scheduling automatic Reddit sync for user ${userId}`);
                    const id = generateId();
                    db.prepare(`
                        INSERT INTO jobs (id, type, payload, status, user_id)
                        VALUES (?, 'reddit_rss_sync', ?, 'pending', ?)
                    `).run(id, JSON.stringify({ userId }), userId);
                }
            }

            // Find users for GitHub sync
            const githubUsers = db.prepare(`
                SELECT id FROM users 
                WHERE github_token IS NOT NULL 
                AND github_sync_enabled = 1
                AND (
                    last_github_sync_at IS NULL 
                    OR last_github_sync_at < datetime('now', '-1 hour')
                )
            `).all() as { id: string }[];

            for (const user of githubUsers) {
                const userId = user.id;
                const existingJob = db.prepare(`
                    SELECT id FROM jobs 
                    WHERE user_id = ? 
                    AND type = 'github_starred_sync' 
                    AND status IN ('pending', 'processing')
                `).get(userId);

                if (!existingJob) {
                    logDebug(`[Worker] Scheduling automatic GitHub sync for user ${userId}`);
                    const id = generateId();
                    db.prepare(`
                        INSERT INTO jobs (id, type, payload, status, user_id)
                        VALUES (?, 'github_starred_sync', ?, 'pending', ?)
                    `).run(id, JSON.stringify({ userId }), userId);
                }
            }
        } catch (e) {
            logDebug("[Worker] Error in scheduler loop: " + e);
        }

        // Wait 5 minutes before checking again
        await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
    }
}

// ---------------------------------------------------------------------------
// Job Handlers
// ---------------------------------------------------------------------------

async function handleMetadataFetch(job: any, payload: any) {
    const { bookmarkId } = payload;
    const bookmark = db.prepare("SELECT * FROM bookmarks WHERE id = ?").get(bookmarkId) as any;

    if (!bookmark) {
        console.warn(`[Worker] Bookmark ${bookmarkId} not found, skipping job.`);
        return;
    }

    console.log(`[Worker] Fetching metadata for: ${bookmark.url}`);
    const metadata = await fetchUrlMetadata(bookmark.url);

    db.prepare(`
        UPDATE bookmarks 
        SET 
            title = CASE WHEN title IS NULL OR title = '' THEN ? ELSE title END,
            description = CASE WHEN description IS NULL OR description = '' THEN ? ELSE description END,
            favicon = CASE WHEN favicon IS NULL OR favicon = '' THEN ? ELSE favicon END,
            thumbnail = CASE WHEN thumbnail IS NULL OR thumbnail = '' THEN ? ELSE thumbnail END,
            updated_at = datetime('now')
        WHERE id = ?
    `).run(
        metadata.title || '',
        metadata.description || '',
        metadata.favicon || '',
        metadata.thumbnail || '',
        bookmarkId
    );

    // After updating metadata, generate vector embedding for semantic search
    try {
        const updatedRow = db.prepare("SELECT rowid, title, description, notes FROM bookmarks WHERE id = ?").get(bookmarkId) as { rowid: number, title: string | null, description: string | null, notes: string | null };
        if (updatedRow) {
            const textToEmbed = `${updatedRow.title || ''} ${updatedRow.description || ''} ${updatedRow.notes || ''}`.trim();
            if (textToEmbed) {
                const embedding = await generateEmbedding(textToEmbed);
                if (embedding) {
                    const f32arr = new Float32Array(embedding);
                    db.prepare("INSERT OR REPLACE INTO vec_bookmarks(rowid, embedding) VALUES (?, ?)").run(BigInt(updatedRow.rowid), f32arr);
                    logDebug(`[Worker] Generated embedding for bookmark ${bookmarkId}`);
                }
            }
        }
    } catch (e) {
        logDebug(`[Worker] Background embedding failed for ${bookmarkId}: ` + e);
        console.error("Background embedding failed:", e);
    }
}

// ---------------------------------------------------------------------------
// Fetch Thumbnails — fetches thumbnails for bookmarks
// payload.overwrite = true  → re-fetch for ALL bookmarks
// payload.overwrite = false → only bookmarks missing a thumbnail (default)
// ---------------------------------------------------------------------------

async function handleBackfillThumbnails(job: any, payload: any) {
    const userId = job.user_id;
    const overwrite = payload.overwrite === true;

    const bookmarks = overwrite
        ? (db.prepare(`
            SELECT id, url, title FROM bookmarks
            WHERE user_id = ?
            ORDER BY created_at ASC
          `).all(userId) as { id: string; url: string; title: string | null }[])
        : (db.prepare(`
            SELECT id, url, title FROM bookmarks
            WHERE user_id = ?
            AND (thumbnail IS NULL OR thumbnail = '')
            ORDER BY created_at ASC
          `).all(userId) as { id: string; url: string; title: string | null }[]);

    const total = bookmarks.length;
    logDebug(`[Worker] Fetch thumbnails (overwrite=${overwrite}): ${total} bookmarks for user ${userId}`);

    if (total === 0) return;

    db.prepare("UPDATE jobs SET payload = ?, updated_at = datetime('now') WHERE id = ?")
        .run(JSON.stringify({ ...payload, total, processed: 0 }), job.id);

    for (let i = 0; i < bookmarks.length; i++) {
        if (isJobCancelled(job.id)) {
            logDebug(`[Worker] Fetch thumbnails job ${job.id} cancelled at ${i}/${total}`);
            return;
        }

        const bm = bookmarks[i];
        try {
            const metadata = await fetchUrlMetadata(bm.url);
            if (metadata.thumbnail) {
                if (overwrite) {
                    db.prepare(`
                        UPDATE bookmarks SET
                            thumbnail = ?,
                            favicon = CASE WHEN favicon IS NULL OR favicon = '' THEN ? ELSE favicon END,
                            updated_at = datetime('now')
                        WHERE id = ?
                    `).run(metadata.thumbnail, metadata.favicon || '', bm.id);
                } else {
                    db.prepare(`
                        UPDATE bookmarks SET
                            thumbnail = ?,
                            favicon = CASE WHEN favicon IS NULL OR favicon = '' THEN ? ELSE favicon END,
                            updated_at = datetime('now')
                        WHERE id = ? AND (thumbnail IS NULL OR thumbnail = '')
                    `).run(metadata.thumbnail, metadata.favicon || '', bm.id);
                }
            }
        } catch (e) {
            logDebug(`[Worker] Fetch thumbnail failed for ${bm.id}: ` + e);
        }

        const progress = Math.round(((i + 1) / total) * 100);
        db.prepare("UPDATE jobs SET progress = ?, payload = ?, updated_at = datetime('now') WHERE id = ?")
            .run(progress, JSON.stringify({ ...payload, total, processed: i + 1 }), job.id);

        await new Promise(resolve => setTimeout(resolve, 300));
    }

    logDebug(`[Worker] Fetch thumbnails complete: ${total} processed`);
}



// ---------------------------------------------------------------------------
// Backfill Embeddings — generates embeddings for bookmarks missing them
// ---------------------------------------------------------------------------

async function handleBackfillEmbeddings(job: any, payload: any) {
    const userId = job.user_id;

    const bookmarks = db.prepare(`
        SELECT b.rowid, b.id, b.title, b.description, b.notes
        FROM bookmarks b
        LEFT JOIN vec_bookmarks v ON b.rowid = v.rowid
        WHERE b.user_id = ? AND v.rowid IS NULL
    `).all(userId) as { rowid: number; id: string; title: string | null; description: string | null; notes: string | null }[];

    const total = bookmarks.length;
    logDebug(`[Worker] Backfill embeddings: ${total} bookmarks to process for user ${userId}`);

    if (total === 0) return;

    db.prepare("UPDATE jobs SET payload = ?, updated_at = datetime('now') WHERE id = ?")
        .run(JSON.stringify({ ...payload, total, processed: 0 }), job.id);

    for (let i = 0; i < bookmarks.length; i++) {
        if (isJobCancelled(job.id)) {
            logDebug(`[Worker] Backfill embeddings job ${job.id} was cancelled at ${i}/${total}`);
            return;
        }

        const item = bookmarks[i];
        try {
            const textToEmbed = `${item.title || ''} ${item.description || ''} ${item.notes || ''}`.trim();
            if (textToEmbed) {
                const embedding = await generateEmbedding(textToEmbed);
                if (embedding) {
                    const f32arr = new Float32Array(embedding);
                    db.prepare("INSERT OR REPLACE INTO vec_bookmarks(rowid, embedding) VALUES (?, ?)").run(BigInt(item.rowid), f32arr);
                }
            }
        } catch (e) {
            logDebug(`[Worker] Backfill embedding failed for ${item.id}: ` + e);
        }

        const progress = Math.round(((i + 1) / total) * 100);
        db.prepare("UPDATE jobs SET progress = ?, payload = ?, updated_at = datetime('now') WHERE id = ?")
            .run(progress, JSON.stringify({ ...payload, total, processed: i + 1 }), job.id);

        // Rate limit to avoid Gemini API throttling
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    logDebug(`[Worker] Backfill embeddings complete: ${total} bookmarks processed`);
}

// ---------------------------------------------------------------------------
// Reddit RSS Sync
// ---------------------------------------------------------------------------

async function handleRedditRssSync(job: any, payload: any) {
    const { userId } = payload;
    const user = db.prepare("SELECT reddit_rss_url FROM users WHERE id = ?").get(userId) as { reddit_rss_url: string | null };

    if (!user?.reddit_rss_url) {
        throw new Error("Reddit RSS URL not configured");
    }

    logDebug(`[Worker] Syncing Reddit feed for user ${userId} from: ${user.reddit_rss_url}`);

    const response = await fetch(user.reddit_rss_url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json, application/rss+xml, application/xml, text/xml"
        }
    });

    logDebug(`[Worker] Reddit response status: ${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    logDebug(`[Worker] Content-Type: ${contentType}`);

    if (!response.ok) {
        throw new Error(`Failed to fetch Reddit feed: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    logDebug(`[Worker] Body length: ${text.length}`);
    logDebug(`[Worker] Body starts with: ${text.substring(0, 50).replace(/\n/g, " ")}`);

    let items: { link: string; title: string; description: string | null }[] = [];

    if (contentType.includes("application/json") || text.trim().startsWith("{")) {
        logDebug("[Worker] Detected Reddit JSON format");
        try {
            const data = JSON.parse(text);
            if (data.kind === "Listing" && data.data?.children) {
                logDebug(`[Worker] Found ${data.data.children.length} children in JSON`);
                items = data.data.children.map((child: any) => {
                    const post = child.data;

                    let link = post.url;
                    if (post.permalink) {
                        link = `https://www.reddit.com${post.permalink}`;
                    }

                    if (link && link.startsWith("/")) {
                        link = `https://www.reddit.com${link}`;
                    }

                    return {
                        link: link,
                        title: post.title || "Reddit Post",
                        description: post.selftext || post.public_description || null
                    };
                });
            } else {
                logDebug(`[Worker] JSON structure mismatch: kind=${data.kind}, hasChildren=${!!data.data?.children}`);
            }
        } catch (e) {
            logDebug("[Worker] Failed to parse Reddit JSON: " + e);
            throw new Error("Failed to parse Reddit JSON structure");
        }
    } else {
        logDebug("[Worker] Detected XML/RSS format");
        try {
            const feed = await parser.parseString(text);
            items = (feed.items || []).map(item => ({
                link: item.link || "",
                title: item.title || "Reddit Post",
                description: item.contentSnippet || item.content || null
            }));
            logDebug(`[Worker] Found ${items.length} items from RSS`);
        } catch (e) {
            logDebug("[Worker] Failed to parse Reddit RSS XML: " + e);
            throw new Error("Failed to parse Reddit RSS XML");
        }
    }

    logDebug(`[Worker] Total items extracted: ${items.length}`);
    if (items.length > 0) {
        logDebug(`[Worker] First item target link: ${items[0].link}`);
    }

    if (items.length === 0) return;

    // Ensure "Reddit" collection
    let redditCollectionId;
    const existingCollection = db.prepare("SELECT id FROM collections WHERE name = ? COLLATE NOCASE AND user_id = ?").get("Reddit", userId) as { id: string } | undefined;
    if (existingCollection) {
        redditCollectionId = existingCollection.id;
    } else {
        redditCollectionId = generateId();
        db.prepare("INSERT INTO collections (id, name, user_id) VALUES (?, ?, ?)").run(redditCollectionId, "Reddit", userId);
    }
    const linkCollection = db.prepare("INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)");

    const insertTag = db.prepare("INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)");
    const getTag = db.prepare("SELECT id FROM tags WHERE name = ?");

    const insertBookmark = db.prepare(`
        INSERT INTO bookmarks (id, url, title, description, user_id)
        VALUES (?, ?, ?, ?, ?)
    `);
    const linkTag = db.prepare("INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)");
    const checkExisting = db.prepare("SELECT id FROM bookmarks WHERE url = ? AND user_id = ?");

    let syncedCount = 0;

    const syncTransaction = db.transaction(() => {
        for (const item of items) {
            if (!item.link) continue;

            const existing = checkExisting.get(item.link, userId);
            if (existing) continue;

            const bmId = generateId();
            insertBookmark.run(
                bmId,
                item.link,
                item.title,
                item.description,
                userId
            );

            linkCollection.run(bmId, redditCollectionId);

            const redditMatch = item.link.match(/reddit\.com\/r\/([a-zA-Z0-9_]+)/i);
            if (redditMatch) {
                const subreddit = `r/${redditMatch[1]}`.toLowerCase();
                insertTag.run(generateId(), subreddit);
                const subTagRow = getTag.get(subreddit) as { id: string };
                linkTag.run(bmId, subTagRow.id);
            }

            // Queue a metadata fetch job
            const metadataJobId = generateId();
            db.prepare(`
                INSERT INTO jobs (id, type, payload, status, user_id)
                VALUES (?, 'metadata_fetch', ?, 'pending', ?)
            `).run(metadataJobId, JSON.stringify({ bookmarkId: bmId }), userId);

            syncedCount++;
        }
    });

    syncTransaction();

    db.prepare("UPDATE users SET last_reddit_sync_at = datetime('now') WHERE id = ?").run(userId);

    logDebug(`[Worker] Synced ${syncedCount} new items from Reddit for user ${userId}`);
}

// ---------------------------------------------------------------------------
// GitHub Starred Sync
// ---------------------------------------------------------------------------

async function handleGithubStarredSync(job: any, payload: any) {
    const { userId } = payload;
    const user = db.prepare("SELECT github_token FROM users WHERE id = ?").get(userId) as { github_token: string | null };

    if (!user?.github_token) {
        throw new Error("GitHub token not configured");
    }

    logDebug(`[Worker] Syncing GitHub stars for user ${userId}`);

    const response = await fetch("https://api.github.com/user/starred", {
        headers: {
            Authorization: `token ${user.github_token}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "PathFind-App",
        },
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`GitHub API error: ${response.status} ${err}`);
    }

    const stars = await response.json();
    let syncedCount = 0;

    const githubTagId = generateId();
    db.prepare("INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)").run(githubTagId, "github");
    const tagRow = db.prepare("SELECT id FROM tags WHERE name = ?").get("github") as { id: string };

    const insertBookmark = db.prepare(`
        INSERT INTO bookmarks (id, url, title, description, user_id)
        VALUES (?, ?, ?, ?, ?)
    `);
    const linkTag = db.prepare("INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)");
    const checkExisting = db.prepare("SELECT id FROM bookmarks WHERE url = ? AND user_id = ?");

    const syncTransaction = db.transaction(() => {
        for (const repo of stars) {
            const existing = checkExisting.get(repo.html_url, userId);
            if (existing) continue;

            const bmId = generateId();
            insertBookmark.run(
                bmId,
                repo.html_url,
                repo.full_name,
                repo.description || null,
                userId
            );

            linkTag.run(bmId, tagRow.id);

            const metadataJobId = generateId();
            db.prepare(`
                INSERT INTO jobs (id, type, payload, status, user_id)
                VALUES (?, 'metadata_fetch', ?, 'pending', ?)
            `).run(metadataJobId, JSON.stringify({ bookmarkId: bmId }), userId);

            syncedCount++;
        }
    });

    syncTransaction();

    db.prepare("UPDATE users SET last_github_sync_at = datetime('now') WHERE id = ?").run(userId);

    logDebug(`[Worker] Synced ${syncedCount} new GitHub stars for user ${userId}`);
}
