import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const authConfig: NextAuthConfig = {
    providers: [
        Credentials({
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            // authorize is implemented in auth.ts (server-only)
            authorize: async () => null,
        }),
    ],
    session: {
        strategy: "jwt",
    },
    pages: {
        signIn: "/login",
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isApi = nextUrl.pathname.startsWith("/api/");
            const isAuthApi = nextUrl.pathname.startsWith("/api/auth");
            const isSeedApi = nextUrl.pathname.startsWith("/api/seed");
            const isOnLogin = nextUrl.pathname.startsWith("/login");

            if (isAuthApi || isSeedApi) return true;
            if (isApi) return true; // Allow API routes to handle their own auth (session or token)
            if (isOnLogin) return true;
            if (!isLoggedIn) return false;
            return true;
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (token) {
                session.user.id = token.id as string;
            }
            return session;
        },
    },
};

export const { auth: authMiddleware } = NextAuth(authConfig);
