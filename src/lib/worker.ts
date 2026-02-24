import db, { generateId } from "./db";
import { fetchUrlMetadata } from "./metadata-fetcher";
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

export async function startWorker() {
    if (isWorkerRunning) return;
    isWorkerRunning = true;
    logDebug("[Worker] Background worker started");

    // Continuous loops
    runWorkerLoop();
    runSchedulerLoop();
}

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

async function runWorkerLoop() {
    while (true) {
        try {
            const processed = await processNextJob();
            // If we processed something, keep going immediately.
            // If not, wait a bit longer.
            if (!processed) {
                await new Promise(resolve => setTimeout(resolve, 3000));
            } else {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } catch (e) {
            logDebug("[Worker] Error in loop: " + e);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

async function processNextJob(): Promise<boolean> {
    // Find next pending job or failed job that hasn't reached max attempts
    const job = db.prepare(`
        SELECT * FROM jobs 
        WHERE status = 'pending' 
        OR (status = 'failed' AND attempts < 3)
        ORDER BY created_at ASC 
        LIMIT 1
    `).get() as any;

    if (!job) return false;

    // Mark as processing immediately to avoid multiple workers picking it up
    db.prepare("UPDATE jobs SET status = 'processing', updated_at = datetime('now') WHERE id = ?").run(job.id);

    try {
        const payload = JSON.parse(job.payload);

        if (job.type === 'metadata_fetch') {
            await handleMetadataFetch(job, payload);
        } else if (job.type === 'reddit_rss_sync') {
            await handleRedditRssSync(job, payload);
        } else if (job.type === 'github_starred_sync') {
            await handleGithubStarredSync(job, payload);
        } else if (job.type === 'ai_tagging') {
            // AI tagging logic would go here later
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        db.prepare("UPDATE jobs SET status = 'completed', progress = 100, updated_at = datetime('now') WHERE id = ?").run(job.id);
        return true;
    } catch (e: any) {
        logDebug(`[Worker] Job ${job.id} failed: ` + e);
        db.prepare(`
            UPDATE jobs 
            SET status = 'failed', 
                attempts = attempts + 1, 
                error = ?, 
                updated_at = datetime('now') 
            WHERE id = ?
        `).run(e.message || String(e), job.id);
        return true;
    }
}

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

                    // The user wants to ALWAYS use the permalink (link to reddit thread)
                    // even if it links to an external site.
                    let link = post.url;
                    if (post.permalink) {
                        link = `https://www.reddit.com${post.permalink}`;
                    }

                    // Final cleanup: ensure it's absolute
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

    // Ensure "reddit" tag exists
    const redditTagId = generateId();
    db.prepare("INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)").run(redditTagId, "reddit");
    const tagRow = db.prepare("SELECT id FROM tags WHERE name = ?").get("reddit") as { id: string };

    const insertTag = db.prepare("INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)");
    const getTag = db.prepare("SELECT id FROM tags WHERE name = ?");

    const insertBookmark = db.prepare(`
        INSERT INTO bookmarks (id, url, title, description, user_id)
        VALUES (?, ?, ?, ?, ?)
    `);
    const linkTag = db.prepare("INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)");
    const checkExisting = db.prepare("SELECT id FROM bookmarks WHERE url = ? AND user_id = ?");

    let syncedCount = 0;

    // Use a transaction for bulk insert
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

            linkTag.run(bmId, tagRow.id);
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

    // Update the last sync time for the user
    db.prepare("UPDATE users SET last_reddit_sync_at = datetime('now') WHERE id = ?").run(userId);

    logDebug(`[Worker] Synced ${syncedCount} new items from Reddit for user ${userId}`);
}

async function handleMetadataFetch(job: any, payload: any) {
    const { bookmarkId } = payload;
    const bookmark = db.prepare("SELECT * FROM bookmarks WHERE id = ?").get(bookmarkId) as any;

    if (!bookmark) {
        console.warn(`[Worker] Bookmark ${bookmarkId} not found, skipping job.`);
        return;
    }

    console.log(`[Worker] Fetching metadata for: ${bookmark.url}`);
    const metadata = await fetchUrlMetadata(bookmark.url);

    // Update bookmark with fetched metadata, but only for fields that are currently null/empty
    // We use COALESCE and check for empty strings
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
}

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

    // Ensure "github" tag exists
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

    // Update the last sync time
    db.prepare("UPDATE users SET last_github_sync_at = datetime('now') WHERE id = ?").run(userId);

    logDebug(`[Worker] Synced ${syncedCount} new GitHub stars for user ${userId}`);
}
