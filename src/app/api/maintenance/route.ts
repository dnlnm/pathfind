import { NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

/**
 * GET /api/maintenance
 * Always runs live COUNT queries so the result reflects the actual current state.
 * The client polls this every 5 minutes, which is the correct throttle.
 * No DB-level cache — a 30-min stale cache caused notifications to linger after fixes.
 */
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const missingThumbnails = (db.prepare(`
        SELECT COUNT(*) as count FROM bookmarks
        WHERE user_id = ? AND (thumbnail IS NULL OR thumbnail = '')
    `).get(userId) as { count: number }).count;

    const missingEmbeddings = (db.prepare(`
        SELECT COUNT(*) as count FROM bookmarks b
        LEFT JOIN vec_bookmarks v ON b.rowid = v.rowid
        WHERE b.user_id = ? AND IFNULL(b.is_nsfw, 0) = 0 AND v.rowid IS NULL
    `).get(userId) as { count: number }).count;

    return NextResponse.json({
        missingThumbnails,
        missingEmbeddings,
    });
}
