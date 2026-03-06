import { NextRequest, NextResponse } from "next/server";
import db, { generateId, upsertDomainFavicon } from "@/lib/db";
import { fetchUrlMetadata } from "@/lib/metadata-fetcher";
import { saveThumbnailFromUrl } from "@/lib/thumbnail-store";
import { normalizeUrl } from "@/lib/url-normalizer";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

async function sendMessage(chatId: number | string, text: string) {
    if (!TELEGRAM_BOT_TOKEN) return;
    try {
        await fetch(`${TELEGRAM_API}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text }),
        });
    } catch (e) {
        console.error("Failed to send telegram message", e);
    }
}

export async function POST(req: NextRequest) {
    if (!TELEGRAM_BOT_TOKEN) {
        return NextResponse.json({ error: "Telegram bot token not configured" }, { status: 500 });
    }

    if (TELEGRAM_WEBHOOK_SECRET) {
        const headerSecret = req.headers.get("x-telegram-bot-api-secret-token");
        if (headerSecret !== TELEGRAM_WEBHOOK_SECRET) {
            return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
        }
    }

    try {
        const body = await req.json();
        const message = body.message;

        if (!message || (!message.text && !message.caption)) {
            return NextResponse.json({ ok: true });
        }

        const chatId = message.chat.id;
        const text = (message.text || message.caption || "").trim();

        // Check for /start token
        if (text.startsWith("/start ")) {
            const token = text.split(" ")[1];
            const user = db.prepare("SELECT id FROM users WHERE telegram_linking_token = ?").get(token) as { id: string } | undefined;

            if (user) {
                db.prepare("UPDATE users SET telegram_chat_id = ?, telegram_linking_token = NULL WHERE id = ?").run(String(chatId), user.id);
                await sendMessage(chatId, "✅ Account linked successfully! You can now send me links to save them as bookmarks.");
            } else {
                await sendMessage(chatId, "❌ Invalid or expired linking token. Please generate a new one from the settings page.");
            }
            return NextResponse.json({ ok: true });
        }

        // Check if it's a URL
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const matches = text.match(urlRegex);

        if (matches && matches.length > 0) {
            const user = db.prepare("SELECT id FROM users WHERE telegram_chat_id = ?").get(String(chatId)) as { id: string } | undefined;

            if (!user) {
                await sendMessage(chatId, "⚠️ Your account is not linked. Please go to settings to link your Telegram account.");
                return NextResponse.json({ ok: true });
            }

            for (const url of matches) {
                try {
                    const metadata = await fetchUrlMetadata(url);
                    const id = generateId();
                    if (metadata.favicon) {
                        upsertDomainFavicon(url, metadata.favicon);
                    }

                    // Save thumbnail as WebP file, or use SVG fallback
                    let thumbnailValue: string | null = null;
                    if (metadata.thumbnailUrl) {
                        thumbnailValue = await saveThumbnailFromUrl(id, metadata.thumbnailUrl);
                    }
                    if (!thumbnailValue) {
                        thumbnailValue = metadata.fallbackThumbnail;
                    }

                    const canonicalUrl = normalizeUrl(url);
                    db.prepare(`
                        INSERT INTO bookmarks (id, url, canonical_url, title, description, thumbnail, user_id)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `).run(id, url, canonicalUrl, metadata.title || url, metadata.description, thumbnailValue, user.id);

                    await sendMessage(chatId, `🔖 Saved: ${metadata.title || url}`);
                } catch (error) {
                    console.error("Error saving bookmark from Telegram:", error);
                    await sendMessage(chatId, `❌ Failed to save bookmark: ${url}`);
                }
            }
            return NextResponse.json({ ok: true });
        }

        if (text === "/start") {
            await sendMessage(chatId, "👋 Hello! I'm your bookmark bot. Send me a link to save it, or use the linking token from your settings page to connect your account.");
            return NextResponse.json({ ok: true });
        }

        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error("Telegram webhook error", e);
        return NextResponse.json({ ok: true }); // Always return 200 to Telegram
    }
}
