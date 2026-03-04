import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export type AuthenticatedUser = {
    id: string;
    email: string;
    name?: string | null;
    username?: string | null;
    role: 'admin' | 'user';
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
        const u = db.prepare("SELECT role, username, name FROM users WHERE id = ?").get(session.user.id) as { role: string; username: string | null; name: string | null } | undefined;
        return {
            id: session.user.id,
            email: session.user.email || "",
            name: u?.name ?? session.user.name,
            username: u?.username ?? null,
            role: (u?.role ?? 'user') as 'admin' | 'user',
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
            db.prepare("UPDATE api_tokens SET last_used_at = datetime('now') WHERE token = ?").run(token);

            const user = db.prepare("SELECT id, email, name, username, role FROM users WHERE id = ?").get(tokenRecord.user_id) as { id: string; email: string; name: string | null; username: string | null; role: string } | undefined;

            if (user) {
                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    username: user.username,
                    role: (user.role ?? 'user') as 'admin' | 'user',
                    isTokenAuth: true,
                };
            }
        }
    }

    return null;
}

/**
 * Returns the user only if they have admin role.
 * Use this as a guard in admin-only API routes.
 */
export async function getAdminUser(request: NextRequest): Promise<AuthenticatedUser | null> {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== 'admin') return null;
    return user;
}
