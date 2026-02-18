export async function fetchUrlMetadata(url: string) {
    console.log(`[Metadata] Fetching: ${url}`);
    try {
        const urlObj = new URL(url);
        const isReddit = urlObj.hostname.includes("reddit.com");

        // Special handling for Reddit: use the .json trick
        if (isReddit) {
            try {
                // Ensure we handle various reddit URL formats correctly
                let redditJsonUrl = url.replace(/\?.*$/, ""); // Remove query params for the JSON fetch
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
                    } else if (data?.kind === "t5") { // Subreddit metadata
                        postData = data.data;
                    }

                    if (postData) {
                        const title = postData.title || postData.display_name_prefixed || postData.name || null;
                        let thumbnail = postData.preview?.images[0]?.source?.url?.replace(/&amp;/g, "&") ||
                            (postData.thumbnail?.startsWith("http") ? postData.thumbnail : null);

                        if (!thumbnail && title) {
                            thumbnail = `/api/thumbnail?title=${encodeURIComponent(title)}&domain=reddit.com`;
                        }

                        const result = {
                            title,
                            description: postData.selftext?.substring(0, 200) || postData.public_description || postData.description?.substring(0, 200) || null,
                            favicon: "https://www.reddit.com/favicon.ico",
                            thumbnail
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

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                // Use a generic but common UA
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html"
            },
        });
        clearTimeout(timeout);

        const html = await response.text();
        console.log(`[Metadata] HTML length: ${html.length}`);

        const getMeta = (prop: string) => {
            // More robust meta tag extraction
            const patterns = [
                new RegExp(`<meta[^>]*property=["']${prop}["'][^>]*content=["']([^"']*)["']`, "i"),
                new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${prop}["']`, "i"),
                new RegExp(`<meta[^>]*name=["']${prop}["'][^>]*content=["']([^"']*)["']`, "i"),
                new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${prop}["']`, "i")
            ];

            for (const pattern of patterns) {
                const match = html.match(pattern);
                if (match) return decodeHtml(match[1]);
            }
            return null;
        };

        const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        let title = getMeta("og:title") || getMeta("twitter:title") || (titleMatch ? decodeHtml(titleMatch[1].trim()) : null);

        if (title && isReddit) {
            title = title.replace(/ - Reddit$/i, "").replace(/^Reddit - /i, "").trim();
        }

        const description = getMeta("og:description") || getMeta("description") || getMeta("twitter:description");
        let thumbnail = getMeta("og:image") || getMeta("twitter:image");

        const faviconMatch = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']*)["']/i) ||
            html.match(/<link[^>]*href=["']([^"']*)["'][^>]*rel=["'](?:shortcut )?icon["']/i);

        let favicon: string | null = null;
        if (faviconMatch) {
            try {
                favicon = new URL(faviconMatch[1], url).href;
            } catch {
                favicon = null;
            }
        }

        if (!favicon) {
            try {
                // If the site-specific favicon fails, use a custom reliable one for Reddit
                if (isReddit) {
                    favicon = "https://www.reddit.com/favicon.ico";
                } else {
                    favicon = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=128`;
                }
            } catch {
                favicon = null;
            }
        }

        if (!thumbnail && title) {
            thumbnail = `/api/thumbnail?title=${encodeURIComponent(title)}&domain=${encodeURIComponent(urlObj.hostname)}`;
        }

        const result = { title, description, favicon, thumbnail };
        console.log(`[Metadata] Final result:`, result.title);
        return result;
    } catch (e) {
        console.error(`[Metadata] Error fetching ${url}:`, e);
        return { title: null, description: null, favicon: null, thumbnail: null };
    }
}

function decodeHtml(html: string) {
    if (!html) return "";
    return html
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&#039;/g, "'")
        .replace(/&mdash;/g, "—")
        .replace(/&ndash;/g, "–");
}
