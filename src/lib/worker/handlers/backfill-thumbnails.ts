import db from "../../db";
import { fetchUrlMetadata } from "../../metadata-fetcher";
import { logDebug, isJobCancelled } from "../logger";
import { initJobProgress, updateJobProgress } from "../progress";

export async function handleBackfillThumbnails(job: any, payload: any) {
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

    initJobProgress(job.id, total, payload);

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

        updateJobProgress(job.id, i + 1, total, payload);

        await new Promise(resolve => setTimeout(resolve, 300));
    }

    logDebug(`[Worker] Fetch thumbnails complete: ${total} processed`);
}
