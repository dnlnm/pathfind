import { NextResponse, NextRequest } from "next/server";
import db, { generateId } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { parseSearchQuery } from "@/lib/search-query-parser";

export async function GET(request: NextRequest) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const collections = db.prepare(`
        SELECT c.id, c.name, c.description, c.icon, c.color, c.is_smart, c.query
        FROM collections c
        WHERE c.user_id = ?
        ORDER BY c.name ASC
    `).all(userAuth.id) as any[];

    const result = collections.map((c: any) => {
        let count = 0;

        if (c.is_smart && c.query) {
            const parsed = parseSearchQuery(c.query);
            let whereClauses = ["b.user_id = ?"];
            const params: (string | number)[] = [userAuth.id];

            // Text search terms
            const ftsQuery = parsed.textTerms.filter(t => t.length > 0).map(t => `${t}*`).join(' ');
            if (ftsQuery) {
                whereClauses.push("b.id IN (SELECT id FROM bookmarks_fts WHERE bookmarks_fts MATCH ?)");
                params.push(ftsQuery);
            }

            // Qualifiers
            for (const q of parsed.qualifiers) {
                const negated = q.negated;
                const op = negated ? "!=" : "=";
                const notIn = negated ? "NOT IN" : "IN";

                switch (q.type) {
                    case "is":
                        if (q.value === "archived") {
                            whereClauses.push(`b.is_archived ${op} 1`);
                        } else if (q.value === "readlater") {
                            whereClauses.push(`b.is_read_later ${op} 1`);
                        } else if (q.value === "nsfw") {
                            whereClauses.push(`b.is_nsfw ${op} 1`);
                        } else if (q.value === "broken") {
                            whereClauses.push(`b.link_status ${op} 'broken'`);
                        } else if (q.value === "tagged") {
                            whereClauses.push(`b.id ${notIn} (SELECT bookmark_id FROM bookmark_tags)`);
                        } else if (q.value === "incollection") {
                            whereClauses.push(`b.id ${notIn} (SELECT bookmark_id FROM bookmark_collections)`);
                        }
                        break;
                    case "has":
                        if (q.value === "notes") {
                            whereClauses.push(`(b.notes IS ${negated ? "" : "NOT"} NULL AND b.notes ${negated ? "=" : "!="} '')`);
                        } else if (q.value === "description") {
                            whereClauses.push(`(b.description IS ${negated ? "" : "NOT"} NULL AND b.description ${negated ? "=" : "!="} '')`);
                        } else if (q.value === "thumbnail") {
                            whereClauses.push(`(b.thumbnail IS ${negated ? "" : "NOT"} NULL AND b.thumbnail ${negated ? "=" : "!="} '')`);
                        }
                        break;
                    case "url":
                        whereClauses.push(`b.url ${negated ? "NOT" : ""} LIKE ?`);
                        params.push(`%${q.value}%`);
                        break;
                    case "title":
                        whereClauses.push(`b.title ${negated ? "NOT" : ""} LIKE ?`);
                        params.push(`%${q.value}%`);
                        break;
                    case "tag":
                        whereClauses.push(`b.id ${notIn} (SELECT bt.bookmark_id FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id WHERE t.name = ?)`);
                        params.push(q.value);
                        break;
                    case "collection":
                        whereClauses.push(`b.id ${notIn} (SELECT bc.bookmark_id FROM bookmark_collections bc JOIN collections c ON c.id = bc.collection_id WHERE c.name = ?)`);
                        params.push(q.value);
                        break;
                    case "after":
                        whereClauses.push(`b.created_at ${negated ? "<" : ">="} ?`);
                        params.push(q.value);
                        break;
                    case "before":
                        whereClauses.push(`b.created_at ${negated ? ">" : "<="} ?`);
                        params.push(`${q.value} 23:59:59`);
                        break;
                }
            }

            const whereStr = whereClauses.join(" AND ");
            const countRes = db.prepare(`SELECT COUNT(*) as count FROM bookmarks b WHERE ${whereStr}`).get(...params) as { count: number };
            count = countRes.count;
        } else {
            const countRes = db.prepare(`
                SELECT COUNT(*) as count FROM bookmark_collections 
                WHERE collection_id = ?
            `).get(c.id) as { count: number };
            count = countRes.count;
        }

        return {
            id: c.id,
            name: c.name,
            description: c.description,
            icon: c.icon,
            color: c.color,
            is_smart: c.is_smart,
            query: c.query,
            _count: { bookmarks: count },
        };
    });

    return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { name, description, icon, color, is_smart, query } = body;

        if (!name) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }

        // Check for existing collection with same name for this user
        const existing = db.prepare("SELECT id FROM collections WHERE name = ? COLLATE NOCASE AND user_id = ?").get(name, userAuth.id);
        if (existing) {
            return NextResponse.json({ error: "A collection with this name already exists" }, { status: 400 });
        }

        const id = generateId();
        db.prepare(`
            INSERT INTO collections (id, name, description, icon, color, is_smart, query, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, name, description || null, icon || null, color || null, is_smart ? 1 : 0, query || null, userAuth.id);

        const created = db.prepare("SELECT * FROM collections WHERE id = ?").get(id);
        return NextResponse.json(created, { status: 201 });
    } catch (error) {
        console.error("Error creating collection:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
