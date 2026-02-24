import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db, { generateId } from "@/lib/db";

export async function POST() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const user = db.prepare("SELECT github_token FROM users WHERE id = ?").get(userId) as { github_token: string | null };

    if (!user?.github_token) {
        return NextResponse.json({ error: "GitHub token not configured" }, { status: 400 });
    }

    // Check if there's already a pending github_starred_sync job for this user
    const existingJob = db.prepare("SELECT id FROM jobs WHERE user_id = ? AND type = 'github_starred_sync' AND status IN ('pending', 'processing')").get(userId);

    if (existingJob) {
        return NextResponse.json({ error: "A sync is already in progress" }, { status: 409 });
    }

    const id = generateId();
    db.prepare(`
        INSERT INTO jobs (id, type, payload, status, user_id)
        VALUES (?, 'github_starred_sync', ?, 'pending', ?)
    `).run(id, JSON.stringify({ userId }), userId);

    return NextResponse.json({ success: true, jobId: id });
}
