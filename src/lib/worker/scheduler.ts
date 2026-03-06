import db, { generateId } from "../db";
import { logDebug } from "./logger";
import { getThumbnailAbsolutePath } from "../thumbnail-store";

// ---------------------------------------------------------------------------
// Scheduler loop — creates periodic sync jobs
// ---------------------------------------------------------------------------

export async function runSchedulerLoop() {
    logDebug("[Worker] Scheduler loop started");
    while (true) {
        try {
            // Find users for Reddit sync (URL now comes from env, not per-user DB)
            const redditUsers = process.env.REDDIT_RSS_URL
                ? (db.prepare(`
                    SELECT id FROM users 
                    WHERE reddit_sync_enabled = 1
                    AND (
                        last_reddit_sync_at IS NULL 
                        OR last_reddit_sync_at < datetime('now', '-1 hour')
                    )
                `).all() as { id: string }[])
                : [];

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

            // Find users for GitHub sync (token now comes from env, not per-user DB)
            const githubUsers = process.env.GITHUB_TOKEN
                ? (db.prepare(`
                    SELECT id FROM users 
                    WHERE github_sync_enabled = 1
                    AND (
                        last_github_sync_at IS NULL 
                        OR last_github_sync_at < datetime('now', '-1 hour')
                    )
                `).all() as { id: string }[])
                : [];

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

            // Find users due for a link health check
            const linkCheckUsers = db.prepare(`
                SELECT id, link_check_interval, link_check_interval_days
                FROM users
                WHERE link_check_enabled = 1
                AND (
                    last_link_check_at IS NULL
                    OR (
                        link_check_interval = 'weekly'
                        AND last_link_check_at < datetime('now', '-7 days')
                    )
                    OR (
                        link_check_interval = 'monthly'
                        AND last_link_check_at < datetime('now', '-30 days')
                    )
                    OR (
                        link_check_interval = 'custom'
                        AND last_link_check_at < datetime('now', '-' || link_check_interval_days || ' days')
                    )
                )
            `).all() as { id: string; link_check_interval: string; link_check_interval_days: number }[];

            for (const user of linkCheckUsers) {
                const userId = user.id;
                const existingJob = db.prepare(`
                    SELECT id FROM jobs
                    WHERE user_id = ?
                    AND type = 'check_broken_links'
                    AND status IN ('pending', 'processing')
                `).get(userId);

                if (!existingJob) {
                    logDebug(`[Worker] Scheduling automatic link health check for user ${userId}`);
                    const id = generateId();
                    db.prepare(`
                        INSERT INTO jobs (id, type, payload, status, user_id)
                        VALUES (?, 'check_broken_links', ?, 'pending', ?)
                    `).run(id, JSON.stringify({}), userId);
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
// Maintenance scan loop — counts missing thumbnails / embeddings every 30 min
// ---------------------------------------------------------------------------

export async function runMaintenanceScanLoop() {
    logDebug("[Worker] Maintenance scan loop started");
    while (true) {
        try {
            const users = db.prepare("SELECT id FROM users").all() as { id: string }[];
            for (const user of users) {
                // Count bookmarks with no thumbnail value at all
                const { count: nullThumbnails } = db.prepare(`
                    SELECT COUNT(*) as count FROM bookmarks
                    WHERE user_id = ? AND (thumbnail IS NULL OR thumbnail = '')
                `).get(user.id) as { count: number };

                // Also count bookmarks whose thumbnail file is missing from disk
                const fileRefs = db.prepare(`
                    SELECT thumbnail FROM bookmarks
                    WHERE user_id = ? AND thumbnail IS NOT NULL AND thumbnail != '' AND thumbnail LIKE 'thumbnails/%'
                `).all(user.id) as { thumbnail: string }[];

                let orphanedFiles = 0;
                for (const row of fileRefs) {
                    if (!getThumbnailAbsolutePath(row.thumbnail)) {
                        orphanedFiles++;
                    }
                }

                const missingThumbnails = nullThumbnails + orphanedFiles;

                const { count: missingEmbeddings } = db.prepare(`
                    SELECT COUNT(*) as count FROM bookmarks b
                    LEFT JOIN vec_bookmarks v ON b.rowid = v.rowid
                    WHERE b.user_id = ? AND IFNULL(b.is_nsfw, 0) = 0 AND v.rowid IS NULL
                    AND b.created_at < datetime('now', '-15 minutes')
                `).get(user.id) as { count: number };

                db.prepare(`
                    INSERT INTO maintenance_stats (user_id, missing_thumbnails, missing_embeddings, scanned_at)
                    VALUES (?, ?, ?, datetime('now'))
                    ON CONFLICT(user_id) DO UPDATE SET
                        missing_thumbnails = excluded.missing_thumbnails,
                        missing_embeddings = excluded.missing_embeddings,
                        scanned_at = excluded.scanned_at
                `).run(user.id, missingThumbnails, missingEmbeddings);

                logDebug(`[Worker] Maintenance scan: user=${user.id} missing_thumbs=${missingThumbnails} (null=${nullThumbnails}, orphaned=${orphanedFiles}) missing_embeds=${missingEmbeddings}`);
            }
        } catch (e) {
            logDebug("[Worker] Error in maintenance scan loop: " + e);
        }

        // Wait 30 minutes before scanning again
        await new Promise(resolve => setTimeout(resolve, 30 * 60 * 1000));
    }
}

