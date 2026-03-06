import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchUrlMetadata } from "@/lib/metadata-fetcher";

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url } = await request.json();
    if (!url) {
        return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const metadata = await fetchUrlMetadata(url);

    // Return a format the frontend expects.
    // The thumbnail is either the raw URL (for preview) or the SVG fallback. 
    // The actual file saving happens when the bookmark is created/updated.
    return NextResponse.json({
        title: metadata.title,
        description: metadata.description,
        favicon: metadata.favicon,
        thumbnail: metadata.thumbnailUrl || metadata.fallbackThumbnail,
        // Keep the raw URL so the bookmark creation can save it as a file
        thumbnailUrl: metadata.thumbnailUrl,
        isNsfw: metadata.isNsfw,
    });
}
