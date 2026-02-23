import { NextResponse, NextRequest } from "next/server";
import db, { generateId } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/api-auth";

export async function DELETE(request: NextRequest) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { ids } = await request.json();

    if (!ids || !Array.isArray(ids)) {
        return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
    }

    const deleteBookmarks = db.transaction((bookmarkIds: string[]) => {
        const stmt = db.prepare("DELETE FROM bookmarks WHERE id = ? AND user_id = ?");
        for (const id of bookmarkIds) {
            stmt.run(id, userAuth.id);
        }
    });

    deleteBookmarks(ids);

    return NextResponse.json({ success: true });
}

export async function PUT(request: NextRequest) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { ids, action, data } = await request.json();

    if (!ids || !Array.isArray(ids) || !action) {
        return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const updateBookmarks = db.transaction((bookmarkIds: string[]) => {
        if (action === "archive") {
            const stmt = db.prepare("UPDATE bookmarks SET is_archived = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?");
            const val = data?.value ? 1 : 0;
            for (const id of bookmarkIds) {
                stmt.run(val, id, userAuth.id);
            }
        } else if (action === "readLater") {
            const stmt = db.prepare("UPDATE bookmarks SET is_read_later = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?");
            const val = data?.value ? 1 : 0;
            for (const id of bookmarkIds) {
                stmt.run(val, id, userAuth.id);
            }
        } else if (action === "addTags") {
            const insertTag = db.prepare("INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)");
            const getTag = db.prepare("SELECT id FROM tags WHERE name = ?");
            const linkTag = db.prepare("INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)");

            for (const tagName of data?.tags || []) {
                const normalized = tagName.toLowerCase().trim();
                insertTag.run(generateId(), normalized);
                const tagRow = getTag.get(normalized) as { id: string };
                for (const id of bookmarkIds) {
                    linkTag.run(id, tagRow.id);
                }
            }
        } else if (action === "addToCollection") {
            const linkCollection = db.prepare("INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)");
            for (const collectionId of data?.collectionIds || []) {
                for (const id of bookmarkIds) {
                    linkCollection.run(id, collectionId);
                }
            }
        } else if (action === "removeFromCollection") {
            const stmt = db.prepare("DELETE FROM bookmark_collections WHERE bookmark_id = ? AND collection_id = ?");
            for (const collectionId of data?.collectionIds || []) {
                for (const id of bookmarkIds) {
                    stmt.run(id, collectionId);
                }
            }
        }
    });

    updateBookmarks(ids);

    return NextResponse.json({ success: true });
}
