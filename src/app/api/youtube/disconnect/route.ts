import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export async function POST() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    db.prepare(`
        UPDATE users SET 
            youtube_token = NULL, 
            youtube_refresh_token = NULL, 
            youtube_token_expires_at = NULL,
            youtube_sync_enabled = 0,
            updated_at = datetime('now')
        WHERE id = ?
    `).run(session.user.id);

    return NextResponse.json({ success: true });
}
