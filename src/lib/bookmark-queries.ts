import db from "@/lib/db";
import { DbBookmark, BookmarkWithTags } from "@/types";

export function getDomainFavicon(url: string): string | null {
  try {
    const domain = new URL(url).hostname;
    const row = db.prepare('SELECT favicon FROM domain_favicons WHERE domain = ?').get(domain) as { favicon: string } | undefined;
    return row?.favicon || null;
  } catch {
    return null;
  }
}

export function getTagsForBookmark(bookmarkId: string): { id: string; name: string }[] {
  return db.prepare(`
    SELECT t.id, t.name FROM tags t
    JOIN bookmark_tags bt ON bt.tag_id = t.id
    WHERE bt.bookmark_id = ?
  `).all(bookmarkId) as { id: string; name: string }[];
}

export function getCollectionsForBookmark(bookmarkId: string): { id: string; name: string; color?: string | null }[] {
  return db.prepare(`
    SELECT c.id, c.name, c.color FROM collections c
    JOIN bookmark_collections bc ON bc.collection_id = c.id
    WHERE bc.bookmark_id = ?
  `).all(bookmarkId) as { id: string; name: string; color?: string | null }[];
}

function batchGetTagsForBookmarks(bookmarkIds: string[]): Map<string, { id: string; name: string }[]> {
  const result = new Map<string, { id: string; name: string }[]>();
  if (bookmarkIds.length === 0) return result;
  for (const id of bookmarkIds) result.set(id, []);

  const placeholders = bookmarkIds.map(() => "?").join(",");
  const rows = db.prepare(`
    SELECT bt.bookmark_id, t.id, t.name FROM tags t
    JOIN bookmark_tags bt ON bt.tag_id = t.id
    WHERE bt.bookmark_id IN (${placeholders})
  `).all(...bookmarkIds) as { bookmark_id: string; id: string; name: string }[];

  for (const row of rows) {
    result.get(row.bookmark_id)!.push({ id: row.id, name: row.name });
  }
  return result;
}

function batchGetCollectionsForBookmarks(bookmarkIds: string[]): Map<string, { id: string; name: string; color?: string | null }[]> {
  const result = new Map<string, { id: string; name: string; color?: string | null }[]>();
  if (bookmarkIds.length === 0) return result;
  for (const id of bookmarkIds) result.set(id, []);

  const placeholders = bookmarkIds.map(() => "?").join(",");
  const rows = db.prepare(`
    SELECT bc.bookmark_id, c.id, c.name, c.color FROM collections c
    JOIN bookmark_collections bc ON bc.collection_id = c.id
    WHERE bc.bookmark_id IN (${placeholders})
  `).all(...bookmarkIds) as { bookmark_id: string; id: string; name: string; color?: string | null }[];

  for (const row of rows) {
    result.get(row.bookmark_id)!.push({ id: row.id, name: row.name, color: row.color });
  }
  return result;
}

export function toBookmarkWithTags(row: DbBookmark): BookmarkWithTags {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    description: row.description,
    notes: row.notes,
    favicon: getDomainFavicon(row.url),
    thumbnail: row.thumbnail,
    isArchived: !!row.is_archived,
    isReadLater: !!row.is_read_later,
    isNsfw: !!row.is_nsfw,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userId: row.user_id,
    tags: getTagsForBookmark(row.id),
    collections: getCollectionsForBookmark(row.id),
  };
}

export function toBookmarksWithTagsBatch(rows: DbBookmark[]): BookmarkWithTags[] {
  if (rows.length === 0) return [];

  const ids = rows.map(r => r.id);
  const tagsMap = batchGetTagsForBookmarks(ids);
  const collectionsMap = batchGetCollectionsForBookmarks(ids);

  return rows.map(row => ({
    id: row.id,
    url: row.url,
    title: row.title,
    description: row.description,
    notes: row.notes,
    favicon: getDomainFavicon(row.url),
    thumbnail: row.thumbnail,
    isArchived: !!row.is_archived,
    isReadLater: !!row.is_read_later,
    isNsfw: !!row.is_nsfw,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userId: row.user_id,
    tags: tagsMap.get(row.id) || [],
    collections: collectionsMap.get(row.id) || [],
  }));
}
