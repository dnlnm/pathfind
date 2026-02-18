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

        const faviconMatch = html.match(
            /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']*)["']/i
        ) || html.match(
            /<link[^>]*href=["']([^"']*)["'][^>]*rel=["'](?:shortcut )?icon["']/i
        );

        let favicon: string | null = null;
        if (faviconMatch) {
            favicon = faviconMatch[1];
            if (favicon.startsWith("/")) {
                const urlObj = new URL(url);
                favicon = `${urlObj.protocol}//${urlObj.host}${favicon}`;
            } else if (!favicon.startsWith("http")) {
                const urlObj = new URL(url);
                favicon = `${urlObj.protocol}//${urlObj.host}/${favicon}`;
            }
        } else {
            const urlObj = new URL(url);
            favicon = `${urlObj.protocol}//${urlObj.host}/favicon.ico`;
        }

        return { title, description, favicon };
    } catch {
        return { title: null, description: null, favicon: null };
    }
}
