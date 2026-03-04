import { NextResponse, NextRequest } from "next/server";
import db from "@/lib/db";
import { getAdminUser } from "@/lib/api-auth";
import { hashSync } from "bcryptjs";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

// PUT /api/admin/users/:id — update role, username, or password
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const admin = await getAdminUser(request);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    const target = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (body.role !== undefined) {
        if (body.role !== "admin" && body.role !== "user") {
            return NextResponse.json({ error: "Invalid role" }, { status: 400 });
        }
        // Prevent demoting yourself so there is always at least one admin
        if (id === admin.id && body.role !== "admin") {
            return NextResponse.json({ error: "You cannot change your own role" }, { status: 400 });
        }
        updates.push("role = ?");
        values.push(body.role);
    }

    if (body.username !== undefined) {
        if (!USERNAME_RE.test(body.username)) {
            return NextResponse.json({ error: "Invalid username", field: "username" }, { status: 400 });
        }
        const existing = db.prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id != ?").get(body.username, id);
        if (existing) return NextResponse.json({ error: "Username already taken", field: "username" }, { status: 409 });
        updates.push("username = ?");
        values.push(body.username);
    }

    if (body.password !== undefined) {
        if (body.password.length < 6) {
            return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
        }
        updates.push("password = ?");
        values.push(hashSync(body.password, 12));
    }

    if (updates.length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

    updates.push("updated_at = datetime('now')");
    db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...values, id);

    const updated = db.prepare("SELECT id, email, name, username, role FROM users WHERE id = ?").get(id) as { id: string; email: string; name: string | null; username: string | null; role: string };
    return NextResponse.json(updated);
}

// DELETE /api/admin/users/:id — delete user and all their data via CASCADE
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const admin = await getAdminUser(request);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;

    if (id === admin.id) {
        return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
    }

    const target = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

    db.prepare("DELETE FROM users WHERE id = ?").run(id);

    return NextResponse.json({ success: true });
}
