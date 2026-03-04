import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

/**
 * GET /api/me
 * Returns the current user's profile (id, email, name, username, role).
 * Used by client components that need to know the current user's role.
 */
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = db.prepare(
        "SELECT id, email, name, username, role FROM users WHERE id = ?"
    ).get(session.user.id) as { id: string; email: string; name: string | null; username: string | null; role: string } | undefined;

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        role: user.role,
    });
}
