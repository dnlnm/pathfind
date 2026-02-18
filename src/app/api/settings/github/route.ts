import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export async function PUT(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { token } = await request.json();

    db.prepare("UPDATE users SET github_token = ?, updated_at = datetime('now') WHERE id = ?").run(
        token || null,
        session.user.id
    );

    return NextResponse.json({ success: true });
}

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = db.prepare("SELECT github_token FROM users WHERE id = ?").get(session.user.id) as { github_token: string | null };

    return NextResponse.json({ token: user?.github_token || "" });
}
