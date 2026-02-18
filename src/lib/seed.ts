import db, { generateId } from "@/lib/db";
import { hashSync } from "bcryptjs";

export function ensureAdminUser() {
    const adminEmail = process.env.ADMIN_EMAIL || "admin@pathfind.local";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin";

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail);

    if (!existing) {
        const hashedPassword = hashSync(adminPassword, 12);
        db.prepare(
            "INSERT INTO users (id, email, name, password) VALUES (?, ?, ?, ?)"
        ).run(generateId(), adminEmail, "Admin", hashedPassword);
        console.log(`✅ Admin user created: ${adminEmail}`);
    }
}
