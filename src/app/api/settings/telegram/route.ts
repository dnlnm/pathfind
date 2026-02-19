import { NextRequest, NextResponse } from "next/server";
import db, { generateId } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/api-auth";
import crypto from "crypto";

export async function GET(request: NextRequest) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = db.prepare("SELECT telegram_chat_id FROM users WHERE id = ?").get(userAuth.id) as { telegram_chat_id: string | null };

    return NextResponse.json({
        isLinked: !!user?.telegram_chat_id,
        botUsername: process.env.TELEGRAM_BOT_USERNAME || "PathFindBot"
    });
}

export async function POST(request: NextRequest) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Generate a 6-character random token
    const token = crypto.randomBytes(3).toString("hex").toUpperCase();

    db.prepare("UPDATE users SET telegram_linking_token = ? WHERE id = ?").run(token, userAuth.id);

    return NextResponse.json({ token });
}

export async function DELETE(request: NextRequest) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    db.prepare("UPDATE users SET telegram_chat_id = NULL, telegram_linking_token = NULL WHERE id = ?").run(userAuth.id);

    return NextResponse.json({ success: true });
}
