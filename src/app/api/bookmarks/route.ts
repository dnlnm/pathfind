import { NextResponse, NextRequest } from "next/server";
import db, { generateId, upsertDomainFavicon } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { fetchUrlMetadata } from "@/lib/metadata-fetcher";
import { generateEmbedding } from "@/lib/gemini";
import { evaluateRules } from "@/lib/rule-engine";
import { normalizeUrl } from "@/lib/url-normalizer";
import { saveThumbnailFromUrl } from "@/lib/thumbnail-store";
import { DbBookmark } from "@/types";
import { toBookmarkWithTags, toBookmarksWithTagsBatch } from "@/lib/bookmark-queries";

import { parseSearchQuery } from "@/lib/search-query-parser";

export async function GET(request: NextRequest) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = db.prepare("SELECT pagination_limit FROM users WHERE id = ?").get(userAuth.id) as { pagination_limit: number };
    const defaultLimit = user?.pagination_limit || 30;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const tag = searchParams.get("tag") || "";
    const collectionId = searchParams.get("collection");
    const filter = searchParams.get("filter") || "all";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(200, Math.max(0, parseInt(searchParams.get("limit") || String(defaultLimit)) || defaultLimit));
    const sort = searchParams.get("sort") || "newest";
    const offset = (page - 1) * limit;

    let whereClauses = ["b.user_id = ?"];
    const params: (string | number)[] = [userAuth.id];

    // Default filters
    let explicitArchived = false;
    let explicitReadLater = false;

    if (query) {
        const parsed = parseSearchQuery(query);

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
                        explicitArchived = true;
                    } else if (q.value === "readlater") {
                        whereClauses.push(`b.is_read_later ${op} 1`);
                        explicitReadLater = true;
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
    }

    // Apply sidebar/fallback filters only if not overridden by query qualifiers
    if (!explicitArchived) {
        if (filter === "archived") {
            whereClauses.push("b.is_archived = 1");
        } else {
            whereClauses.push("b.is_archived = 0");
        }
    }

    if (!explicitReadLater && filter === "readlater") {
        whereClauses.push("b.is_read_later = 1");
    }

    if (tag) {
        whereClauses.push("b.id IN (SELECT bt.bookmark_id FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id WHERE t.name = ?)");
        params.push(tag);
    }

    if (collectionId) {
        const collection = db.prepare("SELECT * FROM collections WHERE id = ? AND user_id = ?").get(collectionId, userAuth.id) as any;
        if (collection) {
            if (collection.is_smart && collection.query) {
                const smartParsed = parseSearchQuery(collection.query);

                // Merge text terms (simplified)
                const smartFtsQuery = smartParsed.textTerms.filter(t => t.length > 0).map(t => `${t}*`).join(' ');
                if (smartFtsQuery) {
                    whereClauses.push("b.id IN (SELECT id FROM bookmarks_fts WHERE bookmarks_fts MATCH ?)");
                    params.push(smartFtsQuery);
                }

                // Merge qualifiers
                for (const q of smartParsed.qualifiers) {
                    const negated = q.negated;
                    const op = negated ? "!=" : "=";
                    const notIn = negated ? "NOT IN" : "IN";

                    switch (q.type) {
                        case "is":
                            if (q.value === "archived") {
                                whereClauses.push(`b.is_archived ${op} 1`);
                                explicitArchived = true;
                            } else if (q.value === "readlater") {
                                whereClauses.push(`b.is_read_later ${op} 1`);
                                explicitReadLater = true;
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
            } else {
                whereClauses.push("b.id IN (SELECT bc.bookmark_id FROM bookmark_collections bc WHERE bc.collection_id = ?)");
                params.push(collectionId);
            }
        }
    }

    const nsfwFilter = searchParams.get("nsfw") || "";
    if (nsfwFilter === "only") {
        whereClauses.push("b.is_nsfw = 1");
    }

    const whereStr = whereClauses.join(" AND ");

    // Map sort parameter to SQL ORDER BY
    let orderBy = "b.created_at DESC";
    if (sort === "oldest") orderBy = "b.created_at ASC";
    else if (sort === "title_asc") orderBy = "b.title COLLATE NOCASE ASC";
    else if (sort === "title_desc") orderBy = "b.title COLLATE NOCASE DESC";

    const total = (db.prepare(`SELECT COUNT(*) as count FROM bookmarks b WHERE ${whereStr}`).get(...params) as { count: number }).count;

    const rows = db.prepare(`
    SELECT b.* FROM bookmarks b
    WHERE ${whereStr}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as DbBookmark[];

    const bookmarks = toBookmarksWithTagsBatch(rows);

    return NextResponse.json({
        bookmarks,
        total,
        page,
        totalPages: Math.ceil(total / limit),
    });
}

export async function POST(request: NextRequest) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { url, title, description, notes, tags, isReadLater, isNsfw, thumbnail } = body;

    if (!url) {
        return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const canonicalUrl = normalizeUrl(url);

    const existing = db.prepare("SELECT * FROM bookmarks WHERE canonical_url = ? AND user_id = ?").get(canonicalUrl, userAuth.id) as DbBookmark | undefined;

    // Auto-fetch metadata if any info is missing
    let finalTitle = title || (existing?.title) || null;
    let finalDescription = description || (existing?.description) || null;
    let finalThumbnail = thumbnail || (existing?.thumbnail) || null;
    let finalIsNsfw = isNsfw !== undefined ? isNsfw : (existing ? !!existing.is_nsfw : false);
    const isReddit = url && url.includes("reddit.com");

    // We fetch metadata if anything is missing, OR if it's a Reddit link and the client didn't explicitly send isNsfw as true.
    // This allows us to "promote" a default `false` from the UI to `true` if Reddit says it's 18+.
    let thumbnailUrl: string | null = null;
    if (!finalTitle || !finalDescription || !finalThumbnail || (isReddit && isNsfw === false)) {
        const fetched = await fetchUrlMetadata(url);
        finalTitle = finalTitle || fetched.title;
        finalDescription = finalDescription || fetched.description;
        if (fetched.favicon) {
            upsertDomainFavicon(url, fetched.favicon);
        }
        if (!finalThumbnail) {
            // Save the raw thumbnail URL; we'll persist it as a file after we have the bookmark ID
            thumbnailUrl = fetched.thumbnailUrl;
            finalThumbnail = fetched.fallbackThumbnail; // SVG fallback for now
        }
        if ((isNsfw === undefined || isNsfw === false) && fetched.isNsfw === true) {
            finalIsNsfw = true;
        }
    }

    let id: string = '';
    let isUpdate = false;

    const createOrUpdate = db.transaction(() => {
        if (existing) {
            id = existing.id;
            isUpdate = true;

            let finalNotes = notes !== undefined ? notes : existing.notes;

            db.prepare(`
                UPDATE bookmarks 
                SET title = ?, description = ?, notes = ?, thumbnail = ?, is_read_later = ?, is_nsfw = ?, updated_at = datetime('now')
                WHERE id = ?
            `).run(finalTitle, finalDescription, finalNotes, finalThumbnail, isReadLater !== undefined ? (isReadLater ? 1 : 0) : existing.is_read_later, finalIsNsfw ? 1 : 0, id!);

            if (body.tags !== undefined) {
                db.prepare("DELETE FROM bookmark_tags WHERE bookmark_id = ?").run(id!);
            }
            if (body.collections !== undefined) {
                db.prepare("DELETE FROM bookmark_collections WHERE bookmark_id = ?").run(id!);
            }
        } else {
            id = generateId();
            db.prepare(`
                INSERT INTO bookmarks (id, url, canonical_url, title, description, notes, thumbnail, is_read_later, is_nsfw, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(id!, url, canonicalUrl, finalTitle, finalDescription, notes || null, finalThumbnail, isReadLater ? 1 : 0, finalIsNsfw ? 1 : 0, userAuth.id);
        }

        if ((!isUpdate || body.tags !== undefined) && tags && tags.length > 0) {
            const insertTag = db.prepare("INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)");
            const getTag = db.prepare("SELECT id FROM tags WHERE name = ?");
            const linkTag = db.prepare("INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)");

            for (const tagName of tags) {
                const normalized = tagName.toLowerCase().trim();
                insertTag.run(generateId(), normalized);
                const tagRow = getTag.get(normalized) as { id: string };
                linkTag.run(id!, tagRow.id);
            }
        }

        if ((!isUpdate || body.collections !== undefined) && body.collections && body.collections.length > 0) {
            const linkCollection = db.prepare("INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)");
            for (const collectionId of body.collections) {
                linkCollection.run(id!, collectionId);
            }
        }
    });

    createOrUpdate();

    // Save thumbnail to disk after transaction (we need the bookmark ID)
    // Thumbnail can be: a file path from upload endpoint ("thumbnails/..."),
    // an HTTP URL from metadata preview, or fetched from metadata
    if (thumbnail && thumbnail.startsWith('http')) {
        const savedPath = await saveThumbnailFromUrl(id, thumbnail);
        if (savedPath) {
            db.prepare('UPDATE bookmarks SET thumbnail = ? WHERE id = ?').run(savedPath, id);
        }
    } else if (thumbnailUrl) {
        const savedPath = await saveThumbnailFromUrl(id, thumbnailUrl);
        if (savedPath) {
            db.prepare('UPDATE bookmarks SET thumbnail = ? WHERE id = ?').run(savedPath, id);
        }
    }

    // Evaluate rule engine
    const bookmarkForRules = db.prepare("SELECT * FROM bookmarks WHERE id = ?").get(id) as DbBookmark;
    const ruleEvent = isUpdate ? "bookmark.updated" : "bookmark.created";
    try {
        evaluateRules(ruleEvent, bookmarkForRules, userAuth.id);
    } catch (e) {
        console.error("[RuleEngine] Error during rule evaluation:", e);
    }

    const created = db.prepare("SELECT * FROM bookmarks WHERE id = ?").get(id) as DbBookmark;

    // Asynchronously generate embedding in the background
    (async () => {
        try {
            const textToEmbed = `${finalTitle || ''} ${finalDescription || ''} ${notes || ''}`.trim();
            if (textToEmbed) {
                const embedding = await generateEmbedding(textToEmbed);
                if (embedding) {
                    const row = db.prepare("SELECT rowid FROM bookmarks WHERE id = ?").get(id) as { rowid: number };
                    if (row) {
                        const f32arr = new Float32Array(embedding);
                        db.prepare("DELETE FROM vec_bookmarks WHERE rowid = ?").run(BigInt(row.rowid));
                        db.prepare("INSERT INTO vec_bookmarks(rowid, embedding) VALUES (?, ?)").run(BigInt(row.rowid), f32arr);
                    }
                }
            }
        } catch (error) {
            console.error("Background embedding failed:", error);
        }
    })();

    return NextResponse.json({ ...toBookmarkWithTags(created), isUpdate }, { status: isUpdate ? 200 : 201 });
}
