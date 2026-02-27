import { NextRequest } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

// How long to keep a cached favicon color before re-fetching (7 days)
const CACHE_TTL_DAYS = 7;

async function extractFaviconColor(domain: string): Promise<string> {
    try {
        // Use Google's favicon CDN — always returns a PNG, handles ICO/SVG/PNG
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&size=64`;
        const res = await fetch(faviconUrl, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) throw new Error(`Favicon fetch failed: ${res.status}`);

        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { getAverageColor } = await import("fast-average-color-node");
        const color = await getAverageColor(buffer, {
            // Skip white and fully transparent pixels for better results
            ignoredColor: [[255, 255, 255, 255], [0, 0, 0, 0]],
        });

        // Return the 6-char hex (strip alpha from hexa if present)
        return color.hex?.slice(0, 7) || "#000000";
    } catch {
        return "#000000";
    }
}

async function getColor(userId: string | undefined, domain: string): Promise<string> {
    // 1. Check user-specific custom override first
    if (userId && domain) {
        const row = db
            .prepare("SELECT color FROM domain_colors WHERE user_id = ? AND domain = ?")
            .get(userId, domain.toLowerCase()) as { color: string } | undefined;
        if (row) return row.color;
    }

    if (!domain) return "#000000";

    const domainKey = domain.toLowerCase();

    // 2. Check shared favicon color cache (skip if older than TTL)
    const cached = db
        .prepare(
            `SELECT color, fetched_at FROM favicon_colors
             WHERE domain = ?
               AND julianday('now') - julianday(fetched_at) < ?`
        )
        .get(domainKey, CACHE_TTL_DAYS) as { color: string; fetched_at: string } | undefined;

    if (cached) return cached.color;

    // 3. Extract from favicon and cache the result
    const hex = await extractFaviconColor(domainKey);

    db.prepare(
        `INSERT INTO favicon_colors (domain, color, fetched_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(domain) DO UPDATE SET color = excluded.color, fetched_at = excluded.fetched_at`
    ).run(domainKey, hex);

    return hex;
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get("title") || "No Title";
    const domain = searchParams.get("domain") || "";

    const session = await auth();
    const userId = session?.user?.id;

    const bgColor = await getColor(userId, domain);

    // Calculate luminance to decide text color
    const r = parseInt(bgColor.slice(1, 3), 16);
    const g = parseInt(bgColor.slice(3, 5), 16);
    const b = parseInt(bgColor.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const isDark = luminance < 0.6; // Threshold for dark background
    const textColor = isDark ? "white" : "#1a1a1a";
    const shadowOpacity = isDark ? "0.3" : "0"; // No shadow for dark text on light bg

    // Text wrapping logic
    const fontSize = 84;
    const maxCharsPerLine = 22;
    const words = title.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    words.forEach(word => {
        if ((currentLine + word).length > maxCharsPerLine) {
            if (currentLine) lines.push(currentLine.trim());
            currentLine = word + " ";
        } else {
            currentLine += word + " ";
        }
    });
    if (currentLine) lines.push(currentLine.trim());

    // Limit to 4 lines
    const displayLines = lines.slice(0, 4);
    const lineSpacing = fontSize * 1.2;
    const startY = 315 - ((displayLines.length - 1) * lineSpacing) / 2;

    const svg = `
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Geist:wght@100..900&amp;display=swap');
            .title-text {
                font-family: 'Geist', system-ui, -apple-system, sans-serif;
                font-weight: 900;
                letter-spacing: -0.04em;
            }
        </style>
        <defs>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="10"/>
                <feOffset dx="0" dy="10" result="offsetblur"/>
                <feComponentTransfer>
                    <feFuncA type="linear" slope="${shadowOpacity}"/>
                </feComponentTransfer>
                <feMerge> 
                    <feMergeNode/>
                    <feMergeNode in="SourceGraphic"/> 
                </feMerge>
            </filter>
        </defs>
        <rect width="1200" height="630" fill="${bgColor}" />
        
        <!-- Subtle pattern overlay -->
        <rect width="1200" height="630" fill="${isDark ? 'white' : 'black'}" fill-opacity="0.05" />
        <circle cx="1100" cy="100" r="200" fill="${isDark ? 'white' : 'black'}" fill-opacity="0.1" />
        <circle cx="100" cy="530" r="150" fill="${isDark ? 'white' : 'black'}" fill-opacity="0.05" />

        <g filter="url(#shadow)">
            <text 
                x="600" 
                y="${startY}" 
                class="title-text"
                font-size="${fontSize}" 
                fill="${textColor}" 
                text-anchor="middle"
                dominant-baseline="middle"
            >
                ${displayLines.map((line, i) => `
                <tspan x="600" dy="${i === 0 ? 0 : lineSpacing}">${escapeSvg(line)}</tspan>
                `).join("")}
            </text>
        </g>
    </svg>
    `.trim();

    return new Response(svg, {
        headers: {
            "Content-Type": "image/svg+xml",
            "Cache-Control": "no-cache, no-store, must-revalidate",
        },
    });
}

function escapeSvg(str: string) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}
