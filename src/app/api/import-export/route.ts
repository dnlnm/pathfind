import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db, { generateId, upsertDomainFavicon } from "@/lib/db";
import { evaluateRules } from "@/lib/rule-engine";
import { DbBookmark } from "@/types";

export async function GET(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bookmarks = db.prepare(`
    SELECT * FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC
  `).all(session.user.id) as any[];

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "html";
    const includeThumbnails = searchParams.get("includeThumbnails") === "true";

    if (format === "json") {
        const exportData = [];
        for (const bm of bookmarks) {
            const tagRows = db.prepare(`
        SELECT t.name FROM tags t JOIN bookmark_tags bt ON bt.tag_id = t.id WHERE bt.bookmark_id = ?
      `).all(bm.id) as { name: string }[];
            const tags = tagRows.map(t => t.name);

            const { id, user_id, link_status, link_status_code, link_checked_at, ...cleanBookmark } = bm;

            const exportItem: any = {
                ...cleanBookmark,
                tags,
            };

            if (includeThumbnails && bm.thumbnail) {
                exportItem.thumbnail = bm.thumbnail;
            }

            exportData.push(exportItem);
        }

        return new NextResponse(JSON.stringify(exportData, null, 2), {
            headers: {
                "Content-Type": "application/json",
                "Content-Disposition": `attachment; filename="pathfind-bookmarks.json"`,
            },
        });
    }

    let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file. -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>PathFind Bookmarks</TITLE>
<H1>PathFind Bookmarks</H1>
<DL><p>\n`;

    for (const bm of bookmarks) {
        const timestamp = Math.floor(new Date(bm.created_at).getTime() / 1000);
        const tagRows = db.prepare(`
      SELECT t.name FROM tags t JOIN bookmark_tags bt ON bt.tag_id = t.id WHERE bt.bookmark_id = ?
    `).all(bm.id) as { name: string }[];
        const tags = tagRows.map(t => t.name).join(",");

        html += `    <DT><A HREF="${bm.url}" ADD_DATE="${timestamp}"`;
        if (tags) html += ` TAGS="${tags}"`;
        html += `>${bm.title || bm.url}</A>\n`;
        if (bm.description) {
            html += `    <DD>${bm.description}\n`;
        }
    }

    html += `</DL><p>`;

    return new NextResponse(html, {
        headers: {
            "Content-Type": "text/html",
            "Content-Disposition": `attachment; filename="pathfind-bookmarks.html"`,
        },
    });
}

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { html, json } = await request.json();
    if (!html && !json) {
        return NextResponse.json({ error: "Content required" }, { status: 400 });
    }

    const insertTag = db.prepare("INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)");
    const getTag = db.prepare("SELECT id FROM tags WHERE name = ?");
    const linkTag = db.prepare("INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)");
    const checkExisting = db.prepare("SELECT id FROM bookmarks WHERE url = ? AND user_id = ?");

    if (json) {
        let parsedJson = [];
        try {
            parsedJson = typeof json === "string" ? JSON.parse(json) : json;
        } catch (e) {
            return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
        }

        let count = 0;
        const insertFullBookmark = db.prepare(`
            INSERT INTO bookmarks (id, url, title, description, notes, thumbnail, is_archived, is_read_later, user_id, is_nsfw)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const importAllJson = db.transaction(() => {
            for (const bm of parsedJson) {
                const existing = checkExisting.get(bm.url, session.user!.id!);
                if (existing) continue;

                const bmId = generateId();
                insertFullBookmark.run(
                    bmId, bm.url, bm.title || null, bm.description || null, bm.notes || null,
                    bm.thumbnail || null, bm.is_archived || 0, bm.is_read_later || 0,
                    session.user!.id!, bm.is_nsfw || 0
                );

                if (bm.tags && Array.isArray(bm.tags)) {
                    for (const tagName of bm.tags) {
                        insertTag.run(generateId(), tagName);
                        const tagRow = getTag.get(tagName) as { id: string };
                        linkTag.run(bmId, tagRow.id);
                    }
                }

                db.prepare(`
                    INSERT INTO jobs (id, type, payload, user_id)
                    VALUES (?, ?, ?, ?)
                `).run(generateId(), 'backfill_embeddings', JSON.stringify({ bookmarkId: bmId }), session.user!.id!);

                try {
                    const bookmark = db.prepare("SELECT * FROM bookmarks WHERE id = ?").get(bmId) as DbBookmark;
                    if (bookmark) {
                        evaluateRules("bookmark.created", bookmark, session.user!.id!);
                    }
                } catch (e) {
                    console.error("[Import] Error during rule evaluation:", e);
                }

                count++;
            }
        });

        importAllJson();
        return NextResponse.json({ count, total: parsedJson.length });
    }

    const linkRegex = /<A\s+HREF="([^"]*)"[^>]*(?:TAGS="([^"]*)")?[^>]*>([^<]*)<\/A>/gi;
    const bookmarksToImport: { url: string; title: string; tags: string[] }[] = [];

    let match;
    while ((match = linkRegex.exec(html)) !== null) {
        bookmarksToImport.push({
            url: match[1],
            tags: match[2] ? match[2].split(",").map(t => t.trim().toLowerCase()).filter(Boolean) : [],
            title: match[3],
        });
    }

    let count = 0;
    const insertBookmark = db.prepare("INSERT INTO bookmarks (id, url, title, user_id) VALUES (?, ?, ?, ?)");

    const importAll = db.transaction(() => {
        for (const bm of bookmarksToImport) {
            const existing = checkExisting.get(bm.url, session.user!.id!);
            if (existing) continue;

            const bmId = generateId();
            insertBookmark.run(bmId, bm.url, bm.title || null, session.user!.id!);

            // Create a background job to fetch metadata (description, thumbnail, favicon, etc.)
            db.prepare(`
                INSERT INTO jobs (id, type, payload, user_id)
                VALUES (?, ?, ?, ?)
            `).run(generateId(), 'metadata_fetch', JSON.stringify({ bookmarkId: bmId }), session.user!.id!);

            for (const tagName of bm.tags) {
                insertTag.run(generateId(), tagName);
                const tagRow = getTag.get(tagName) as { id: string };
                linkTag.run(bmId, tagRow.id);
            }

            // Run rules for each newly imported bookmark
            try {
                const bookmark = db.prepare("SELECT * FROM bookmarks WHERE id = ?").get(bmId) as DbBookmark;
                if (bookmark) {
                    evaluateRules("bookmark.created", bookmark, session.user!.id!);
                }
            } catch (e) {
                console.error("[Import] Error during rule evaluation:", e);
            }

            count++;
        }
    });

    importAll();

    return NextResponse.json({ count, total: bookmarksToImport.length });
}
