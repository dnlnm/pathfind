import { NextRequest } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get("title") || "No Title";
    const domain = searchParams.get("domain") || "";

    // Check for custom color if user is logged in
    let customColor: string | null = null;
    const session = await auth();

    if (session?.user?.id && domain) {
        const row = db.prepare("SELECT color FROM domain_colors WHERE user_id = ? AND domain = ?").get(
            session.user.id,
            domain.toLowerCase()
        ) as { color: string } | undefined;
        if (row) customColor = row.color;
    }

    let gradientStart, gradientEnd;

    if (customColor) {
        gradientStart = customColor;
        gradientEnd = customColor;
    } else {
        gradientStart = "#000000";
        gradientEnd = "#000000";
    }

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

    // Limit to 4 lines for layout reasons
    const displayLines = lines.slice(0, 4);
    const lineSpacing = fontSize * 1.2;
    const startY = 315 - ((displayLines.length - 1) * lineSpacing) / 2;

    const svg = `
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:${gradientStart};stop-opacity:1" />
                <stop offset="100%" style="stop-color:${gradientEnd};stop-opacity:1" />
            </linearGradient>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="10"/>
                <feOffset dx="0" dy="10" result="offsetblur"/>
                <feComponentTransfer>
                    <feFuncA type="linear" slope="0.3"/>
                </feComponentTransfer>
                <feMerge> 
                    <feMergeNode/>
                    <feMergeNode in="SourceGraphic"/> 
                </feMerge>
            </filter>
        </defs>
        <rect width="1200" height="630" fill="url(#grad)" />
        
        <!-- Subtle pattern overlay -->
        <rect width="1200" height="630" fill="white" fill-opacity="0.05" />
        <circle cx="1100" cy="100" r="200" fill="white" fill-opacity="0.1" />
        <circle cx="100" cy="530" r="150" fill="white" fill-opacity="0.05" />

        <g filter="url(#shadow)">
            <text 
                x="600" 
                y="${startY}" 
                font-family="system-ui, -apple-system, sans-serif" 
                font-size="${fontSize}" 
                font-weight="bold" 
                fill="white" 
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
