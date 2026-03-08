import path from "path";
import fs from "fs";
import sharp from "sharp";

const DATA_DIR = process.env.DATABASE_PATH
    ? path.dirname(process.env.DATABASE_PATH)
    : path.join(process.cwd(), "data");

const THUMBNAILS_DIR = path.join(DATA_DIR, "thumbnails");

// Ensure thumbnails directory exists
fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });

const MAX_WIDTH = 800;
const WEBP_QUALITY = 80;

/**
 * Save an image buffer as a compressed WebP thumbnail on disk.
 * Returns relative path like "thumbnails/{id}.webp".
 */
export async function saveThumbnail(
    id: string,
    buffer: Buffer | ArrayBuffer
): Promise<string> {
    const input = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    const filename = `${id}.webp`;
    const filePath = path.join(THUMBNAILS_DIR, filename);

    await sharp(input)
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toFile(filePath);

    return `thumbnails/${filename}`;
}

/**
 * Fetch an image from a URL and save as a WebP thumbnail.
 * Returns the relative path, or null on failure.
 */
export async function saveThumbnailFromUrl(
    id: string,
    imageUrl: string,
    maxSize = 2 * 1024 * 1024
): Promise<string | null> {
    try {
        if (!imageUrl || !imageUrl.startsWith("http")) return null;

        // Clean up Reddit preview URLs
        let targetUrl = imageUrl;
        if (imageUrl.includes("preview.redd.it") || imageUrl.includes("external-preview.redd.it")) {
            const match = imageUrl.match(/(?:preview|external-preview)\.redd\.it\/([^?]+)/);
            if (match) {
                targetUrl = `https://i.redd.it/${match[1]}`;
            }
        }

        const fetchWithTimeout = async (imgUrl: string) => {
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
                const buffer = await res.arrayBuffer();
                return { ok: res.ok, status: res.status, contentType: res.headers.get("content-type"), buffer };
            } finally {
                clearTimeout(timeout);
            }
        };

        let result = await fetchWithTimeout(targetUrl).catch(() => null);

        if ((!result || !result.ok) && targetUrl !== imageUrl) {
            result = await fetchWithTimeout(imageUrl).catch(() => null);
        }

        if (!result || !result.ok) {
            console.warn(`[Thumbnails] Failed to fetch image: ${result?.status || "error"} ${imageUrl}`);
            return null;
        }

        const contentType = result.contentType;
        if (!contentType || !contentType.startsWith("image/")) {
            console.warn(`[Thumbnails] Invalid image content type: ${contentType} ${targetUrl}`);
            return null;
        }

        if (result.buffer.byteLength > maxSize) {
            console.warn(`[Thumbnails] Image too large: ${result.buffer.byteLength} bytes`);
            return null;
        }

        return await saveThumbnail(id, result.buffer);
    } catch (e) {
        console.error(`[Thumbnails] Failed to save thumbnail from URL: ${imageUrl}`, e);
        return null;
    }
}

/**
 * Delete a thumbnail file from disk.
 */
export function deleteThumbnail(id: string): void {
    try {
        const filePath = path.join(THUMBNAILS_DIR, `${id}.webp`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (e) {
        console.error(`[Thumbnails] Failed to delete thumbnail for ${id}`, e);
    }
}

/**
 * Get the absolute file path for a thumbnail.
 */
export function getThumbnailAbsolutePath(relativePath: string): string | null {
    const filename = path.basename(relativePath);
    const filePath = path.join(THUMBNAILS_DIR, filename);
    return fs.existsSync(filePath) ? filePath : null;
}

/**
 * Resolve a thumbnail value stored in DB to a displayable URL.
 * - "thumbnails/..." → "/api/thumbnails/..."
 * - "/api/thumbnails/generate?..." → passthrough (dynamic SVG fallback)
 * - "http..." → passthrough
 */
export function resolveThumbnailUrl(thumbnail: string | null): string | null {
    if (!thumbnail) return null;
    if (thumbnail.startsWith("http") || thumbnail.startsWith("/api/")) {
        return thumbnail;
    }
    if (thumbnail.startsWith("thumbnails/")) {
        return `/api/${thumbnail}`;
    }
    return thumbnail;
}
