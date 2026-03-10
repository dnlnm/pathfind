import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    
    if (!code) {
        return NextResponse.redirect(new URL("/settings?error=Missing+authorization+code", request.url));
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
        return NextResponse.redirect(new URL("/settings?error=GitHub+client+credentials+not+configured", request.url));
    }

    try {
        const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code: code
            })
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
            console.error("GitHub token error:", tokenData.error_description);
            return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(tokenData.error_description || "GitHub authentication failed")}`, request.url));
        }

        const accessToken = tokenData.access_token;
        if (!accessToken) {
            return NextResponse.redirect(new URL("/settings?error=No+access+token+received", request.url));
        }

        db.prepare("UPDATE users SET github_token = ? WHERE id = ?").run(accessToken, session.user.id);

        return NextResponse.redirect(new URL("/settings?tab=github", request.url));

    } catch (e) {
        console.error("Failed to authenticate with GitHub:", e);
        return NextResponse.redirect(new URL("/settings?error=Failed+to+authenticate+with+GitHub", request.url));
    }
}
