import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { ensureAdminUser } from "@/lib/seed";

export async function POST() {
    try {
        const hasUsers = db.prepare("SELECT 1 FROM users LIMIT 1").get();

        if (hasUsers) {
            const session = await auth();
            if (!session?.user?.id) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
            const user = db.prepare("SELECT role FROM users WHERE id = ?").get(session.user.id) as { role: string } | undefined;
            if (user?.role !== "admin") {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        }

        ensureAdminUser();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Seed error:", error);
        return NextResponse.json({ error: "Failed to seed" }, { status: 500 });
    }
}
