import db from "@/lib/db";

export async function getYouTubeToken(userId: string) {
    const user = db.prepare("SELECT youtube_token, youtube_refresh_token, youtube_token_expires_at FROM users WHERE id = ?").get(userId) as any;
    
    if (!user || !user.youtube_token) return null;

    // Refresh if expired (with 1 min buffer)
    if (Date.now() > (user.youtube_token_expires_at - 60000)) {
        if (!user.youtube_refresh_token) return null;

        try {
            const res = await fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    client_id: process.env.GOOGLE_CLIENT_ID!,
                    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                    refresh_token: user.youtube_refresh_token,
                    grant_type: "refresh_token",
                }),
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            const expiresAt = Date.now() + data.expires_in * 1000;
            // Note: refresh_token might not be returned again, keep the old one if so
            const newRefreshToken = data.refresh_token || user.youtube_refresh_token;

            db.prepare(`
                UPDATE users SET 
                    youtube_token = ?, 
                    youtube_refresh_token = ?, 
                    youtube_token_expires_at = ?,
                    updated_at = datetime('now')
                WHERE id = ?
            `).run(data.access_token, newRefreshToken, expiresAt, userId);

            return data.access_token as string;
        } catch (e) {
            console.error("Failed to refresh YouTube token:", e);
            return null;
        }
    }

    return user.youtube_token as string;
}

export async function fetchYouTubePlaylists(token: string) {
    let playlists: any[] = [];
    let nextPageToken: string | null = null;

    do {
        const url: string = `https://www.googleapis.com/youtube/v3/playlists?` +
            `part=snippet,contentDetails&` +
            `mine=true&` +
            `maxResults=50` +
            (nextPageToken ? `&pageToken=${nextPageToken}` : "");

        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error?.message || "Failed to fetch playlists");
        }

        const data = await res.json();
        playlists = [...playlists, ...data.items];
        nextPageToken = data.nextPageToken;
    } while (nextPageToken);

    return playlists;
}

export async function fetchPlaylistItems(playlistId: string, token: string) {
    let items: any[] = [];
    let nextPageToken: string | null = null;

    do {
        const url: string = `https://www.googleapis.com/youtube/v3/playlistItems?` +
            `part=snippet,contentDetails&` +
            `playlistId=${playlistId}&` +
            `maxResults=50` +
            (nextPageToken ? `&pageToken=${nextPageToken}` : "");

        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error?.message || "Failed to fetch playlist items");
        }

        const data = await res.json();
        items = [...items, ...data.items];
        nextPageToken = data.nextPageToken;
    } while (nextPageToken);

    return items;
}
