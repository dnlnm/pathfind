import { NextResponse, NextRequest } from "next/server";
import db from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/api-auth";

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

    const bookmark = db.prepare(`
        SELECT id FROM bookmarks 
        WHERE url = ? AND user_id = ?
        LIMIT 1
    `).get(url, userAuth.id);

    return NextResponse.json({ bookmarked: !!bookmark });
}
