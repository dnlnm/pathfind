import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db, { generateId } from "@/lib/db";

export async function POST() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = db.prepare("SELECT github_token FROM users WHERE id = ?").get(session.user.id) as { github_token: string | null };

    if (!user?.github_token) {
        return NextResponse.json({ error: "GitHub token not configured" }, { status: 400 });
    }

    try {
        const response = await fetch("https://api.github.com/user/starred", {
            headers: {
                Authorization: `token ${user.github_token}`,
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "PathFind-App",
            },
        });

        if (!response.ok) {
            const err = await response.text();
            return NextResponse.json({ error: `GitHub API error: ${err}` }, { status: response.status });
        }

        const stars = await response.json();
        let syncedCount = 0;

        // Ensure "github" tag exists
        const githubTagId = generateId();
        db.prepare("INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)").run(githubTagId, "github");
        const tagRow = db.prepare("SELECT id FROM tags WHERE name = ?").get("github") as { id: string };

        const insertBookmark = db.prepare(`
            INSERT INTO bookmarks (id, url, title, description, user_id)
            VALUES (?, ?, ?, ?, ?)
        `);
        const linkTag = db.prepare("INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)");
        const checkExisting = db.prepare("SELECT id FROM bookmarks WHERE url = ? AND user_id = ?");

        const syncTransaction = db.transaction(() => {
            for (const repo of stars) {
                const existing = checkExisting.get(repo.html_url, session.user!.id!);
                if (existing) continue;

                const bmId = generateId();
                insertBookmark.run(
                    bmId,
                    repo.html_url,
                    repo.full_name,
                    repo.description || null,
                    session.user!.id!
                );

                linkTag.run(bmId, tagRow.id);
                syncedCount++;
            }
        });

        syncTransaction();

        return NextResponse.json({ count: syncedCount, total: stars.length });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
