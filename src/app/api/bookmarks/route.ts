import { NextResponse, NextRequest } from "next/server";
import db, { generateId } from "@/lib/db";
import { auth } from "@/lib/auth";
import { fetchUrlMetadata } from "@/lib/metadata-fetcher";
import { DbBookmark, BookmarkWithTags } from "@/types";

function getTagsForBookmark(bookmarkId: string): { id: string; name: string }[] {
    return db.prepare(`
    SELECT t.id, t.name FROM tags t
    JOIN bookmark_tags bt ON bt.tag_id = t.id
    WHERE bt.bookmark_id = ?
  `).all(bookmarkId) as { id: string; name: string }[];
}

function toBookmarkWithTags(row: DbBookmark): BookmarkWithTags {
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
    };
}

export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = db.prepare("SELECT pagination_limit FROM users WHERE id = ?").get(session.user.id) as { pagination_limit: number };
    const defaultLimit = user?.pagination_limit || 30;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const tag = searchParams.get("tag") || "";
    const filter = searchParams.get("filter") || "all";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || String(defaultLimit));
    const sort = searchParams.get("sort") || "newest";
    const offset = (page - 1) * limit;

    let whereClauses = ["b.user_id = ?"];
    const params: (string | number)[] = [session.user.id];

    if (filter === "readlater") {
        whereClauses.push("b.is_read_later = 1");
        whereClauses.push("b.is_archived = 0");
    } else if (filter === "archived") {
        whereClauses.push("b.is_archived = 1");
    } else {
        whereClauses.push("b.is_archived = 0");
    }

    if (query) {
        whereClauses.push("(b.title LIKE ? OR b.url LIKE ? OR b.description LIKE ? OR b.notes LIKE ?)");
        const q = `%${query}%`;
        params.push(q, q, q, q);
    }

    if (tag) {
        whereClauses.push("b.id IN (SELECT bt.bookmark_id FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id WHERE t.name = ?)");
        params.push(tag);
    }

    const whereStr = whereClauses.join(" AND ");

    // Map sort parameter to SQL ORDER BY
    let orderBy = "b.created_at DESC";
    if (sort === "oldest") orderBy = "b.created_at ASC";
    else if (sort === "title_asc") orderBy = "b.title COLLATE NOCASE ASC";
    else if (sort === "title_desc") orderBy = "b.title COLLATE NOCASE DESC";

    const total = (db.prepare(`SELECT COUNT(*) as count FROM bookmarks b WHERE ${whereStr}`).get(...params) as { count: number }).count;

    const rows = db.prepare(`
    SELECT b.* FROM bookmarks b
    WHERE ${whereStr}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as DbBookmark[];

    const bookmarks = rows.map(toBookmarkWithTags);

    return NextResponse.json({
        bookmarks,
        total,
        page,
        totalPages: Math.ceil(total / limit),
    });
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { url, title, description, notes, tags, isReadLater, thumbnail } = body;

    if (!url) {
        return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Auto-fetch metadata if any info is missing
    let finalTitle = title || null;
    let finalDescription = description || null;
    let finalFavicon: string | null = null;
    let finalThumbnail = thumbnail || null;

    if (!finalTitle || !finalDescription || !finalFavicon || !finalThumbnail) {
        const fetched = await fetchUrlMetadata(url);
        finalTitle = finalTitle || fetched.title;
        finalDescription = finalDescription || fetched.description;
        finalFavicon = fetched.favicon;
        if (!finalThumbnail) {
            finalThumbnail = fetched.thumbnail;
        }
    }

    const id = generateId();

    db.prepare(`
    INSERT INTO bookmarks (id, url, title, description, notes, favicon, thumbnail, is_read_later, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, url, finalTitle, finalDescription, notes || null, finalFavicon, finalThumbnail, isReadLater ? 1 : 0, session.user.id);

    // Create/connect tags
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

    const created = db.prepare("SELECT * FROM bookmarks WHERE id = ?").get(id) as DbBookmark;
    return NextResponse.json(toBookmarkWithTags(created), { status: 201 });
}
