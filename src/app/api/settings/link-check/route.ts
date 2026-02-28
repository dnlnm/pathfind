import { NextResponse, NextRequest } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const user = db.prepare(`
        SELECT link_check_enabled, link_check_interval, link_check_interval_days, last_link_check_at
        FROM users
        WHERE id = ?
    `).get(userId) as {
        link_check_enabled: number;
        link_check_interval: string;
        link_check_interval_days: number;
        last_link_check_at: string | null;
    } | undefined;

    return NextResponse.json({
        enabled: (user?.link_check_enabled ?? 0) === 1,
        interval: user?.link_check_interval ?? "weekly",
        intervalDays: user?.link_check_interval_days ?? 7,
        lastCheckedAt: user?.last_link_check_at ?? null,
    });
}

export async function PUT(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { enabled, interval, intervalDays } = body;

    const validIntervals = ["weekly", "monthly", "custom"];
    if (interval && !validIntervals.includes(interval)) {
        return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
    }

    db.prepare(`
        UPDATE users
        SET
            link_check_enabled = ?,
            link_check_interval = ?,
            link_check_interval_days = ?,
            updated_at = datetime('now')
        WHERE id = ?
    `).run(
        enabled ? 1 : 0,
        interval ?? "weekly",
        intervalDays ?? 7,
        userId
    );

    return NextResponse.json({ success: true });
}
