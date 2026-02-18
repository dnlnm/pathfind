import { NextResponse, NextRequest } from "next/server";
import db, { generateId } from "@/lib/db";
import { auth } from "@/lib/auth";
import { DbBookmark } from "@/types";

function getTagsForBookmark(bookmarkId: string): { id: string; name: string }[] {
    return db.prepare(`
    SELECT t.id, t.name FROM tags t
    JOIN bookmark_tags bt ON bt.tag_id = t.id
    WHERE bt.bookmark_id = ?
  `).all(bookmarkId) as { id: string; name: string }[];
}

function toBookmarkResponse(row: DbBookmark) {
    return {
        id: row.id,
        url: row.url,
        title: row.title,
        description: row.description,
        notes: row.notes,
        favicon: row.favicon,
        isArchived: !!row.is_archived,
        isReadLater: !!row.is_read_later,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        userId: row.user_id,
        tags: getTagsForBookmark(row.id),
    };
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const row = db.prepare("SELECT * FROM bookmarks WHERE id = ? AND user_id = ?").get(id, session.user.id) as DbBookmark | undefined;

    if (!row) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(toBookmarkResponse(row));
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existing = db.prepare("SELECT * FROM bookmarks WHERE id = ? AND user_id = ?").get(id, session.user.id) as DbBookmark | undefined;

    if (!existing) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const { url, title, description, notes, tags, isReadLater, isArchived } = body;

    db.prepare(`
    UPDATE bookmarks SET
      url = ?, title = ?, description = ?, notes = ?,
      is_read_later = ?, is_archived = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
        url ?? existing.url,
        title ?? existing.title,
        description ?? existing.description,
        notes ?? existing.notes,
        (isReadLater ?? !!existing.is_read_later) ? 1 : 0,
        (isArchived ?? !!existing.is_archived) ? 1 : 0,
        id
    );

    // Reconnect tags
    db.prepare("DELETE FROM bookmark_tags WHERE bookmark_id = ?").run(id);

    if (tags && tags.length > 0) {
        const insertTag = db.prepare("INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)");
        const getTag = db.prepare("SELECT id FROM tags WHERE name = ?");
        const linkTag = db.prepare("INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)");

        for (const tagName of tags) {
            const normalized = tagName.toLowerCase().trim();
            insertTag.run(generateId(), normalized);
            const tagRow = getTag.get(normalized) as { id: string };
            linkTag.run(id, tagRow.id);
        }
    }

    const updated = db.prepare("SELECT * FROM bookmarks WHERE id = ?").get(id) as DbBookmark;
    return NextResponse.json(toBookmarkResponse(updated));
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existing = db.prepare("SELECT id FROM bookmarks WHERE id = ? AND user_id = ?").get(id, session.user.id);

    if (!existing) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    db.prepare("DELETE FROM bookmarks WHERE id = ?").run(id);
    return NextResponse.json({ success: true });
}
