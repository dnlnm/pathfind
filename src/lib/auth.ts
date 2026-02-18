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
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null;
                }

                const user = db.prepare("SELECT * FROM users WHERE email = ?").get(
                    credentials.email as string
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
