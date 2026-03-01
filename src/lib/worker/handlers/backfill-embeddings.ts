import db from "../../db";
import { generateEmbedding } from "../../gemini";
import { logDebug, isJobCancelled } from "../logger";
import { initJobProgress, updateJobProgress } from "../progress";

export async function handleBackfillEmbeddings(job: any, payload: any) {
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

    initJobProgress(job.id, total, payload);

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

        updateJobProgress(job.id, i + 1, total, payload);

        // Rate limit to avoid Gemini API throttling
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    logDebug(`[Worker] Backfill embeddings complete: ${total} bookmarks processed`);
}
