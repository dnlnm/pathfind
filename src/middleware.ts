export { authMiddleware as middleware } from "@/lib/auth.config";

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|icon.svg|api/auth|manifest.webmanifest|sw.js|icons/).*)",
    ],
};
