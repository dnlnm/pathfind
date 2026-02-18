import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export async function PUT(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { limit } = await request.json();
    const pagination_limit = parseInt(limit);

    if (isNaN(pagination_limit) || pagination_limit < 1 || pagination_limit > 100) {
        return NextResponse.json({ error: "Invalid limit. Must be between 1 and 100." }, { status: 400 });
    }

    db.prepare("UPDATE users SET pagination_limit = ?, updated_at = datetime('now') WHERE id = ?").run(
        pagination_limit,
        session.user.id
    );

    return NextResponse.json({ success: true });
}

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = db.prepare("SELECT pagination_limit FROM users WHERE id = ?").get(session.user.id) as { pagination_limit: number };

    return NextResponse.json({ limit: user?.pagination_limit || 30 });
}
