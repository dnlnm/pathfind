import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db, { generateId } from "@/lib/db";

export async function POST() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.REDDIT_RSS_URL) {
        return NextResponse.json({ error: "REDDIT_RSS_URL is not configured in .env" }, { status: 400 });
    }

    const userId = session.user.id;

    // Check if there's already a pending reddit_rss_sync job for this user
    const existingJob = db.prepare("SELECT id FROM jobs WHERE user_id = ? AND type = 'reddit_rss_sync' AND status IN ('pending', 'processing')").get(userId);

    if (existingJob) {
        return NextResponse.json({ error: "A sync is already in progress" }, { status: 409 });
    }

    const id = generateId();
    db.prepare(`
        INSERT INTO jobs (id, type, payload, status, user_id)
        VALUES (?, 'reddit_rss_sync', ?, 'pending', ?)
    `).run(id, JSON.stringify({ userId }), userId);

    return NextResponse.json({ success: true, jobId: id });
}
