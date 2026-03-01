import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import fs from "fs";
import path from "path";

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    // Verify bookmark ownership
    const bookmark = db
        .prepare("SELECT archive_path FROM bookmarks WHERE id = ? AND user_id = ?")
        .get(id, session.user.id) as { archive_path: string | null } | undefined;

    if (!bookmark?.archive_path) {
        return NextResponse.json({ error: "Archive not found" }, { status: 404 });
    }

    const archivesDir = path.join(process.cwd(), "data", "archives");
    const filePath = path.join(archivesDir, bookmark.archive_path);

    if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: "File not found on server" }, { status: 404 });
    }

    const content = fs.readFileSync(filePath);

    return new NextResponse(content, {
        headers: {
            "Content-Type": "text/html",
            // Optional: force download vs inline view
            // "Content-Disposition": `attachment; filename="${bookmark.archive_path}"`
        },
    });
}
