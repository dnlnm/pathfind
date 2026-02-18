export { authMiddleware as middleware } from "@/lib/auth.config";

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|api/auth).*)",
    ],
};
