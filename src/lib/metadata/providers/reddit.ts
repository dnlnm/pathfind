import { decodeHtml } from "../utils";
import { FetchedMetadata, MetadataProvider } from "../types";

export class RedditProvider implements MetadataProvider {
    name = "reddit";
    priority = 10;

    match(url: URL): boolean {
        return url.hostname.includes("reddit.com");
    }

    async fetch(url: URL, options?: { signal?: AbortSignal }): Promise<FetchedMetadata | null> {
        try {
            console.log(`[Metadata] Reddit Provider: ${url.href}`);
            let resolvedUrl = url.href;

            const isShareLink = /\/s\/[a-zA-Z0-9]+\/?$/.test(url.pathname);
            if (isShareLink) {
                console.log(`[Metadata] Reddit share link detected, resolving redirect...`);
                const headRes = await fetch(url.href, {
                    method: "GET",
                    redirect: "follow",
                    signal: options?.signal,
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    },
                });
                resolvedUrl = headRes.url;
                console.log(`[Metadata] Resolved Reddit URL: ${resolvedUrl}`);
            }

            let redditJsonUrl = resolvedUrl.replace(/\?.*$/, "");
            redditJsonUrl = redditJsonUrl.replace(/\/$/, "") + ".json";

            console.log(`[Metadata] Reddit JSON URL: ${redditJsonUrl}`);

            const jsonRes = await fetch(redditJsonUrl, {
                signal: options?.signal,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "application/json"
                }
            });

            if (!jsonRes.ok) {
                console.warn(`[Metadata] Reddit JSON failed with status: ${jsonRes.status}`);
                return null;
            }

            const data = await jsonRes.json();
            const postData = this.extractPostData(data);

            if (!postData) return null;

            const title = decodeHtml(postData.title || postData.display_name_prefixed || postData.name || "");
            const thumbnailUrl = this.extractThumbnail(postData);

            const result: FetchedMetadata = {
                title,
                description: postData.selftext?.substring(0, 200) || postData.public_description || postData.description?.substring(0, 200) || null,
                favicon: "https://www.reddit.com/favicon.ico",
                thumbnailUrl,
                fallbackThumbnail: title
                    ? `/api/thumbnails/generate?title=${encodeURIComponent(title)}&domain=reddit.com`
                    : null,
                isNsfw: !!postData.over_18
            };

            console.log(`[Metadata] Reddit JSON Success:`, result.title);
            return result;
        } catch (e) {
            console.error("[Metadata] Reddit Provider failed", e);
            return null;
        }
    }

    private extractPostData(data: any) {
        if (Array.isArray(data)) {
            return data[0]?.data?.children[0]?.data;
        } else if (data?.data?.children && data.data.children.length > 0) {
            return data.data.children[0].data;
        } else if (data?.kind === "t5") {
            return data.data;
        }
        return null;
    }

    private extractThumbnail(postData: any): string | null {
        let thumbnailUrl = null;

        if (postData.is_gallery && postData.media_metadata) {
            const firstMediaId = Object.keys(postData.media_metadata)[0];
            const firstMedia = postData.media_metadata[firstMediaId];
            if (firstMedia?.s?.u) {
                thumbnailUrl = decodeHtml(firstMedia.s.u);
            }
        }

        if (!thumbnailUrl) {
            const media = postData.secure_media || postData.media;
            if (media?.oembed?.thumbnail_url) {
                thumbnailUrl = media.oembed.thumbnail_url;
            }
        }

        if (!thumbnailUrl) {
            thumbnailUrl = postData.preview?.images[0]?.source?.url ? decodeHtml(postData.preview.images[0].source.url) :
                (postData.thumbnail?.startsWith("http") ? postData.thumbnail : null);
        }

        return thumbnailUrl;
    }
}
