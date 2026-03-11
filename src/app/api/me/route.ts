import { NextResponse, NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";

/**
 * GET /api/me
 * Returns the current user's profile (id, email, name, username, role).
 * Used by client components that need to know the current user's role.
 */
export async function GET(request: NextRequest) {
    const user = await getAuthenticatedUser(request);
    if (!user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        role: user.role,
    });
}
