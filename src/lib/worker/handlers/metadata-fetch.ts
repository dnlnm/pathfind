import db from "../../db";
import { fetchUrlMetadata } from "../../metadata-fetcher";
import { generateEmbedding } from "../../gemini";
import { evaluateRules } from "../../rule-engine";
import { logDebug } from "../logger";
import { DbBookmark } from "@/types";

export async function handleMetadataFetch(job: any, payload: any) {
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
            is_nsfw = CASE WHEN ? = 1 THEN 1 ELSE is_nsfw END,
            updated_at = datetime('now')
        WHERE id = ?
    `).run(
        metadata.title || '',
        metadata.description || '',
        metadata.favicon || '',
        metadata.thumbnail || '',
        metadata.isNsfw ? 1 : 0,
        bookmarkId
    );

    // After updating metadata, evaluate rules again (as description/nsfw/title might have changed)
    try {
        const updatedBookmark = db.prepare("SELECT * FROM bookmarks WHERE id = ?").get(bookmarkId) as DbBookmark;
        if (updatedBookmark) {
            evaluateRules("bookmark.updated", updatedBookmark, updatedBookmark.user_id);
        }
    } catch (e) {
        logDebug(`[Worker] Rule evaluation failed for ${bookmarkId}: ` + e);
    }

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
