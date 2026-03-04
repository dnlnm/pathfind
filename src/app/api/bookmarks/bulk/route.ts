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

    let affected = 0;
    const deleteBookmarks = db.transaction((bookmarkIds: string[]) => {
        const stmt = db.prepare("DELETE FROM bookmarks WHERE id = ? AND user_id = ?");
        for (const id of bookmarkIds) {
            const result = stmt.run(id, userAuth.id);
            affected += result.changes;
        }
    });

    deleteBookmarks(ids);

    return NextResponse.json({ success: true, affected });
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

    const knownActions = ["archive", "readLater", "addTags", "addToCollection", "removeFromCollection"];
    if (!knownActions.includes(action)) {
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    let affected = 0;
    const updateBookmarks = db.transaction((bookmarkIds: string[]) => {
        if (action === "archive") {
            const stmt = db.prepare("UPDATE bookmarks SET is_archived = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?");
            const val = data?.value ? 1 : 0;
            for (const id of bookmarkIds) {
                const result = stmt.run(val, id, userAuth.id);
                affected += result.changes;
            }
        } else if (action === "readLater") {
            const stmt = db.prepare("UPDATE bookmarks SET is_read_later = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?");
            const val = data?.value ? 1 : 0;
            for (const id of bookmarkIds) {
                const result = stmt.run(val, id, userAuth.id);
                affected += result.changes;
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
                    affected++;
                }
            }
        } else if (action === "addToCollection") {
            const linkCollection = db.prepare("INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)");
            for (const collectionId of data?.collectionIds || []) {
                for (const id of bookmarkIds) {
                    const result = linkCollection.run(id, collectionId);
                    affected += result.changes;
                }
            }
        } else if (action === "removeFromCollection") {
            const stmt = db.prepare("DELETE FROM bookmark_collections WHERE bookmark_id = ? AND collection_id = ?");
            for (const collectionId of data?.collectionIds || []) {
                for (const id of bookmarkIds) {
                    const result = stmt.run(id, collectionId);
                    affected += result.changes;
                }
            }
        }
    });

    updateBookmarks(ids);

    return NextResponse.json({ success: true, affected });
}
