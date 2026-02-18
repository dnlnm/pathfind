import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = db.prepare("SELECT domain, color FROM domain_colors WHERE user_id = ?").all(session.user.id);
    return NextResponse.json(rows);
}

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { domain, color } = await request.json();
    if (!domain || !color) {
        return NextResponse.json({ error: "Domain and color are required" }, { status: 400 });
    }

    // Upsert domain color
    db.prepare(`
        INSERT INTO domain_colors (user_id, domain, color)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id, domain) DO UPDATE SET color = excluded.color
    `).run(session.user.id, domain.toLowerCase(), color);

    return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { domain } = await request.json();
    if (!domain) {
        return NextResponse.json({ error: "Domain is required" }, { status: 400 });
    }

    db.prepare("DELETE FROM domain_colors WHERE user_id = ? AND domain = ?").run(session.user.id, domain.toLowerCase());
    return NextResponse.json({ success: true });
}
