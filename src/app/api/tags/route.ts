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

    db.prepare("DELETE FROM bookmark_tags WHERE tag_id = ?").run(tagId);
    db.prepare("DELETE FROM tags WHERE id = ?").run(tagId);

    return NextResponse.json({ success: true });
}
