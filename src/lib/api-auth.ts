import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export type AuthenticatedUser = {
    id: string;
    email: string;
    name?: string | null;
    isTokenAuth: boolean;
};

/**
 * Gets the authenticated user from either the session or an API token.
 * This should be used in API routes that support token-based access.
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<AuthenticatedUser | null> {
    // 1. Try session auth first
    const session = await auth();
    if (session?.user?.id) {
        return {
            id: session.user.id,
            email: session.user.email || "",
            name: session.user.name,
            isTokenAuth: false,
        };
    }

    // 2. Try token auth
    const authHeader = request.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);

        const tokenRecord = db.prepare(`
            SELECT user_id, last_used_at 
            FROM api_tokens 
            WHERE token = ?
        `).get(token) as { user_id: string; last_used_at: string | null } | undefined;

        if (tokenRecord) {
            // Update last_used_at (async-ish - we don't wait for it to return response)
            db.prepare("UPDATE api_tokens SET last_used_at = datetime('now') WHERE token = ?").run(token);

            const user = db.prepare("SELECT id, email, name FROM users WHERE id = ?").get(tokenRecord.user_id) as { id: string, email: string, name: string | null } | undefined;

            if (user) {
                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    isTokenAuth: true,
                };
            }
        }
    }

    return null;
}
