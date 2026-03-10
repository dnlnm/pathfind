import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = db.prepare("SELECT youtube_token, youtube_sync_enabled, last_youtube_sync_at FROM users WHERE id = ?").get(session.user.id) as any;

    return NextResponse.json({
        isConnected: !!user?.youtube_token,
        syncEnabled: user?.youtube_sync_enabled === 1,
        lastSync: user?.last_youtube_sync_at || null,
    });
}
