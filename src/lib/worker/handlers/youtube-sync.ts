import db, { generateId } from "../../db";
import { logDebug } from "../logger";
import { getYouTubeToken, fetchPlaylistItems, fetchYouTubePlaylists } from "../../youtube-client";
import { normalizeUrl } from "../../url-normalizer";
import { saveThumbnailFromUrl } from "../../thumbnail-store";

export async function handleYoutubePlaylistSync(job: any, payload: any) {
    const { userId } = payload;
    
    logDebug(`[Worker] Starting YouTube sync for user ${userId}`);

    const token = await getYouTubeToken(userId);
    if (!token) {
        throw new Error("YouTube token not found or could not be refreshed");
    }

    const user = db.prepare("SELECT youtube_playlists_sync FROM users WHERE id = ?").get(userId) as any;
    const selectedPlaylistIds = user?.youtube_playlists_sync ? JSON.parse(user.youtube_playlists_sync) : [];

    if (!Array.isArray(selectedPlaylistIds) || selectedPlaylistIds.length === 0) {
        logDebug(`[Worker] No playlists selected for sync for user ${userId}`);
        return;
    }

    // Fetch all playlists to get their names (to create collections)
    const allPlaylists = await fetchYouTubePlaylists(token);
    const selectedPlaylists = allPlaylists.filter((p: any) => selectedPlaylistIds.includes(p.id));

    let totalSynced = 0;

    for (const playlist of selectedPlaylists) {
        logDebug(`[Worker] Syncing playlist: ${playlist.snippet.title} (${playlist.id})`);

        // 1. Get or Create Collection
        let collectionId: string;
        const existingCollection = db.prepare("SELECT id FROM collections WHERE name = ? AND user_id = ?").get(playlist.snippet.title, userId) as { id: string } | undefined;
        
        if (existingCollection) {
            collectionId = existingCollection.id;
        } else {
            collectionId = generateId();
            db.prepare(`
                INSERT INTO collections (id, name, description, user_id, updated_at)
                VALUES (?, ?, ?, ?, datetime('now'))
            `).run(collectionId, playlist.snippet.title, `YouTube Playlist: ${playlist.snippet.title}`, userId);
        }

        // 2. Fetch Playlist Items
        const items = await fetchPlaylistItems(playlist.id, token);
        logDebug(`[Worker] Found ${items.length} items in playlist ${playlist.snippet.title}`);

        const insertBookmark = db.prepare(`
            INSERT INTO bookmarks (id, url, canonical_url, title, description, thumbnail, user_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const updateThumbnail = db.prepare("UPDATE bookmarks SET thumbnail = ? WHERE id = ?");
        const linkCollection = db.prepare("INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)");
        const checkExisting = db.prepare("SELECT id, thumbnail FROM bookmarks WHERE canonical_url = ? AND user_id = ?");

        const thumbnailsToFetch: { bookmarkId: string, url: string }[] = [];

        const playlistTransaction = db.transaction(() => {
            for (const item of items) {
                const videoId = item.contentDetails.videoId;
                if (!videoId) continue; // Skip if no videoId (e.g. deleted video)

                const url = `https://www.youtube.com/watch?v=${videoId}`;
                const canonicalUrl = normalizeUrl(url);
                
                // Get best available thumbnail
                const thumbnails = item.snippet.thumbnails || {};
                const thumbnailUrl = thumbnails.maxres?.url || thumbnails.standard?.url || thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url || null;

                const existing = checkExisting.get(canonicalUrl, userId) as { id: string, thumbnail: string | null } | undefined;
                let bookmarkId: string;

                if (existing) {
                    bookmarkId = existing.id;
                    // Proactively update thumbnail if missing in DB or if it is an external URL
                    if ((!existing.thumbnail || existing.thumbnail.startsWith('http')) && thumbnailUrl) {
                        thumbnailsToFetch.push({ bookmarkId, url: thumbnailUrl });
                    }
                } else {
                    bookmarkId = generateId();
                    insertBookmark.run(
                        bookmarkId,
                        url,
                        canonicalUrl,
                        item.snippet.title,
                        item.snippet.description || null,
                        thumbnailUrl,
                        userId,
                        item.contentDetails.videoPublishedAt || new Date().toISOString() // Fallback to now
                    );

                    if (thumbnailUrl) {
                        thumbnailsToFetch.push({ bookmarkId, url: thumbnailUrl });
                    }

                    // Add a job for embedding and further metadata fetch
                    const metadataJobId = generateId();
                    db.prepare(`
                        INSERT INTO jobs (id, type, payload, status, user_id)
                        VALUES (?, 'metadata_fetch', ?, 'pending', ?)
                    `).run(metadataJobId, JSON.stringify({ bookmarkId }), userId);

                    totalSynced++;
                }

                // Link to collection
                linkCollection.run(bookmarkId, collectionId);
            }
        });

        playlistTransaction();

        for (const task of thumbnailsToFetch) {
            try {
                const localPath = await saveThumbnailFromUrl(task.bookmarkId, task.url);
                if (localPath) {
                    updateThumbnail.run(localPath, task.bookmarkId);
                }
            } catch (err) {
                logDebug(`[Worker] Failed to save YouTube sync thumbnail for ${task.bookmarkId}: ` + err);
            }
        }
    }

    db.prepare("UPDATE users SET last_youtube_sync_at = datetime('now') WHERE id = ?").run(userId);
    logDebug(`[Worker] YouTube sync completed for user ${userId}. Total new bookmarks: ${totalSynced}`);
}
