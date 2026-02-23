import { NextResponse, NextRequest } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const result = db.prepare(`
        DELETE FROM api_tokens 
        WHERE id = ? AND user_id = ?
    `).run(id, session.user.id);

    if (result.changes === 0) {
        return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
}
