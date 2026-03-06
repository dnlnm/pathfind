async function parseHtmlMetadata(html: string, url: string) {
    const urlObj = new URL(url);
    const isReddit = urlObj.hostname.includes("reddit.com");

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

    if (title && isReddit) {
        title = title.replace(/ - Reddit$/i, "").replace(/^Reddit - /i, "").trim();
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
        if (isReddit) {
            favicon = "https://www.reddit.com/favicon.ico";
        } else {
            favicon = `https://twenty-icons.com/${urlObj.hostname}`;
        }
    }

    const hostname = isReddit ? "reddit.com" : urlObj.hostname;

    const fallbackThumbnail = title
        ? `/api/thumbnail?title=${encodeURIComponent(title)}&domain=${encodeURIComponent(hostname)}`
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

export interface FetchedMetadata {
    title: string | null;
    description: string | null;
    favicon: string | null;
    thumbnailUrl: string | null;
    fallbackThumbnail: string | null;
    isNsfw: boolean | undefined;
}

export async function fetchUrlMetadata(url: string): Promise<FetchedMetadata> {
    console.log(`[Metadata] Fetching: ${url}`);
    try {
        const urlObj = new URL(url);

        if (isPrivateHostname(urlObj.hostname)) {
            console.warn(`[Metadata] Blocked request to private/internal address: ${urlObj.hostname}`);
            return { title: null, description: null, favicon: null, thumbnailUrl: null, fallbackThumbnail: null, isNsfw: undefined };
        }
        const isReddit = urlObj.hostname.includes("reddit.com");

        // Special handling for Reddit: use the .json trick
        if (isReddit) {
            try {
                let resolvedUrl = url;

                const isShareLink = /\/s\/[a-zA-Z0-9]+\/?$/.test(urlObj.pathname);
                if (isShareLink) {
                    console.log(`[Metadata] Reddit share link detected, resolving redirect...`);
                    const headRes = await fetch(url, {
                        method: "GET",
                        redirect: "follow",
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
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Accept": "application/json"
                    }
                });

                if (jsonRes.ok) {
                    const data = await jsonRes.json();

                    let postData: any = null;
                    if (Array.isArray(data)) {
                        postData = data[0]?.data?.children[0]?.data;
                    } else if (data?.data?.children && data.data.children.length > 0) {
                        postData = data.data.children[0].data;
                    } else if (data?.kind === "t5") {
                        postData = data.data;
                    }

                    if (postData) {
                        const title = postData.title || postData.display_name_prefixed || postData.name || null;

                        let thumbnailUrl = null;

                        if (postData.is_gallery && postData.media_metadata) {
                            const firstMediaId = Object.keys(postData.media_metadata)[0];
                            const firstMedia = postData.media_metadata[firstMediaId];
                            if (firstMedia?.s?.u) {
                                thumbnailUrl = firstMedia.s.u.replace(/&amp;/g, "&");
                            }
                        }

                        if (!thumbnailUrl) {
                            const media = postData.secure_media || postData.media;
                            if (media?.oembed?.thumbnail_url) {
                                thumbnailUrl = media.oembed.thumbnail_url;
                            }
                        }

                        if (!thumbnailUrl) {
                            thumbnailUrl = postData.preview?.images[0]?.source?.url?.replace(/&amp;/g, "&") ||
                                (postData.thumbnail?.startsWith("http") ? postData.thumbnail : null);
                        }

                        const fallbackThumbnail = title
                            ? `/api/thumbnail?title=${encodeURIComponent(title)}&domain=reddit.com`
                            : null;

                        const isNsfw = !!postData.over_18;

                        const result: FetchedMetadata = {
                            title,
                            description: postData.selftext?.substring(0, 200) || postData.public_description || postData.description?.substring(0, 200) || null,
                            favicon: "https://www.reddit.com/favicon.ico",
                            thumbnailUrl,
                            fallbackThumbnail,
                            isNsfw
                        };
                        console.log(`[Metadata] Reddit JSON Success:`, result.title);
                        if (result.title) return result;
                    }
                } else {
                    console.warn(`[Metadata] Reddit JSON failed with status: ${jsonRes.status}`);
                }
            } catch (e) {
                console.error("[Metadata] Reddit JSON fetch failed", e);
            }
        }

        let html = "";
        const controller = new AbortController();
        const timeout = setTimeout(() => {
            console.log(`[Metadata] Timeout reached for ${url}, aborting...`);
            controller.abort();
        }, 12000);

        try {
            console.log(`[Metadata] Starting fetch for ${url}`);
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html"
                },
            });

            console.log(`[Metadata] Headers received for ${url}, status: ${response.status}`);

            if (!response.ok) {
                console.warn(`[Metadata] HTTP ${response.status} for ${url}, skipping body parse`);
            } else {
                const fullHtml = await response.text();
                html = fullHtml.length > 512 * 1024 ? fullHtml.substring(0, 512 * 1024) : fullHtml;
                console.log(`[Metadata] Body read complete for ${url}, original length: ${fullHtml.length}, processed length: ${html.length}`);
            }
        } catch (e: any) {
            if (e.name === 'AbortError') {
                console.warn(`[Metadata] Fetch aborted due to timeout: ${url}`);
            } else {
                console.error(`[Metadata] Fetch error for ${url}:`, e);
            }
        } finally {
            clearTimeout(timeout);
        }

        const parsed = await parseHtmlMetadata(html || "", url);

        console.log(`[Metadata] Final result:`, parsed.title);
        return parsed;
    } catch (e) {
        console.error(`[Metadata] Error fetching ${url}:`, e);
        return { title: null, description: null, favicon: null, thumbnailUrl: null, fallbackThumbnail: null, isNsfw: undefined };
    }
}

function decodeHtml(html: string) {
    if (!html) return "";
    return html
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/&mdash;/g, "—")
        .replace(/&ndash;/g, "–")
        .replace(/&hellip;/g, "…")
        .replace(/&laquo;/g, "«")
        .replace(/&raquo;/g, "»")
        .replace(/&copy;/g, "©")
        .replace(/&reg;/g, "®")
        .replace(/&trade;/g, "™");
}
