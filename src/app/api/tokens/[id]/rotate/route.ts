import { NextResponse, NextRequest } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import crypto from "crypto";

// POST /api/tokens/[id]/rotate — generate a new token value, invalidate the old one
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const existing = db.prepare(
        "SELECT id, name FROM api_tokens WHERE id = ? AND user_id = ?"
    ).get(id, session.user.id) as { id: string; name: string } | undefined;

    if (!existing) {
        return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    const newToken = `pf_${crypto.randomBytes(32).toString("hex")}`;

    db.prepare(`
        UPDATE api_tokens 
        SET token = ?, last_used_at = NULL, created_at = datetime('now')
        WHERE id = ?
    `).run(newToken, id);

    return NextResponse.json({
        id,
        name: existing.name,
        token: newToken, // Only returned once — client must store it
    });
}
