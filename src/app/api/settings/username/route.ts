import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

export async function PUT(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { username } = await request.json().catch(() => ({}));

    if (!username || !USERNAME_RE.test(username)) {
        return NextResponse.json({
            error: "Username must be 3–30 characters and contain only letters, numbers, and underscores",
        }, { status: 400 });
    }

    // Check uniqueness (case-insensitive), excluding self
    const existing = db.prepare(
        "SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id != ?"
    ).get(username, session.user.id);

    if (existing) {
        return NextResponse.json({ error: "Username is already taken" }, { status: 409 });
    }

    db.prepare(
        "UPDATE users SET username = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(username, session.user.id);

    return NextResponse.json({ success: true, username });
}
