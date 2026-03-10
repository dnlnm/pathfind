import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export async function POST() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    db.prepare("UPDATE users SET github_token = NULL, github_sync_enabled = 0 WHERE id = ?").run(userId);

    return NextResponse.json({ success: true });
}
