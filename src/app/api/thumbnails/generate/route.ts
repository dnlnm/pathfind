import { NextRequest } from "next/server";
import path from "path";
import fs from "fs";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import satori from "satori";
import { html } from "satori-html";

// How long to keep a cached favicon color before re-fetching (7 days)
const CACHE_TTL_DAYS = 7;

// Load Geist-SemiBold font once (lazy-cached at module level)
let geistFontData: ArrayBuffer | null = null;

function getGeistFont(): ArrayBuffer {
    if (geistFontData) return geistFontData;
    const fontPath = path.join(
        process.cwd(),
        "node_modules",
        "geist",
        "dist",
        "fonts",
        "geist-sans",
        "Geist-SemiBold.ttf"
    );
    const buffer = fs.readFileSync(fontPath);
    geistFontData = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
    ) as ArrayBuffer;
    return geistFontData;
}

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

/** Parse a hex color into { r, g, b } */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const h = hex.replace("#", "");
    return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
    };
}

/** Lighten or darken a hex color by an offset amount */
function adjustBrightness(hex: string, amount: number): string {
    const { r, g, b } = hexToRgb(hex);
    const clamp = (v: number) => Math.min(255, Math.max(0, v));
    const nr = clamp(r + amount);
    const ng = clamp(g + amount);
    const nb = clamp(b + amount);
    return `#${[nr, ng, nb].map(v => v.toString(16).padStart(2, "0")).join("")}`;
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get("title") || "No Title";
    const domain = searchParams.get("domain") || "";

    const session = await auth();
    const userId = session?.user?.id;

    const bgColor = await getColor(userId, domain);

    // Calculate luminance to decide text/overlay colors
    const { r, g, b } = hexToRgb(bgColor);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const isDark = luminance < 0.6;
    const textColor = isDark ? "#ffffff" : "#111111";

    // Gradient stop — slightly lighter/darker version of bgColor
    const gradientStop = adjustBrightness(bgColor, isDark ? 35 : -35);

    // Decorative circle overlays
    const circleOpacity1 = isDark ? "0.13" : "0.07";
    const circleOpacity2 = isDark ? "0.07" : "0.04";
    const circleRgb = isDark ? "255,255,255" : "0,0,0";

    // Domain pill background
    const pillBg = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)";

    const font = getGeistFont();

    const domainHtml = domain
        ? `<div style="
            position: absolute;
            bottom: 60px;
            left: 80px;
            display: flex;
            align-items: center;
            background: ${pillBg};
            border-radius: 100px;
            padding: 10px 28px;
          ">
            <span style="
              color: ${textColor};
              font-size: 28px;
              font-family: Geist;
              font-weight: 600;
              opacity: 0.65;
              letter-spacing: -0.01em;
            ">${escapeHtml(domain)}</span>
          </div>`
        : "";

    const markup = html(`
      <div style="
        width: 1200px;
        height: 630px;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        background: linear-gradient(135deg, ${bgColor} 0%, ${gradientStop} 100%);
        font-family: Geist;
        overflow: hidden;
      ">
        <div style="
          display: flex;
          position: absolute;
          top: -100px;
          right: -100px;
          width: 420px;
          height: 420px;
          border-radius: 9999px;
          background: rgba(${circleRgb},${circleOpacity1});
        "></div>
        <div style="
          display: flex;
          position: absolute;
          bottom: -80px;
          left: -60px;
          width: 280px;
          height: 280px;
          border-radius: 9999px;
          background: rgba(${circleRgb},${circleOpacity2});
        "></div>
        <div style="
          display: flex;
          position: absolute;
          bottom: 60px;
          right: 80px;
          width: 120px;
          height: 120px;
          border-radius: 9999px;
          background: rgba(${circleRgb},${circleOpacity1});
        "></div>
        ${domainHtml}
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 0 100px;
          text-align: center;
          max-width: 1000px;
        ">
          <span style="
            color: ${textColor};
            font-size: 88px;
            font-family: Geist;
            font-weight: 600;
            line-height: 1.1;
            letter-spacing: -0.04em;
          ">${escapeHtml(title)}</span>
        </div>
      </div>
    `);

    // satori-html returns VNode which is structurally identical to ReactNode at runtime;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svg = await satori(markup as any, {
        width: 1200,
        height: 630,
        fonts: [
            {
                name: "Geist",
                data: font,
                weight: 600,
                style: "normal",
            },
        ],
    });

    return new Response(svg, {
        headers: {
            "Content-Type": "image/svg+xml",
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
        },
    });
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
