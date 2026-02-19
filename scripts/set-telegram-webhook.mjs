import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

if (!TOKEN || !APP_URL) {
    console.error("❌ Error: TELEGRAM_BOT_TOKEN and NEXT_PUBLIC_APP_URL must be set in .env");
    process.exit(1);
}

const WEBHOOK_URL = `${APP_URL}/api/webhooks/telegram`;

async function setWebhook() {
    console.log(`🚀 Setting webhook to: ${WEBHOOK_URL}`);

    try {
        const response = await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: WEBHOOK_URL }),
        });

        const data = await response.json();

        if (data.ok) {
            console.log("✅ Webhook set successfully!");
            console.log(data.description);
        } else {
            console.log("❌ Failed to set webhook:");
            console.error(data);
        }
    } catch (error) {
        console.error("❌ Error connecting to Telegram API:", error);
    }
}

setWebhook();
