import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=youtube&error=${error}`);
    }

    if (!code) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=youtube&error=no_code`);
    }

    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/youtube/callback`;

    try {
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                code,
                client_id: clientId!,
                client_secret: clientSecret!,
                redirect_uri: redirectUri,
                grant_type: "authorization_code",
            }),
        });

        const tokens = await tokenResponse.json();

        if (tokens.error) {
            console.error("YouTube Token Error:", tokens);
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=youtube&error=token_exchange_failed`);
        }

        const { access_token, refresh_token, expires_in } = tokens;
        const expiresAt = Date.now() + expires_in * 1000;

        // Save tokens to DB
        db.prepare(
            `UPDATE users SET 
                youtube_token = ?, 
                youtube_refresh_token = ?, 
                youtube_token_expires_at = ?,
                updated_at = datetime('now')
             WHERE id = ?`
        ).run(access_token, refresh_token || null, expiresAt, session.user.id);

        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=youtube&youtube_connected=true`);
    } catch (e) {
        console.error("YouTube Callback Error:", e);
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=youtube&error=callback_exception`);
    }
}
