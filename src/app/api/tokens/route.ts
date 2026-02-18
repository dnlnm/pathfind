import { NextResponse, NextRequest } from "next/server";
import db, { generateId } from "@/lib/db";
import { auth } from "@/lib/auth";
import crypto from "crypto";

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tokens = db.prepare(`
        SELECT id, name, last_used_at, created_at, 
        substr(token, 1, 4) || '...' || substr(token, -4) as masked_token
        FROM api_tokens 
        WHERE user_id = ?
        ORDER BY created_at DESC
    `).all(session.user.id);

    return NextResponse.json(tokens);
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name } = await request.json();
    if (!name) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const id = generateId();
    // Generate a secure token: pf_ (prefix) + 32 random bytes in hex
    const tokenValue = `pf_${crypto.randomBytes(32).toString("hex")}`;

    db.prepare(`
        INSERT INTO api_tokens (id, token, name, user_id)
        VALUES (?, ?, ?, ?)
    `).run(id, tokenValue, name, session.user.id);

    return NextResponse.json({
        id,
        name,
        token: tokenValue, // Only returned once on creation
        createdAt: new Date().toISOString()
    }, { status: 201 });
}
