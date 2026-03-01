import { NextResponse, NextRequest } from "next/server";
import db from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { generateEmbedding } from "@/lib/gemini";
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

function toBookmarkWithTags(row: DbBookmark & { distance?: number }): BookmarkWithTags & { distance?: number } {
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
        distance: row.distance,
    };
}

export async function GET(request: NextRequest) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const filter = searchParams.get("filter") || "all";
    const kStr = searchParams.get("limit") || "30";
    const k = parseInt(kStr) || 30;

    if (!query) {
        return NextResponse.json({ error: "Query 'q' is required for semantic search." }, { status: 400 });
    }

    try {
        const queryEmbedding = await generateEmbedding(query);
        if (!queryEmbedding) {
            return NextResponse.json({ error: "Failed to generate query embedding. Check GEMINI_API_KEY." }, { status: 500 });
        }

        const f32arr = new Float32Array(queryEmbedding);

        // Perform fast vector search
        const vectorResults = db.prepare(`
            SELECT rowid, distance 
            FROM vec_bookmarks 
            WHERE embedding MATCH ? AND k = ? 
            ORDER BY distance
        `).all(f32arr, k * 2) as { rowid: number; distance: number }[];

        if (!vectorResults.length) {
            return NextResponse.json({ bookmarks: [], total: 0, page: 1, totalPages: 1 });
        }

        // We fetch the real bookmarks from the matched rowids.
        // We ensure we only extract bookmarks belonging to the user and match the filter.
        let filterWhere = "";
        if (filter === "readlater") filterWhere = "AND is_read_later = 1 AND is_archived = 0";
        else if (filter === "archived") filterWhere = "AND is_archived = 1";
        else filterWhere = "AND is_archived = 0";

        const inClauseRows = vectorResults.map((r) => r.rowid).join(",");

        // Load the actual bookmarks checking permissions
        const bookmarksQuery = db.prepare(`
            SELECT * FROM bookmarks 
            WHERE rowid IN (${inClauseRows}) AND user_id = ? ${filterWhere}
        `);

        const rawBookmarks = bookmarksQuery.all(userAuth.id) as DbBookmark[];

        // Re-attach distance and sort correctly since IN (...) clause loses ordering
        const distanceMap = new Map(vectorResults.map((r) => [r.rowid, r.distance]));

        const finalResults = rawBookmarks
            .map((b) => {
                const bRowid = (db.prepare("SELECT rowid FROM bookmarks WHERE id = ?").get(b.id) as { rowid: number }).rowid;
                return {
                    ...b,
                    distance: distanceMap.get(bRowid) || 0
                };
            })
            .sort((a, b) => a.distance - b.distance)
            .slice(0, k);

        const bookmarks = finalResults.map(toBookmarkWithTags);

        return NextResponse.json({
            bookmarks,
            total: bookmarks.length,
            page: 1,
            totalPages: 1
        });
    } catch (error) {
        console.error("Semantic search error:", error);
        return NextResponse.json({ error: "An error occurred during semantic search." }, { status: 500 });
    }
}
