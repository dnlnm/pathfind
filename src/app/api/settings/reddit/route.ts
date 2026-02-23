import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export async function PUT(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url } = await request.json();

    db.prepare("UPDATE users SET reddit_rss_url = ?, updated_at = datetime('now') WHERE id = ?").run(
        url || null,
        session.user.id
    );

    return NextResponse.json({ success: true });
}

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = db.prepare("SELECT reddit_rss_url, last_reddit_sync_at FROM users WHERE id = ?").get(session.user.id) as { reddit_rss_url: string | null; last_reddit_sync_at: string | null };

    return NextResponse.json({
        url: user?.reddit_rss_url || "",
        lastSync: user?.last_reddit_sync_at || null
    });
}
