import db, { upsertDomainFavicon } from "../../db";
import { fetchUrlMetadata } from "../../metadata-fetcher";
import { saveThumbnailFromUrl, getThumbnailAbsolutePath } from "../../thumbnail-store";
import { logDebug, isJobCancelled } from "../logger";
import { initJobProgress, updateJobProgress } from "../progress";

export async function handleBackfillThumbnails(job: any, payload: any) {
    const userId = job.user_id;
    const overwrite = payload.overwrite === true;

    let bookmarks: { id: string; url: string; title: string | null }[];

    if (overwrite) {
        bookmarks = db.prepare(`
            SELECT id, url, title FROM bookmarks
            WHERE user_id = ?
            ORDER BY created_at ASC
        `).all(userId) as { id: string; url: string; title: string | null }[];
    } else {
        // Get bookmarks with no thumbnail value at all
        const nullRows = db.prepare(`
            SELECT id, url, title FROM bookmarks
            WHERE user_id = ?
            AND (thumbnail IS NULL OR thumbnail = '')
            ORDER BY created_at ASC
        `).all(userId) as { id: string; url: string; title: string | null }[];

        // Also get bookmarks whose thumbnail file is missing from disk
        const fileRefRows = db.prepare(`
            SELECT id, url, title, thumbnail FROM bookmarks
            WHERE user_id = ?
            AND thumbnail IS NOT NULL AND thumbnail != '' AND thumbnail LIKE 'thumbnails/%'
            ORDER BY created_at ASC
        `).all(userId) as { id: string; url: string; title: string | null; thumbnail: string }[];

        const orphanedRows = fileRefRows.filter(row => !getThumbnailAbsolutePath(row.thumbnail));

        // Merge both sets, dedup by id
        const seen = new Set(nullRows.map(r => r.id));
        bookmarks = [...nullRows];
        for (const row of orphanedRows) {
            if (!seen.has(row.id)) {
                bookmarks.push({ id: row.id, url: row.url, title: row.title });
            }
        }
    }

    const total = bookmarks.length;
    logDebug(`[Worker] Fetch thumbnails (overwrite=${overwrite}): ${total} bookmarks for user ${userId}`);

    if (total === 0) return;

    initJobProgress(job.id, total, payload);

    for (let i = 0; i < bookmarks.length; i++) {
        if (i % 50 === 0 && isJobCancelled(job.id)) {
            logDebug(`[Worker] Fetch thumbnails job ${job.id} cancelled at ${i}/${total}`);
            return;
        }

        const bm = bookmarks[i];
        try {
            const metadata = await fetchUrlMetadata(bm.url);
            if (metadata.favicon) {
                upsertDomainFavicon(bm.url, metadata.favicon);
            }

            // Try to save thumbnail from the OG image URL
            let savedPath: string | null = null;
            if (metadata.thumbnailUrl) {
                savedPath = await saveThumbnailFromUrl(bm.id, metadata.thumbnailUrl);
            }

            // Use saved file path, or fall back to dynamic SVG path
            const thumbnailValue = savedPath || metadata.fallbackThumbnail;

            if (thumbnailValue) {
                // In non-overwrite mode, still allow updating orphaned/missing thumbnails
                db.prepare(`
                    UPDATE bookmarks SET
                        thumbnail = ?,
                        updated_at = datetime('now')
                    WHERE id = ?
                `).run(thumbnailValue, bm.id);
            }
        } catch (e) {
            logDebug(`[Worker] Fetch thumbnail failed for ${bm.id}: ` + e);
        }

        updateJobProgress(job.id, i + 1, total, payload);

        await new Promise(resolve => setTimeout(resolve, 300));
    }

    logDebug(`[Worker] Fetch thumbnails complete: ${total} processed`);
}

