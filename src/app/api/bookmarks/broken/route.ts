import { NextResponse, NextRequest } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

// GET — return all bookmarks with link_status = 'broken' or 'redirected'
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const bookmarks = db.prepare(`
        SELECT id, url, title, favicon, link_status, link_status_code, link_checked_at
        FROM bookmarks
        WHERE user_id = ?
        AND link_status IN ('broken', 'redirected')
        ORDER BY link_checked_at DESC
    `).all(userId);

    return NextResponse.json(bookmarks);
}

// DELETE — bulk delete selected bookmarks by id array
export async function DELETE(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { ids } = body as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: "No IDs provided" }, { status: 400 });
    }

    const placeholders = ids.map(() => "?").join(", ");
    const result = db.prepare(`
        DELETE FROM bookmarks
        WHERE id IN (${placeholders})
        AND user_id = ?
    `).run(...ids, userId);

    return NextResponse.json({ deleted: result.changes });
}
