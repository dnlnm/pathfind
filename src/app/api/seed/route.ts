import { NextResponse } from "next/server";
import { ensureAdminUser } from "@/lib/seed";

export async function POST() {
    try {
        ensureAdminUser();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Seed error:", error);
        return NextResponse.json({ error: "Failed to seed" }, { status: 500 });
    }
}
