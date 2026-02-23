import { NextResponse, NextRequest } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = session.user.id;

    const stats = db.prepare(`
        SELECT 
            status, 
            COUNT(*) as count 
        FROM jobs 
        WHERE user_id = ? 
        GROUP BY status
    `).all(userId) as { status: string; count: number }[];

    const activeJobs = db.prepare(`
        SELECT j.*, b.url, b.title 
        FROM jobs j
        LEFT JOIN bookmarks b ON b.id = json_extract(j.payload, '$.bookmarkId')
        WHERE j.user_id = ? AND j.status = 'processing'
        LIMIT 5
    `).all(userId);

    const result = {
        pending: stats.find(s => s.status === 'pending')?.count || 0,
        processing: stats.find(s => s.status === 'processing')?.count || 0,
        completed: stats.find(s => s.status === 'completed')?.count || 0,
        failed: stats.find(s => s.status === 'failed')?.count || 0,
        activeJobs
    };

    return NextResponse.json(result);
}

// POST to retry failed jobs or clear queue
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { action } = await request.json();

    if (action === 'retry_failed') {
        db.prepare("UPDATE jobs SET status = 'pending', attempts = 0 WHERE user_id = ? AND status = 'failed'").run(userId);
    } else if (action === 'clear_completed') {
        db.prepare("DELETE FROM jobs WHERE user_id = ? AND status = 'completed'").run(userId);
    } else if (action === 'clear_all') {
        db.prepare("DELETE FROM jobs WHERE user_id = ?").run(userId);
    }

    return NextResponse.json({ success: true });
}
