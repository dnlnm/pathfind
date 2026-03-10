import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { playlistIds, syncEnabled } = await request.json();

    if (!Array.isArray(playlistIds)) {
        return NextResponse.json({ error: "Invalid playlistIds" }, { status: 400 });
    }

    db.prepare(`
        UPDATE users SET 
            youtube_playlists_sync = ?, 
            youtube_sync_enabled = ?,
            updated_at = datetime('now')
        WHERE id = ?
    `).run(JSON.stringify(playlistIds), syncEnabled ? 1 : 0, session.user.id);

    return NextResponse.json({ success: true });
}
