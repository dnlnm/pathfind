import db from "../db";

/**
 * Update the progress and payload of a bulk job.
 */
export function updateJobProgress(jobId: string, processed: number, total: number, extraPayload: Record<string, any> = {}) {
    const progress = Math.round((processed / total) * 100);
    db.prepare("UPDATE jobs SET progress = ?, payload = ?, updated_at = datetime('now') WHERE id = ?")
        .run(progress, JSON.stringify({ ...extraPayload, total, processed }), jobId);
}

/**
 * Initialize job payload with total/processed counters at the start of a bulk job.
 */
export function initJobProgress(jobId: string, total: number, extraPayload: Record<string, any> = {}) {
    db.prepare("UPDATE jobs SET payload = ?, updated_at = datetime('now') WHERE id = ?")
        .run(JSON.stringify({ ...extraPayload, total, processed: 0 }), jobId);
}
