import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { compareSync, hashSync } from "bcryptjs";

export async function PUT(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(session.user.id) as { password: string } | undefined;

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!compareSync(currentPassword, user.password)) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    const hashed = hashSync(newPassword, 12);
    db.prepare("UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?").run(hashed, session.user.id);

    return NextResponse.json({ success: true });
}
