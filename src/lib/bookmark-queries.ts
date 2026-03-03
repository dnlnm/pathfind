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
