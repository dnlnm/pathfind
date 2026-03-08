import { NextResponse, NextRequest } from "next/server";
import db from "@/lib/db";
import { toBookmarksWithTagsBatch } from "@/lib/bookmark-queries";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { generateEmbedding } from "@/lib/gemini";
import { DbBookmark } from "@/types";

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

        let filterWhere = "AND is_nsfw = 0 ";
        if (filter === "readlater") filterWhere += "AND is_read_later = 1 AND is_archived = 0";
        else if (filter === "archived") filterWhere += "AND is_archived = 1";
        else filterWhere += "AND is_archived = 0";

        const rowidPlaceholders = vectorResults.map(() => "?").join(",");
        const rowidValues = vectorResults.map((r) => r.rowid);

        // Load the actual bookmarks checking permissions
        const bookmarksQuery = db.prepare(`
            SELECT * FROM bookmarks 
            WHERE rowid IN (${rowidPlaceholders}) AND user_id = ? ${filterWhere}
        `);

        const rawBookmarks = bookmarksQuery.all(...rowidValues, userAuth.id) as DbBookmark[];

        const distanceMap = new Map(vectorResults.map((r) => [r.rowid, r.distance]));

        const idPlaceholders = rawBookmarks.map(() => "?").join(",");
        const rowidRows = rawBookmarks.length > 0
            ? db.prepare(`SELECT id, rowid FROM bookmarks WHERE id IN (${idPlaceholders})`)
                .all(...rawBookmarks.map(b => b.id)) as { id: string; rowid: number }[]
            : [];
        const idToRowid = new Map(rowidRows.map(r => [r.id, r.rowid]));

        const sortedBookmarks = rawBookmarks
            .map(b => ({ ...b, _distance: distanceMap.get(idToRowid.get(b.id)!) || 0 }))
            .sort((a, b) => a._distance - b._distance)
            .slice(0, k);

        const bookmarksWithTags = toBookmarksWithTagsBatch(sortedBookmarks);
        const bookmarks = bookmarksWithTags.map((b, i) => ({ ...b, distance: sortedBookmarks[i]._distance }));

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
