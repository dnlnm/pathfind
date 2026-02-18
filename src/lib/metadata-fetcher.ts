export async function fetchUrlMetadata(url: string) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                "User-Agent": "PathFind/1.0 (Bookmark Manager)",
            },
        });
        clearTimeout(timeout);

        const html = await response.text();

        const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : null;

        const descriptionMatch = html.match(
            /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i
        ) || html.match(
            /<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i
        );
        const description = descriptionMatch ? descriptionMatch[1].trim() : null;

        // Extract og:image or twitter:image
        const ogImageMatch = html.match(
            /<meta[\s\S]*?property=["']og:image["'][\s\S]*?content=["']([^"']*)["']/i
        ) || html.match(
            /<meta[\s\S]*?content=["']([^"']*)["'][\s\S]*?property=["']og:image["']/i
        ) || html.match(
            /<meta[\s\S]*?name=["']twitter:image["'][\s\S]*?content=["']([^"']*)["']/i
        ) || html.match(
            /<meta[\s\S]*?content=["']([^"']*)["'][\s\S]*?name=["']twitter:image["']/i
        );

        let thumbnail: string | null = null;
        if (ogImageMatch) {
            try {
                thumbnail = new URL(ogImageMatch[1], url).href;
            } catch {
                thumbnail = null;
            }
        }

        // Extract favicon
        const faviconMatch = html.match(
            /<link[\s\S]*?rel=["'](?:shortcut )?icon["'][\s\S]*?href=["']([^"']*)["']/i
        ) || html.match(
            /<link[\s\S]*?href=["']([^"']*)["'][\s\S]*?rel=["'](?:shortcut )?icon["']/i
        ) || html.match(
            /<link[\s\S]*?rel=["']apple-touch-icon["'][\s\S]*?href=["']([^"']*)["']/i
        );

        let favicon: string | null = null;
        if (faviconMatch) {
            try {
                favicon = new URL(faviconMatch[1], url).href;
            } catch {
                favicon = null;
            }
        }

        // Final fallback: Use Google's favicon service which is very reliable
        if (!favicon) {
            try {
                const urlObj = new URL(url);
                favicon = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=128`;
            } catch {
                favicon = null;
            }
        }

        return { title, description, favicon, thumbnail };
    } catch {
        return { title: null, description: null, favicon: null, thumbnail: null };
    }
}
