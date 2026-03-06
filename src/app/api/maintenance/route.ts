import { NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { getThumbnailAbsolutePath } from "@/lib/thumbnail-store";

/**
 * GET /api/maintenance
 * Always runs live COUNT queries so the result reflects the actual current state.
 * The client polls this every 5 minutes, which is the correct throttle.
 * No DB-level cache — a 30-min stale cache caused notifications to linger after fixes.
 *
 * Also checks for "orphaned" thumbnail references — rows where the DB column
 * has a file path but the corresponding .webp no longer exists on disk.
 */
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Count bookmarks with no thumbnail value at all
    const nullThumbnails = (db.prepare(`
        SELECT COUNT(*) as count FROM bookmarks
        WHERE user_id = ? AND (thumbnail IS NULL OR thumbnail = '')
    `).get(userId) as { count: number }).count;

    // Also check bookmarks whose thumbnail column points to a file that no longer exists
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

    return NextResponse.json({
        missingThumbnails,
        missingEmbeddings,
    });
}
