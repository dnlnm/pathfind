import { NextResponse, NextRequest } from "next/server";
import db, { generateId, upsertDomainFavicon } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { fetchUrlMetadata } from "@/lib/metadata-fetcher";
import { DbBookmark } from "@/types";
import { toBookmarkWithTags as toBookmarkResponse } from "@/lib/bookmark-queries";

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
    const { url, title, description, notes, tags, isReadLater, isArchived, isNsfw, thumbnail } = body;

    let finalThumbnail = thumbnail !== undefined ? thumbnail : existing.thumbnail;
    let finalTitle = title ?? existing.title;
    let finalDescription = description ?? existing.description;
    let finalIsNsfw = isNsfw ?? !!existing.is_nsfw;
    const isRedditURL = (url ?? existing.url)?.includes("reddit.com");

    const resolvedUrl = url ?? existing.url;

    // Fetch missing metadata if any are null or URL changed
    // But don't overwrite finalThumbnail if it was explicitly provided in the body
    if ((url && url !== existing.url) || (finalThumbnail === null && !body.hasOwnProperty('thumbnail')) || (isRedditURL && isNsfw === false)) {
        const fetched = await fetchUrlMetadata(resolvedUrl);
        if (fetched.favicon) {
            upsertDomainFavicon(resolvedUrl, fetched.favicon);
        }
        if (finalThumbnail === null && !body.hasOwnProperty('thumbnail')) {
            finalThumbnail = fetched.thumbnail;
        }
        if (!finalTitle) finalTitle = fetched.title;
        if (!finalDescription) finalDescription = fetched.description;
        if ((isNsfw === undefined || isNsfw === false) && fetched.isNsfw === true) {
            finalIsNsfw = true;
        }
    }

    db.prepare(`
    UPDATE bookmarks SET
      url = ?, title = ?, description = ?, notes = ?,
      thumbnail = ?,
      is_read_later = ?, is_archived = ?, is_nsfw = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
        resolvedUrl,
        finalTitle,
        finalDescription,
        notes ?? existing.notes,
        finalThumbnail,
        (isReadLater ?? !!existing.is_read_later) ? 1 : 0,
        (isArchived ?? !!existing.is_archived) ? 1 : 0,
        finalIsNsfw ? 1 : 0,
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
