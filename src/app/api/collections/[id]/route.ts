import { NextResponse, NextRequest } from "next/server";
import db from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/api-auth";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const userAuth = await getAuthenticatedUser(request);
    const { id } = await params;

    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const collection = db.prepare("SELECT * FROM collections WHERE id = ? AND user_id = ?").get(id, userAuth.id);

    if (!collection) {
        return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    return NextResponse.json(collection);
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const userAuth = await getAuthenticatedUser(request);
    const { id } = await params;

    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { name, description, icon, color, is_smart, query } = body;

        const collection = db.prepare("SELECT id FROM collections WHERE id = ? AND user_id = ?").get(id, userAuth.id);
        if (!collection) {
            return NextResponse.json({ error: "Collection not found" }, { status: 404 });
        }

        if (name) {
            const existing = db.prepare("SELECT id FROM collections WHERE name = ? COLLATE NOCASE AND user_id = ? AND id != ?").get(name, userAuth.id, id);
            if (existing) {
                return NextResponse.json({ error: "A collection with this name already exists" }, { status: 400 });
            }
        }

        db.prepare(`
            UPDATE collections 
            SET name = COALESCE(?, name), 
                description = COALESCE(?, description),
                icon = COALESCE(?, icon),
                color = COALESCE(?, color),
                is_smart = COALESCE(?, is_smart),
                query = COALESCE(?, query),
                updated_at = datetime('now')
            WHERE id = ?
        `).run(name, description, icon, color, is_smart !== undefined ? (is_smart ? 1 : 0) : null, query, id);

        const updated = db.prepare("SELECT * FROM collections WHERE id = ?").get(id);
        return NextResponse.json(updated);
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const userAuth = await getAuthenticatedUser(request);
    const { id } = await params;

    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const collection = db.prepare("SELECT id FROM collections WHERE id = ? AND user_id = ?").get(id, userAuth.id);
    if (!collection) {
        return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    db.prepare("DELETE FROM bookmark_collections WHERE collection_id = ?").run(id);
    db.prepare("DELETE FROM collections WHERE id = ?").run(id);

    return NextResponse.json({ success: true });
}
