import db, { generateId } from "../../db";
import { logDebug } from "../logger";

export async function handleGithubStarredSync(job: any, payload: any) {
    const { userId } = payload;
    const githubToken = process.env.GITHUB_TOKEN;

    if (!githubToken) {
        throw new Error("GITHUB_TOKEN is not configured in .env");
    }

    logDebug(`[Worker] Syncing GitHub stars for user ${userId}`);

    const response = await fetch("https://api.github.com/user/starred", {
        headers: {
            Authorization: `token ${githubToken}`,
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
