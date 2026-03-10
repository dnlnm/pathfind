import db from "../db";
import { logDebug } from "./logger";
import { handleMetadataFetch } from "./handlers/metadata-fetch";
import { handleRedditRssSync } from "./handlers/reddit-sync";
import { handleGithubStarredSync } from "./handlers/github-sync";
import { handleBackfillThumbnails } from "./handlers/backfill-thumbnails";
import { handleBackfillEmbeddings } from "./handlers/backfill-embeddings";
import { handleCheckBrokenLinks } from "./handlers/check-broken-links";
import { handleYoutubePlaylistSync } from "./handlers/youtube-sync";

// ---------------------------------------------------------------------------
// Lane runner — polls for jobs of the given types
// ---------------------------------------------------------------------------

export async function runWorkerLane(laneName: string, types: string[]) {
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
            case 'check_broken_links':
                await handleCheckBrokenLinks(job, payload);
                break;
            case 'youtube_playlist_sync':
                await handleYoutubePlaylistSync(job, payload);
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
        const availableAt = new Date(Date.now() + backoffMinutes * 60_000).toISOString().replace("T", " ").slice(0, 19);
        db.prepare(`
            UPDATE jobs 
            SET status = 'failed', 
                attempts = ?, 
                error = ?, 
                available_at = ?,
                updated_at = datetime('now') 
            WHERE id = ?
        `).run(attempt, e.message || String(e), availableAt, job.id);
        return true;
    }
}
