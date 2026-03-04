import { NextResponse, NextRequest } from "next/server";
import db from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tags = db.prepare(`
    SELECT t.id, t.name, t.created_at, COUNT(bt.bookmark_id) as count
    FROM tags t
    JOIN bookmark_tags bt ON bt.tag_id = t.id
    JOIN bookmarks b ON b.id = bt.bookmark_id
    WHERE b.user_id = ?
    GROUP BY t.id
    ORDER BY t.name ASC
  `).all(userAuth.id) as { id: string; name: string; created_at: string; count: number }[];

    return NextResponse.json(tags.map(t => ({
        id: t.id,
        name: t.name,
        createdAt: t.created_at,
        _count: { bookmarks: t.count },
    })));
}

export async function DELETE(request: NextRequest) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tagId = searchParams.get("id");

    if (!tagId) {
        return NextResponse.json({ error: "Tag ID required" }, { status: 400 });
    }

    // Verify the tag is used by this user's bookmarks before deleting
    const usedByUser = db.prepare(`
        SELECT 1 FROM bookmark_tags bt
        JOIN bookmarks b ON b.id = bt.bookmark_id
        WHERE bt.tag_id = ? AND b.user_id = ?
    `).get(tagId, userAuth.id);

    if (!usedByUser) {
        return NextResponse.json({ error: "Not found or not yours" }, { status: 404 });
    }

    // Only remove bookmark_tag rows for this user's bookmarks; delete tag itself only if no other users use it
    db.prepare(`
        DELETE FROM bookmark_tags WHERE tag_id = ?
        AND bookmark_id IN (SELECT id FROM bookmarks WHERE user_id = ?)
    `).run(tagId, userAuth.id);

    const stillUsed = db.prepare("SELECT 1 FROM bookmark_tags WHERE tag_id = ?").get(tagId);
    if (!stillUsed) {
        db.prepare("DELETE FROM tags WHERE id = ?").run(tagId);
    }

    return NextResponse.json({ success: true });
}
