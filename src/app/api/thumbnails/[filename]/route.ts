import { NextRequest } from "next/server";
import { getThumbnailAbsolutePath } from "@/lib/thumbnail-store";
import fs from "fs";

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ filename: string }> }
) {
    const { filename } = await params;

    const filePath = getThumbnailAbsolutePath(`thumbnails/${filename}`);
    if (!filePath) {
        return new Response("Not found", { status: 404 });
    }

    const buffer = fs.readFileSync(filePath);

    return new Response(buffer, {
        headers: {
            "Content-Type": "image/webp",
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    });
}
