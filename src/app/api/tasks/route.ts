import { NextResponse, NextRequest } from "next/server";
import db, { generateId } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getThumbnailAbsolutePath } from "@/lib/thumbnail-store";

export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const stats = db.prepare(`
        SELECT 
            status, 
            COUNT(*) as count 
        FROM jobs 
        WHERE user_id = ? 
        GROUP BY status
    `).all(userId) as { status: string; count: number }[];

    const activeJobs = db.prepare(`
        SELECT j.*, b.url, b.title 
        FROM jobs j
        LEFT JOIN bookmarks b ON b.id = json_extract(j.payload, '$.bookmarkId')
        WHERE j.user_id = ? AND j.status = 'processing'
        LIMIT 5
    `).all(userId);

    // Maintenance stats: how many bookmarks are missing thumbnails / embeddings
    // Count bookmarks with no thumbnail value
    const nullThumbnails = (db.prepare(`
        SELECT COUNT(*) as count FROM bookmarks 
        WHERE user_id = ? AND (thumbnail IS NULL OR thumbnail = '')
    `).get(userId) as { count: number }).count;

    // Also count bookmarks whose thumbnail file no longer exists on disk
    const fileRefs = db.prepare(`
        SELECT id, thumbnail FROM bookmarks
        WHERE user_id = ? AND thumbnail IS NOT NULL AND thumbnail != '' AND thumbnail LIKE 'thumbnails/%'
    `).all(userId) as { id: string; thumbnail: string }[];

    let orphanedFiles = 0;
    for (const row of fileRefs) {
        if (!getThumbnailAbsolutePath(row.thumbnail)) {
            orphanedFiles++;
        }
    }

    const missingThumbnails = nullThumbnails + orphanedFiles;

    // Exclude bookmarks created in the last 15 minutes — the worker may not have
    // had time to generate their embedding yet, so we avoid a spurious alert.
    const missingEmbeddings = (db.prepare(`
        SELECT COUNT(*) as count FROM bookmarks b
        LEFT JOIN vec_bookmarks v ON b.rowid = v.rowid
        WHERE b.user_id = ? AND IFNULL(b.is_nsfw, 0) = 0 AND v.rowid IS NULL
        AND b.created_at < datetime('now', '-15 minutes')
    `).get(userId) as { count: number }).count;

    // Active bulk jobs with their progress
    const bulkJobs = db.prepare(`
        SELECT id, type, status, progress, payload, error, created_at, updated_at
        FROM jobs 
        WHERE user_id = ? 
        AND type IN ('backfill_thumbnails', 'backfill_embeddings', 'check_broken_links')
        AND status IN ('pending', 'processing')
        ORDER BY created_at DESC
    `).all(userId);

    const result = {
        pending: stats.find(s => s.status === 'pending')?.count || 0,
        processing: stats.find(s => s.status === 'processing')?.count || 0,
        completed: stats.find(s => s.status === 'completed')?.count || 0,
        failed: stats.find(s => s.status === 'failed')?.count || 0,
        activeJobs,
        maintenance: {
            missingThumbnails,
            missingEmbeddings,
        },
        bulkJobs,
    };

    return NextResponse.json(result);
}

// POST to trigger jobs, retry failed, or clear queue
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { action, jobId } = body;

    if (action === 'retry_failed') {
        db.prepare("UPDATE jobs SET status = 'pending', attempts = 0, available_at = NULL WHERE user_id = ? AND status = 'failed'").run(userId);
    } else if (action === 'clear_completed') {
        db.prepare("DELETE FROM jobs WHERE user_id = ? AND status = 'completed'").run(userId);
    } else if (action === 'clear_all') {
        db.prepare("DELETE FROM jobs WHERE user_id = ?").run(userId);
    } else if (action === 'backfill_thumbnails' || action === 'backfill_embeddings' || action === 'check_broken_links') {
        // Prevent duplicate bulk jobs
        const existing = db.prepare(`
            SELECT id FROM jobs 
            WHERE user_id = ? AND type = ? AND status IN ('pending', 'processing')
        `).get(userId, action);

        if (existing) {
            return NextResponse.json({ error: "A job of this type is already running" }, { status: 409 });
        }

        const id = generateId();
        const overwrite = (action === 'backfill_thumbnails' || action === 'backfill_embeddings') ? (body.overwrite === true) : false;
        const jobPayload = action === 'check_broken_links' ? JSON.stringify({}) : JSON.stringify({ overwrite });
        db.prepare(`
            INSERT INTO jobs (id, type, payload, status, user_id)
            VALUES (?, ?, ?, 'pending', ?)
        `).run(id, action, jobPayload, userId);

        return NextResponse.json({ success: true, jobId: id });
    } else if (action === 'cancel_job' && jobId) {
        db.prepare("UPDATE jobs SET status = 'cancelled', updated_at = datetime('now') WHERE id = ? AND user_id = ?").run(jobId, userId);
    }

    return NextResponse.json({ success: true });
}
