import { NextResponse, NextRequest } from "next/server";
import db, { generateId } from "@/lib/db";
import { getAdminUser } from "@/lib/api-auth";
import { hashSync } from "bcryptjs";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

// GET /api/admin/users — list all users with bookmark counts
export async function GET(request: NextRequest) {
    const admin = await getAdminUser(request);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const users = db.prepare(`
        SELECT u.id, u.email, u.name, u.username, u.role, u.created_at,
               COUNT(b.id) as bookmark_count
        FROM users u
        LEFT JOIN bookmarks b ON b.user_id = u.id
        GROUP BY u.id
        ORDER BY u.created_at ASC
    `).all() as { id: string; email: string; name: string | null; username: string | null; role: string; created_at: string; bookmark_count: number }[];

    return NextResponse.json(users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        username: u.username,
        role: u.role,
        createdAt: u.created_at,
        bookmarkCount: u.bookmark_count,
    })));
}

// POST /api/admin/users — admin creates a new user (ignores DISABLE_REGISTRATION)
export async function POST(request: NextRequest) {
    const admin = await getAdminUser(request);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    const { username, email, password, role } = body as { username?: string; email?: string; password?: string; role?: string };

    if (!username || !USERNAME_RE.test(username)) {
        return NextResponse.json({ error: "Invalid username", field: "username" }, { status: 400 });
    }
    if (!email || !email.includes("@")) {
        return NextResponse.json({ error: "Valid email is required", field: "email" }, { status: 400 });
    }
    if (!password || password.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters", field: "password" }, { status: 400 });
    }
    const assignedRole = role === "admin" ? "admin" : "user";

    const existingUsername = db.prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE").get(username);
    if (existingUsername) return NextResponse.json({ error: "Username already taken", field: "username" }, { status: 409 });

    const existingEmail = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase());
    if (existingEmail) return NextResponse.json({ error: "Email already in use", field: "email" }, { status: 409 });

    const id = generateId();
    const hashed = hashSync(password, 12);
    db.prepare(`
        INSERT INTO users (id, email, name, username, password, role)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, email.toLowerCase(), username, username, hashed, assignedRole);

    return NextResponse.json({ id, username, email: email.toLowerCase(), role: assignedRole }, { status: 201 });
}
