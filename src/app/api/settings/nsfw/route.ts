import { NextResponse, NextRequest } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { NsfwDisplay } from "@/types";

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = db.prepare("SELECT nsfw_display FROM users WHERE id = ?").get(session.user.id) as {
        nsfw_display: string | null;
    } | undefined;

    return NextResponse.json({
        display: (user?.nsfw_display ?? "blur") as NsfwDisplay,
    });
}

export async function PUT(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { display } = body;

    const validOptions: NsfwDisplay[] = ["blur", "hide", "show"];
    if (!validOptions.includes(display)) {
        return NextResponse.json({ error: "Invalid display option" }, { status: 400 });
    }

    db.prepare("UPDATE users SET nsfw_display = ? WHERE id = ?").run(display, session.user.id);

    return NextResponse.json({ success: true });
}
