import { fetchWithProviders } from "./metadata/registry";
import { FetchedMetadata } from "./metadata/types";
import { decodeHtml } from "./metadata/utils";

async function parseHtmlMetadata(html: string, url: string) {
    const urlObj = new URL(url);

    const getMeta = (prop: string) => {
        const patterns = [
            new RegExp(`<meta[^>]*property=["']${prop}["'][^>]*content=["']([^"']*?)["']`, "i"),
            new RegExp(`<meta[^>]*content=["']([^"']*?)["'][^>]*property=["']${prop}["']`, "i"),
            new RegExp(`<meta[^>]*name=["']${prop}["'][^>]*content=["']([^"']*?)["']`, "i"),
            new RegExp(`<meta[^>]*content=["']([^"']*?)["'][^>]*name=["']${prop}["']`, "i")
        ];

        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match) return decodeHtml(match[1]);
        }
        return null;
    };

    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    let title = getMeta("og:title") || getMeta("twitter:title") || (titleMatch ? decodeHtml(titleMatch[1].trim()) : null);

    if (title) {
        title = title.replace(/^[\(\[]\d+\+?[\)\]]\s*/, "").trim();
    }

    const description = getMeta("og:description") || getMeta("description") || getMeta("twitter:description");

    // Return raw thumbnail URL — caller saves it as a WebP file
    let thumbnailUrl = getMeta("og:image") || getMeta("twitter:image");
    if (thumbnailUrl && !thumbnailUrl.startsWith("http")) {
        try { thumbnailUrl = new URL(thumbnailUrl, url).href; } catch { thumbnailUrl = null; }
    }

    // Resolve favicon URL (stored as plain URL in domain_favicons)
    const faviconMatch = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']*?)["']/i) ||
        html.match(/<link[^>]*href=["']([^"']*?)["'][^>]*rel=["'](?:shortcut )?icon["']/i);

    let favicon: string | null = null;
    if (faviconMatch) {
        try {
            favicon = new URL(faviconMatch[1], url).href;
        } catch {
            favicon = null;
        }
    }

    if (!favicon) {
        favicon = `https://twenty-icons.com/${urlObj.hostname}`;
    }

    const hostname = urlObj.hostname;

    const fallbackThumbnail = title
        ? `/api/thumbnails/generate?title=${encodeURIComponent(title)}&domain=${encodeURIComponent(hostname)}`
        : null;

    return {
        title,
        description,
        favicon,
        thumbnailUrl: thumbnailUrl || null,
        fallbackThumbnail,
        isNsfw: undefined
    };
}

function isPrivateHostname(hostname: string): boolean {
    if (
        hostname === "localhost" ||
        hostname === "[::1]" ||
        hostname.endsWith(".local") ||
        hostname.endsWith(".internal")
    ) {
        return true;
    }

    const parts = hostname.split(".").map(Number);
    if (parts.length === 4 && parts.every(n => !isNaN(n))) {
        if (parts[0] === 127) return true;                                    // 127.0.0.0/8
        if (parts[0] === 10) return true;                                     // 10.0.0.0/8
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
        if (parts[0] === 192 && parts[1] === 168) return true;                // 192.168.0.0/16
        if (parts[0] === 169 && parts[1] === 254) return true;                // 169.254.0.0/16
        if (parts[0] === 0) return true;                                       // 0.0.0.0/8
    }

    return false;
}

export type { FetchedMetadata };

export async function fetchUrlMetadata(url: string): Promise<FetchedMetadata> {
    console.log(`[Metadata] Fetching: ${url}`);
    try {
        const urlObj = new URL(url);

        if (isPrivateHostname(urlObj.hostname)) {
            console.warn(`[Metadata] Blocked request to private/internal address: ${urlObj.hostname}`);
            return { title: null, description: null, favicon: null, thumbnailUrl: null, fallbackThumbnail: null, isNsfw: undefined };
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => {
            console.log(`[Metadata] Timeout reached for ${url}, aborting...`);
            controller.abort();
        }, 12000);

        try {
            // Try specialized providers first
            const providerResult = await fetchWithProviders(urlObj, { signal: controller.signal });
            if (providerResult) {
                clearTimeout(timeout);
                return providerResult;
            }

            let html = "";
            let directFetchStatus = 0;

            console.log(`[Metadata] Starting generic fetch for ${url}`);
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html"
                },
            });

            directFetchStatus = response.status;
            console.log(`[Metadata] Headers received for ${url}, status: ${response.status}`);

            if (!response.ok) {
                console.warn(`[Metadata] HTTP ${response.status} for ${url}, skipping body parse`);
            } else {
                const fullHtml = await response.text();
                html = fullHtml.length > 512 * 1024 ? fullHtml.substring(0, 512 * 1024) : fullHtml;
                console.log(`[Metadata] Body read complete for ${url}, original length: ${fullHtml.length}, processed length: ${html.length}`);
            }

            // Cloudflare bypass fallback: retry via proxy when blocked (403/503) or empty html
            const cfBypassUrl = process.env.CF_BYPASS_URL;
            if (cfBypassUrl && (!html || directFetchStatus === 403 || directFetchStatus === 503)) {
                try {
                    console.log(`[Metadata] Direct fetch failed/blocked (status ${directFetchStatus}), attempting Cloudflare bypass for ${url}`);
                    const bypassRes = await fetch(
                        `${cfBypassUrl}/html?url=${encodeURIComponent(url)}`,
                        { signal: controller.signal }
                    );

                    if (bypassRes.ok) {
                        const bypassHtml = await bypassRes.text();
                        html = bypassHtml.length > 512 * 1024 ? bypassHtml.substring(0, 512 * 1024) : bypassHtml;
                        console.log(`[Metadata] Cloudflare bypass success for ${url}, html length: ${html.length}`);
                    }
                } catch (e: any) {
                    console.warn(`[Metadata] Cloudflare bypass error for ${url}:`, e.message || e);
                }
            }

            const parsed = await parseHtmlMetadata(html || "", url);
            console.log(`[Metadata] Final result:`, parsed.title);
            return parsed;

        } finally {
            clearTimeout(timeout);
        }
    } catch (e) {
        console.error(`[Metadata] Error fetching ${url}:`, e);
        return { title: null, description: null, favicon: null, thumbnailUrl: null, fallbackThumbnail: null, isNsfw: undefined };
    }
}

