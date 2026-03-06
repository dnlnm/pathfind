import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import fs from "fs";
import path from "path";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify bookmark ownership
    const bookmark = db
        .prepare("SELECT archive_path FROM bookmarks WHERE id = ? AND user_id = ?")
        .get(id, session.user.id) as { archive_path: string | null } | undefined;

    if (!bookmark?.archive_path) {
        return NextResponse.json({ error: "Archive not found" }, { status: 404 });
    }

    const archivesDir = path.resolve(process.cwd(), "data", "archives");
    const filePath = path.resolve(archivesDir, bookmark.archive_path);

    if (!filePath.startsWith(archivesDir + path.sep) && filePath !== archivesDir) {
        return NextResponse.json({ error: "Invalid archive path" }, { status: 400 });
    }

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
