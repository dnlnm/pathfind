import { NextResponse, NextRequest } from "next/server";
import db, { generateId } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const collections = db.prepare(`
    SELECT c.id, c.name, c.description, c.icon, c.color, COUNT(bc.bookmark_id) as count
    FROM collections c
    LEFT JOIN bookmark_collections bc ON bc.collection_id = c.id
    WHERE c.user_id = ?
    GROUP BY c.id
    ORDER BY c.name ASC
  `).all(userAuth.id);

    return NextResponse.json(collections.map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        icon: c.icon,
        color: c.color,
        _count: { bookmarks: c.count },
    })));
}

export async function POST(request: NextRequest) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { name, description, icon, color } = body;

        if (!name) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }

        const id = generateId();
        db.prepare(`
            INSERT INTO collections (id, name, description, icon, color, user_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, name, description || null, icon || null, color || null, userAuth.id);

        const created = db.prepare("SELECT * FROM collections WHERE id = ?").get(id);
        return NextResponse.json(created, { status: 201 });
    } catch (error) {
        console.error("Error creating collection:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
