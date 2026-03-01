import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = db.prepare("SELECT reddit_sync_enabled, last_reddit_sync_at FROM users WHERE id = ?").get(session.user.id) as { reddit_sync_enabled: number; last_reddit_sync_at: string | null };

    return NextResponse.json({
        configured: !!process.env.REDDIT_RSS_URL,
        lastSync: user?.last_reddit_sync_at || null,
        syncEnabled: user?.reddit_sync_enabled === 1,
    });
}

// Only syncEnabled is mutable now — the RSS URL lives in .env
export async function PUT(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { syncEnabled } = await request.json();

    db.prepare("UPDATE users SET reddit_sync_enabled = ?, updated_at = datetime('now') WHERE id = ?").run(
        syncEnabled ? 1 : 0,
        session.user.id
    );

    return NextResponse.json({ success: true });
}
