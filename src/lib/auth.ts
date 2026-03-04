import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compareSync } from "bcryptjs";
import db from "@/lib/db";
import { authConfig } from "@/lib/auth.config";
import { DbUser } from "@/types";

export const { handlers, signIn, signOut, auth } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            name: "credentials",
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.username || !credentials?.password) {
                    return null;
                }

                const login = (credentials.username as string).trim();

                // Try username first (case-insensitive), then fall back to email
                const user = (
                    db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(login) ??
                    db.prepare("SELECT * FROM users WHERE email = ?").get(login)
                ) as DbUser | undefined;

                if (!user) {
                    return null;
                }

                const isValid = compareSync(credentials.password as string, user.password);

                if (!isValid) {
                    return null;
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                };
            },
        }),
    ],
});
