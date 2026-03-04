import { NextResponse, NextRequest } from "next/server";
import db from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { toBookmarkWithTags } from "@/lib/bookmark-queries";
import { DbBookmark } from "@/types";

export async function GET(request: NextRequest) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find all canonical URLs that have more than one bookmark
    const dupeGroups = db.prepare(`
        SELECT canonical_url, COUNT(*) as cnt
        FROM bookmarks
        WHERE user_id = ? AND canonical_url IS NOT NULL
        GROUP BY canonical_url
        HAVING cnt > 1
        ORDER BY cnt DESC
    `).all(userAuth.id) as { canonical_url: string; cnt: number }[];

    const groups = dupeGroups.map(group => {
        const rows = db.prepare(
            "SELECT * FROM bookmarks WHERE canonical_url = ? AND user_id = ? ORDER BY created_at ASC"
        ).all(group.canonical_url, userAuth.id) as DbBookmark[];

        return {
            canonicalUrl: group.canonical_url,
            bookmarks: rows.map(toBookmarkWithTags),
        };
    });

    const totalDuplicates = groups.reduce((sum, g) => sum + g.bookmarks.length - 1, 0);

    return NextResponse.json({ groups, totalDuplicates });
}
