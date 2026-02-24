export async function fetchUrlMetadata(url: string) {
    console.log(`[Metadata] Fetching: ${url}`);
    try {
        const urlObj = new URL(url);
        const isReddit = urlObj.hostname.includes("reddit.com");

        // Special handling for Reddit: use the .json trick
        if (isReddit) {
            try {
                let resolvedUrl = url;

                // Reddit share links like /r/sub/s/XXXXX are redirect URLs.
                // Appending .json to them won't work — we must follow the redirect first.
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
                    // After following the redirect, the final URL is the canonical post URL
                    resolvedUrl = headRes.url;
                    console.log(`[Metadata] Resolved Reddit URL: ${resolvedUrl}`);
                }

                // Ensure we handle various reddit URL formats correctly
                let redditJsonUrl = resolvedUrl.replace(/\?.*$/, ""); // Remove query params for the JSON fetch
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

                        // Extract thumbnail with gallery support
                        let thumbnail = null;

                        if (postData.is_gallery && postData.media_metadata) {
                            // Focus on the first item in media_metadata
                            const firstMediaId = Object.keys(postData.media_metadata)[0];
                            const firstMedia = postData.media_metadata[firstMediaId];
                            if (firstMedia?.s?.u) {
                                thumbnail = firstMedia.s.u.replace(/&amp;/g, "&");
                            }
                        }

                        // Try Video/Oembed thumbnails (YouTube, native Video, etc.)
                        if (!thumbnail) {
                            const media = postData.secure_media || postData.media;
                            if (media?.oembed?.thumbnail_url) {
                                thumbnail = media.oembed.thumbnail_url;
                            }
                        }

                        if (!thumbnail) {
                            thumbnail = postData.preview?.images[0]?.source?.url?.replace(/&amp;/g, "&") ||
                                (postData.thumbnail?.startsWith("http") ? postData.thumbnail : null);
                        }

                        let finalThumbnail = thumbnail && thumbnail.startsWith('http') ? await imageUrlToBase64(thumbnail) : thumbnail;

                        if (!finalThumbnail && title) {
                            finalThumbnail = `/api/thumbnail?title=${encodeURIComponent(title)}&domain=reddit.com`;
                        }

                        const result = {
                            title,
                            description: postData.selftext?.substring(0, 200) || postData.public_description || postData.description?.substring(0, 200) || null,
                            favicon: await imageUrlToBase64("https://www.reddit.com/favicon.ico", 50 * 1024),
                            thumbnail: finalThumbnail
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

        if (title) {
            // Remove notification counts like (1) or [10+] from the start of the title
            title = title.replace(/^[\(\[]\d+\+?[\)\]]\s*/, "").trim();
        }

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
                    favicon = `https://twenty-icons.com/${urlObj.hostname}`;
                }
            } catch {
                favicon = null;
            }
        }

        let finalThumbnail = thumbnail && thumbnail.startsWith('http') ? await imageUrlToBase64(thumbnail) : thumbnail;
        const hostname = isReddit ? "reddit.com" : urlObj.hostname;

        if (!finalThumbnail && title) {
            finalThumbnail = `/api/thumbnail?title=${encodeURIComponent(title)}&domain=${encodeURIComponent(hostname)}`;
        }

        const result = {
            title,
            description,
            favicon: favicon ? await imageUrlToBase64(favicon, 50 * 1024) : null,
            thumbnail: finalThumbnail
        };
        console.log(`[Metadata] Final result:`, result.title);
        return result;
    } catch (e) {
        console.error(`[Metadata] Error fetching ${url}:`, e);
        return { title: null, description: null, favicon: null, thumbnail: null };
    }
}

async function imageUrlToBase64(url: string, maxSize = 2 * 1024 * 1024): Promise<string | null> {
    try {
        if (!url || !url.startsWith('http')) return url;

        // Clean up Reddit preview URLs which are often blocked or blurred
        // Example: https://preview.redd.it/xyz.jpg?width=640&blur=40... -> https://i.redd.it/xyz.jpg
        let targetUrl = url;
        if (url.includes("preview.redd.it") || url.includes("external-preview.redd.it")) {
            const match = url.match(/(?:preview|external-preview)\.redd\.it\/([^?]+)/);
            if (match) {
                targetUrl = `https://i.redd.it/${match[1]}`;
            }
        }

        const fetchImage = async (imgUrl: string) => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            try {
                const res = await fetch(imgUrl, {
                    signal: controller.signal,
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
                    },
                });
                clearTimeout(timeout);
                return res;
            } catch (err) {
                clearTimeout(timeout);
                throw err;
            }
        };

        let response = await fetchImage(targetUrl).catch(() => ({ ok: false, status: 0 } as any));

        if (!response.ok && targetUrl !== url) {
            // Fall back to the original signed preview URL if the bare i.redd.it fails (usually 403/404)
            response = await fetchImage(url).catch(() => ({ ok: false, status: 0 } as any));
        }

        if (!response.ok) {
            console.warn(`[Metadata] Failed to fetch image: ${response.status} ${url}`);
            return null;
        }

        const contentType = response.headers?.get('content-type');
        if (!contentType || !contentType.startsWith('image/')) {
            console.warn(`[Metadata] Invalid image content type: ${contentType} ${targetUrl}`);
            return null;
        }

        const buffer = await response.arrayBuffer();
        if (buffer.byteLength > maxSize) {
            console.warn(`[Metadata] Image too large: ${buffer.byteLength} bytes`);
            return null;
        }

        const base64 = Buffer.from(buffer).toString('base64');
        return `data:${contentType};base64,${base64}`;
    } catch (e) {
        console.error(`[Metadata] Failed to convert image to base64: ${url}`, e);
        return null;
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
