import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { saveThumbnail } from "@/lib/thumbnail-store";
import crypto from "crypto";

/**
 * POST /api/thumbnails/upload
 * Accepts a multipart/form-data upload with an image file.
 * Saves it as a WebP thumbnail and returns the relative path.
 */
export async function POST(request: NextRequest) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || !file.type.startsWith("image/")) {
        return NextResponse.json({ error: "No valid image file provided" }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
    }

    try {
        // Use a temporary ID; it will be renamed when the bookmark is saved
        const tempId = `upload-${crypto.randomUUID()}`;
        const buffer = Buffer.from(await file.arrayBuffer());
        const relativePath = await saveThumbnail(tempId, buffer);

        return NextResponse.json({ path: relativePath });
    } catch (e) {
        console.error("[Upload] Failed to save uploaded thumbnail:", e);
        return NextResponse.json({ error: "Failed to process image" }, { status: 500 });
    }
}
