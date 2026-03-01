import { NextResponse, NextRequest } from "next/server";
import db, { generateId } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { fetchUrlMetadata } from "@/lib/metadata-fetcher";
import { generateEmbedding } from "@/lib/gemini";
import { evaluateRules } from "@/lib/rule-engine";
import { DbBookmark, BookmarkWithTags } from "@/types";

function getTagsForBookmark(bookmarkId: string): { id: string; name: string }[] {
    return db.prepare(`
    SELECT t.id, t.name FROM tags t
    JOIN bookmark_tags bt ON bt.tag_id = t.id
    WHERE bt.bookmark_id = ?
  `).all(bookmarkId) as { id: string; name: string }[];
}

function getCollectionsForBookmark(bookmarkId: string): { id: string; name: string; color?: string | null }[] {
    return db.prepare(`
    SELECT c.id, c.name, c.color FROM collections c
    JOIN bookmark_collections bc ON bc.collection_id = c.id
    WHERE bc.bookmark_id = ?
  `).all(bookmarkId) as { id: string; name: string; color?: string | null }[];
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
        isNsfw: !!row.is_nsfw,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        userId: row.user_id,
        tags: getTagsForBookmark(row.id),
        collections: getCollectionsForBookmark(row.id),
    };
}

export async function GET(request: NextRequest) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = db.prepare("SELECT pagination_limit, nsfw_display FROM users WHERE id = ?").get(userAuth.id) as { pagination_limit: number; nsfw_display: string | null };
    const defaultLimit = user?.pagination_limit || 30;
    const nsfwDisplay = user?.nsfw_display ?? 'blur';

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const tag = searchParams.get("tag") || "";
    const collectionId = searchParams.get("collection");
    const filter = searchParams.get("filter") || "all";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || String(defaultLimit));
    const sort = searchParams.get("sort") || "newest";
    const offset = (page - 1) * limit;

    let whereClauses = ["b.user_id = ?"];
    const params: (string | number)[] = [userAuth.id];

    if (filter === "readlater") {
        whereClauses.push("b.is_read_later = 1");
        whereClauses.push("b.is_archived = 0");
    } else if (filter === "archived") {
        whereClauses.push("b.is_archived = 1");
    } else {
        whereClauses.push("b.is_archived = 0");
    }

    if (query) {
        // Use FTS5 for search. We append * to each word to allow prefix matching (e.g., "dev" matches "development")
        const ftsQuery = query.trim().split(/\s+/).filter(t => t.length > 0).map(t => `${t}*`).join(' ');
        if (ftsQuery) {
            whereClauses.push("b.id IN (SELECT id FROM bookmarks_fts WHERE bookmarks_fts MATCH ?)");
            params.push(ftsQuery);
        }
    }

    if (tag) {
        whereClauses.push("b.id IN (SELECT bt.bookmark_id FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id WHERE t.name = ?)");
        params.push(tag);
    }

    if (collectionId) {
        whereClauses.push("b.id IN (SELECT bc.bookmark_id FROM bookmark_collections bc WHERE bc.collection_id = ?)");
        params.push(collectionId);
    }

    const nsfwFilter = searchParams.get("nsfw") || "";

    // If we're specifically looking for nsfw==only, remove the default archive/readlater filters if they are not explicitly set
    if (nsfwFilter === "only") {
        const hasCustomFilter = filter === "readlater" || filter === "archived";
        if (!hasCustomFilter) {
            // Remove the default "is_archived = 0" added above
            whereClauses = whereClauses.filter(clause => clause !== "b.is_archived = 0");
        }
        whereClauses.push("b.is_nsfw = 1");
    } else if (nsfwDisplay === 'hide') {
        whereClauses.push("b.is_nsfw = 0");
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
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { url, title, description, notes, tags, isReadLater, isNsfw, thumbnail } = body;

    if (!url) {
        return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const existing = db.prepare("SELECT * FROM bookmarks WHERE url = ? AND user_id = ?").get(url, userAuth.id) as DbBookmark | undefined;

    // Auto-fetch metadata if any info is missing
    let finalTitle = title || (existing?.title) || null;
    let finalDescription = description || (existing?.description) || null;
    let finalFavicon: string | null = existing?.favicon || null;
    let finalThumbnail = thumbnail || (existing?.thumbnail) || null;
    let finalIsNsfw = isNsfw !== undefined ? isNsfw : (existing ? !!existing.is_nsfw : false);
    const isReddit = url && url.includes("reddit.com");

    // We fetch metadata if anything is missing, OR if it's a Reddit link and the client didn't explicitly send isNsfw as true.
    // This allows us to "promote" a default `false` from the UI to `true` if Reddit says it's 18+.
    if (!finalTitle || !finalDescription || !finalFavicon || !finalThumbnail || (isReddit && isNsfw === false)) {
        const fetched = await fetchUrlMetadata(url);
        finalTitle = finalTitle || fetched.title;
        finalDescription = finalDescription || fetched.description;
        finalFavicon = finalFavicon || fetched.favicon;
        if (!finalThumbnail) {
            finalThumbnail = fetched.thumbnail;
        }
        if ((isNsfw === undefined || isNsfw === false) && fetched.isNsfw === true) {
            finalIsNsfw = true;
        }
    }

    let id: string;
    let isUpdate = false;

    if (existing) {
        id = existing.id;
        isUpdate = true;

        let finalNotes = notes !== undefined ? notes : existing.notes;

        db.prepare(`
            UPDATE bookmarks 
            SET title = ?, description = ?, notes = ?, favicon = ?, thumbnail = ?, is_read_later = ?, is_nsfw = ?, updated_at = datetime('now')
            WHERE id = ?
        `).run(finalTitle, finalDescription, finalNotes, finalFavicon, finalThumbnail, isReadLater !== undefined ? (isReadLater ? 1 : 0) : existing.is_read_later, finalIsNsfw ? 1 : 0, id);

        if (body.tags !== undefined) {
            db.prepare("DELETE FROM bookmark_tags WHERE bookmark_id = ?").run(id);
        }
        if (body.collections !== undefined) {
            db.prepare("DELETE FROM bookmark_collections WHERE bookmark_id = ?").run(id);
        }
    } else {
        id = generateId();
        db.prepare(`
            INSERT INTO bookmarks (id, url, title, description, notes, favicon, thumbnail, is_read_later, is_nsfw, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, url, finalTitle, finalDescription, notes || null, finalFavicon, finalThumbnail, isReadLater ? 1 : 0, finalIsNsfw ? 1 : 0, userAuth.id);
    }

    // Create/connect tags
    if ((!isUpdate || body.tags !== undefined) && tags && tags.length > 0) {
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

    // Connect collections
    if ((!isUpdate || body.collections !== undefined) && body.collections && body.collections.length > 0) {
        const linkCollection = db.prepare("INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)");
        for (const collectionId of body.collections) {
            linkCollection.run(id, collectionId);
        }
    }

    // Evaluate rule engine
    const bookmarkForRules = db.prepare("SELECT * FROM bookmarks WHERE id = ?").get(id) as DbBookmark;
    const ruleEvent = isUpdate ? "bookmark.updated" : "bookmark.created";
    try {
        await evaluateRules(ruleEvent, bookmarkForRules, userAuth.id);
    } catch (e) {
        console.error("[RuleEngine] Error during rule evaluation:", e);
    }

    const created = db.prepare("SELECT * FROM bookmarks WHERE id = ?").get(id) as DbBookmark;

    // Asynchronously generate embedding in the background
    (async () => {
        try {
            const textToEmbed = `${finalTitle || ''} ${finalDescription || ''} ${notes || ''}`.trim();
            if (textToEmbed) {
                const embedding = await generateEmbedding(textToEmbed);
                if (embedding) {
                    const row = db.prepare("SELECT rowid FROM bookmarks WHERE id = ?").get(id) as { rowid: number };
                    if (row) {
                        const f32arr = new Float32Array(embedding);
                        db.prepare("INSERT OR REPLACE INTO vec_bookmarks(rowid, embedding) VALUES (?, ?)").run(BigInt(row.rowid), f32arr);
                    }
                }
            }
        } catch (error) {
            console.error("Background embedding failed:", error);
        }
    })();

    return NextResponse.json({ ...toBookmarkWithTags(created), isUpdate }, { status: isUpdate ? 200 : 201 });
}
