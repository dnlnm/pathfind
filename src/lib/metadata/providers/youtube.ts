import { decodeHtml } from "../utils";
import { FetchedMetadata, MetadataProvider } from "../types";

export class YouTubeProvider implements MetadataProvider {
    name = "youtube";
    priority = 10;

    match(url: URL): boolean {
        return url.hostname.includes("youtube.com") || url.hostname.includes("youtu.be");
    }

    async fetch(url: URL, options?: { signal?: AbortSignal }): Promise<FetchedMetadata | null> {
        try {
            console.log(`[Metadata] YouTube Provider: ${url.href}`);
            const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url.href)}&format=json`;
            const oembedRes = await fetch(oembedUrl, { signal: options?.signal });

            if (oembedRes.ok) {
                const data = await oembedRes.json();
                const title = data.title ? decodeHtml(data.title) : null;
                const result: FetchedMetadata = {
                    title: title,
                    description: data.author_name ? `Video by ${data.author_name}` : null,
                    favicon: "https://www.youtube.com/favicon.ico",
                    thumbnailUrl: data.thumbnail_url || null,
                    fallbackThumbnail: title ? `/api/thumbnails/generate?title=${encodeURIComponent(title)}&domain=youtube.com` : null,
                    isNsfw: undefined
                };
                console.log(`[Metadata] YouTube oEmbed Success:`, result.title);
                return result;
            }
            return null;
        } catch (e) {
            console.warn("[Metadata] YouTube Provider failed", e);
            return null;
        }
    }
}
