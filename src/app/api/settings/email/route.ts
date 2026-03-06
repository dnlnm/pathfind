import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = db.prepare("SELECT email FROM users WHERE id = ?").get(session.user.id) as { email: string } | undefined;

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ email: user.email });
}

export async function PUT(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email } = await request.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    try {
        // Check if email is already taken by another user
        const existing = db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(email, session.user.id);
        if (existing) {
            return NextResponse.json({ error: "Email is already in use" }, { status: 400 });
        }

        db.prepare("UPDATE users SET email = ?, updated_at = datetime('now') WHERE id = ?").run(email, session.user.id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to update email:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
