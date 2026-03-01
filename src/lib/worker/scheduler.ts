import db, { generateId } from "../db";
import { logDebug } from "./logger";

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
