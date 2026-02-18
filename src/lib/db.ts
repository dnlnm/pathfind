import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "pathfind.db");

// Ensure data directory exists
import fs from "fs";
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    password TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    title TEXT,
    description TEXT,
    notes TEXT,
    favicon TEXT,
    is_archived INTEGER DEFAULT 0,
    is_read_later INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    user_id TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bookmark_tags (
    bookmark_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    PRIMARY KEY (bookmark_id, tag_id),
    FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
  CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at);
`);

export default db;

// Helper to generate IDs
export function generateId(): string {
    return crypto.randomUUID();
}
