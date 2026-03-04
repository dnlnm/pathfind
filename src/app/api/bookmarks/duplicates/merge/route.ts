import { NextResponse, NextRequest } from "next/server";
import db from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { toBookmarkWithTags } from "@/lib/bookmark-queries";
import { DbBookmark } from "@/types";

export async function POST(request: NextRequest) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { primaryId, duplicateId } = body;

    if (!primaryId || !duplicateId) {
        return NextResponse.json({ error: "primaryId and duplicateId are required" }, { status: 400 });
    }

    if (primaryId === duplicateId) {
        return NextResponse.json({ error: "Cannot merge a bookmark with itself" }, { status: 400 });
    }

    const primary = db.prepare("SELECT * FROM bookmarks WHERE id = ? AND user_id = ?").get(primaryId, userAuth.id) as DbBookmark | undefined;
    const duplicate = db.prepare("SELECT * FROM bookmarks WHERE id = ? AND user_id = ?").get(duplicateId, userAuth.id) as DbBookmark | undefined;

    if (!primary || !duplicate) {
        return NextResponse.json({ error: "One or both bookmarks not found" }, { status: 404 });
    }

    db.transaction(() => {
        // 1. Copy tags from duplicate → primary (union)
        const dupTags = db.prepare(
            "SELECT tag_id FROM bookmark_tags WHERE bookmark_id = ?"
        ).all(duplicateId) as { tag_id: string }[];

        const linkTag = db.prepare(
            "INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)"
        );
        for (const { tag_id } of dupTags) {
            linkTag.run(primaryId, tag_id);
        }

        // 2. Copy collections from duplicate → primary (union)
        const dupCollections = db.prepare(
            "SELECT collection_id FROM bookmark_collections WHERE bookmark_id = ?"
        ).all(duplicateId) as { collection_id: string }[];

        const linkCollection = db.prepare(
            "INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)"
        );
        for (const { collection_id } of dupCollections) {
            linkCollection.run(primaryId, collection_id);
        }

        // 3. Delete the duplicate (cascades to bookmark_tags, bookmark_collections, FTS trigger, vec trigger)
        db.prepare("DELETE FROM bookmarks WHERE id = ?").run(duplicateId);
    })();

    const merged = db.prepare("SELECT * FROM bookmarks WHERE id = ?").get(primaryId) as DbBookmark;
    return NextResponse.json(toBookmarkWithTags(merged));
}
