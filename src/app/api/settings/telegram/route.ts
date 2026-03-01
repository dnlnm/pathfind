import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/api-auth";
import crypto from "crypto";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

export async function GET(request: NextRequest) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = db.prepare("SELECT telegram_chat_id FROM users WHERE id = ?").get(userAuth.id) as { telegram_chat_id: string | null };

    // Check if webhook is already registered with Telegram
    let webhookRegistered = false;
    let webhookUrl: string | null = null;
    if (TELEGRAM_BOT_TOKEN && APP_URL) {
        const expectedUrl = `${APP_URL}/api/webhooks/telegram`;
        try {
            const res = await fetch(`${TELEGRAM_API}/getWebhookInfo`);
            const data = await res.json();
            if (data.ok) {
                webhookUrl = data.result?.url || null;
                webhookRegistered = webhookUrl === expectedUrl;
            }
        } catch {
            // Telegram unreachable — leave webhookRegistered false
        }
    }

    return NextResponse.json({
        isLinked: !!user?.telegram_chat_id,
        botUsername: process.env.TELEGRAM_BOT_USERNAME || "PathFindBot",
        botConfigured: !!TELEGRAM_BOT_TOKEN,
        webhookRegistered,
        webhookUrl,
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

export async function PUT(request: NextRequest) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!TELEGRAM_BOT_TOKEN) {
        return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN is not configured" }, { status: 500 });
    }
    if (!APP_URL) {
        return NextResponse.json({ error: "NEXT_PUBLIC_APP_URL is not configured" }, { status: 500 });
    }

    const webhookUrl = `${APP_URL}/api/webhooks/telegram`;

    try {
        const res = await fetch(`${TELEGRAM_API}/setWebhook`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: webhookUrl }),
        });
        const data = await res.json();
        if (data.ok) {
            return NextResponse.json({ ok: true, description: data.description });
        } else {
            return NextResponse.json({ error: data.description || "Failed to set webhook" }, { status: 400 });
        }
    } catch (e) {
        console.error("Failed to register Telegram webhook", e);
        return NextResponse.json({ error: "Could not reach Telegram API" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    db.prepare("UPDATE users SET telegram_chat_id = NULL, telegram_linking_token = NULL WHERE id = ?").run(userAuth.id);

    return NextResponse.json({ success: true });
}
