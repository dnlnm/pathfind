import { NextResponse, NextRequest } from "next/server";
import db, { generateId } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { fetchUrlMetadata } from "@/lib/metadata-fetcher";
import { DbBookmark } from "@/types";

function getTagsForBookmark(bookmarkId: string): { id: string; name: string }[] {
    return db.prepare(`
    SELECT t.id, t.name FROM tags t
    JOIN bookmark_tags bt ON bt.tag_id = t.id
    WHERE bt.bookmark_id = ?
  `).all(bookmarkId) as { id: string; name: string }[];
}

function getCollectionsForBookmark(bookmarkId: string): { id: string; name: string }[] {
    return db.prepare(`
    SELECT c.id, c.name FROM collections c
    JOIN bookmark_collections bc ON bc.collection_id = c.id
    WHERE bc.bookmark_id = ?
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
        thumbnail: row.thumbnail,
        isArchived: !!row.is_archived,
        isReadLater: !!row.is_read_later,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        userId: row.user_id,
        tags: getTagsForBookmark(row.id),
        collections: getCollectionsForBookmark(row.id),
    };
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const row = db.prepare("SELECT * FROM bookmarks WHERE id = ? AND user_id = ?").get(id, userAuth.id) as DbBookmark | undefined;

    if (!row) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(toBookmarkResponse(row));
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existing = db.prepare("SELECT * FROM bookmarks WHERE id = ? AND user_id = ?").get(id, userAuth.id) as DbBookmark | undefined;

    if (!existing) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const { url, title, description, notes, tags, isReadLater, isArchived, thumbnail } = body;

    let finalFavicon = existing.favicon;
    let finalThumbnail = thumbnail !== undefined ? thumbnail : existing.thumbnail;
    let finalTitle = title ?? existing.title;
    let finalDescription = description ?? existing.description;

    // Fetch missing metadata if any are null or URL changed
    // But don't overwrite finalThumbnail if it was explicitly provided in the body
    if ((url && url !== existing.url) || !finalFavicon || (finalThumbnail === null && !body.hasOwnProperty('thumbnail'))) {
        const fetched = await fetchUrlMetadata(url ?? existing.url);
        finalFavicon = fetched.favicon;
        if (finalThumbnail === null && !body.hasOwnProperty('thumbnail')) {
            finalThumbnail = fetched.thumbnail;
        }
        if (!finalTitle) finalTitle = fetched.title;
        if (!finalDescription) finalDescription = fetched.description;
    }

    db.prepare(`
    UPDATE bookmarks SET
      url = ?, title = ?, description = ?, notes = ?,
      favicon = ?, thumbnail = ?,
      is_read_later = ?, is_archived = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
        url ?? existing.url,
        finalTitle,
        finalDescription,
        notes ?? existing.notes,
        finalFavicon,
        finalThumbnail,
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

    // Update collections
    db.prepare("DELETE FROM bookmark_collections WHERE bookmark_id = ?").run(id);
    if (body.collections && body.collections.length > 0) {
        const linkCollection = db.prepare("INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)");
        for (const collectionId of body.collections) {
            linkCollection.run(id, collectionId);
        }
    }

    const updated = db.prepare("SELECT * FROM bookmarks WHERE id = ?").get(id) as DbBookmark;
    return NextResponse.json(toBookmarkResponse(updated));
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existing = db.prepare("SELECT id FROM bookmarks WHERE id = ? AND user_id = ?").get(id, userAuth.id);

    if (!existing) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    db.prepare("DELETE FROM bookmarks WHERE id = ?").run(id);
    return NextResponse.json({ success: true });
}
