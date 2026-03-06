import { NextResponse, NextRequest } from "next/server";
import db, { generateId } from "@/lib/db";
import { hashSync } from "bcryptjs";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

export async function POST(request: NextRequest) {
    // Gate behind DISABLE_REGISTRATION env flag
    if (process.env.DISABLE_REGISTRATION === "true") {
        return NextResponse.json({ error: "Registration is disabled" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    const { username, email, password } = body as { username?: string; email?: string; password?: string };

    // Validate username
    if (!username || !USERNAME_RE.test(username)) {
        return NextResponse.json({
            error: "Username must be 3–30 characters and contain only letters, numbers, and underscores",
            field: "username",
        }, { status: 400 });
    }

    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "Valid email is required", field: "email" }, { status: 400 });
    }

    // Validate password
    if (!password || password.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters", field: "password" }, { status: 400 });
    }

    // Check username uniqueness (case-insensitive)
    const existingUsername = db.prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE").get(username);
    if (existingUsername) {
        return NextResponse.json({ error: "Username is already taken", field: "username" }, { status: 409 });
    }

    // Check email uniqueness
    const existingEmail = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase());
    if (existingEmail) {
        return NextResponse.json({ error: "An account with this email already exists", field: "email" }, { status: 409 });
    }

    const id = generateId();
    const hashed = hashSync(password, 12);

    db.prepare(`
        INSERT INTO users (id, email, name, username, password, role)
        VALUES (?, ?, ?, ?, ?, 'user')
    `).run(id, email.toLowerCase(), username, username, hashed);

    return NextResponse.json({ id, username, email: email.toLowerCase(), role: "user" }, { status: 201 });
}
