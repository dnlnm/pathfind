import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db, { generateId } from "@/lib/db";

export async function POST() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Check if connected
    const user = db.prepare("SELECT youtube_token FROM users WHERE id = ?").get(userId) as any;
    if (!user?.youtube_token) {
        return NextResponse.json({ error: "YouTube not connected" }, { status: 400 });
    }

    // Check if there's already a pending job
    const existingJob = db.prepare("SELECT id FROM jobs WHERE user_id = ? AND type = 'youtube_playlist_sync' AND status IN ('pending', 'processing')").get(userId);

    if (existingJob) {
        return NextResponse.json({ error: "A sync is already in progress" }, { status: 409 });
    }

    const id = generateId();
    db.prepare(`
        INSERT INTO jobs (id, type, payload, status, user_id)
        VALUES (?, 'youtube_playlist_sync', ?, 'pending', ?)
    `).run(id, JSON.stringify({ userId }), userId);

    return NextResponse.json({ success: true, jobId: id });
}
