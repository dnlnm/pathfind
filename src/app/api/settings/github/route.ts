import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = db.prepare("SELECT github_token, github_sync_enabled, last_github_sync_at FROM users WHERE id = ?").get(session.user.id) as { github_token: string | null; github_sync_enabled: number; last_github_sync_at: string | null };

    return NextResponse.json({
        configured: !!user?.github_token,
        syncEnabled: user?.github_sync_enabled === 1,
        lastSync: user?.last_github_sync_at || null,
    });
}

// Only synEnabled is mutable now — the token lives in .env
export async function PUT(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { syncEnabled } = await request.json();

    db.prepare("UPDATE users SET github_sync_enabled = ?, updated_at = datetime('now') WHERE id = ?").run(
        syncEnabled ? 1 : 0,
        session.user.id
    );

    return NextResponse.json({ success: true });
}
