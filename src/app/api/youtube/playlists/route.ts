import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getYouTubeToken, fetchYouTubePlaylists } from "@/lib/youtube-client";
import db from "@/lib/db";

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = await getYouTubeToken(session.user.id);
    if (!token) {
        return NextResponse.json({ error: "YouTube not connected" }, { status: 400 });
    }

    try {
        const playlistsItems = await fetchYouTubePlaylists(token);
        
        // Get current sync settings
        const user = db.prepare("SELECT youtube_playlists_sync FROM users WHERE id = ?").get(session.user.id) as any;
        const selectedIds = user?.youtube_playlists_sync ? JSON.parse(user.youtube_playlists_sync) : [];

        const playlists = playlistsItems.map((p: any) => ({
            id: p.id,
            title: p.snippet.title,
            thumbnail: p.snippet.thumbnails?.default?.url,
            itemCount: p.contentDetails.itemCount,
            isSelected: selectedIds.includes(p.id)
        }));

        return NextResponse.json(playlists);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
