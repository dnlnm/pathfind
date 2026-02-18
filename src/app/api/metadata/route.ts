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
    return NextResponse.json(metadata);
}
