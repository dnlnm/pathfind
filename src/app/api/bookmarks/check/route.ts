import { NextResponse, NextRequest } from "next/server";
import db from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { normalizeUrl } from "@/lib/url-normalizer";

export async function GET(request: NextRequest) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
        return NextResponse.json({ error: "URL parameter is required" }, { status: 400 });
    }

    const canonicalUrl = normalizeUrl(url.trim());

    const bookmark = db.prepare(`
        SELECT id, title, url FROM bookmarks 
        WHERE canonical_url = ? AND user_id = ?
        LIMIT 1
    `).get(canonicalUrl, userAuth.id) as { id: string; title: string | null; url: string } | undefined;

    return NextResponse.json({
        bookmarked: !!bookmark,
        existingTitle: bookmark?.title ?? null,
        existingUrl: bookmark?.url ?? null,
    });
}
