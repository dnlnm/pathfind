import db, { generateId } from "../../db";
import { logDebug } from "../logger";
import Parser from "rss-parser";

const parser = new Parser();

export async function handleRedditRssSync(job: any, payload: any) {
    const { userId } = payload;
    const rssUrl = process.env.REDDIT_RSS_URL;

    if (!rssUrl) {
        throw new Error("REDDIT_RSS_URL is not configured in .env");
    }

    logDebug(`[Worker] Syncing Reddit feed for user ${userId} from env URL`);

    const response = await fetch(rssUrl, {
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

    let items: { link: string; title: string; description: string | null; isNsfw?: boolean }[] = [];

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
                        description: post.selftext || post.public_description || null,
                        isNsfw: !!post.over_18
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
        INSERT INTO bookmarks (id, url, title, description, is_nsfw, user_id)
        VALUES (?, ?, ?, ?, ?, ?)
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
                item.isNsfw ? 1 : 0,
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
