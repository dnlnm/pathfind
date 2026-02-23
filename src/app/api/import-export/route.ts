import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db, { generateId } from "@/lib/db";

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bookmarks = db.prepare(`
    SELECT * FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC
  `).all(session.user.id) as { id: string; url: string; title: string | null; description: string | null; created_at: string }[];

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

    const { html } = await request.json();
    if (!html) {
        return NextResponse.json({ error: "HTML content required" }, { status: 400 });
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
    const insertTag = db.prepare("INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)");
    const getTag = db.prepare("SELECT id FROM tags WHERE name = ?");
    const linkTag = db.prepare("INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)");
    const checkExisting = db.prepare("SELECT id FROM bookmarks WHERE url = ? AND user_id = ?");

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
            count++;
        }
    });

    importAll();

    return NextResponse.json({ count, total: bookmarksToImport.length });
}
