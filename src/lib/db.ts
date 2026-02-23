import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "pathfind.db");

// Ensure data directory exists
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
    github_token TEXT,
    pagination_limit INTEGER DEFAULT 30,
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
    thumbnail TEXT,
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

  CREATE TABLE IF NOT EXISTS domain_colors (
    user_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    color TEXT NOT NULL,
    PRIMARY KEY (user_id, domain),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    color TEXT,
    user_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS bookmark_collections (
    bookmark_id TEXT NOT NULL,
    collection_id TEXT NOT NULL,
    PRIMARY KEY (bookmark_id, collection_id),
    FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS api_tokens (
    id TEXT PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    user_id TEXT NOT NULL,
    last_used_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    payload TEXT NOT NULL, -- JSON string
    status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
    progress INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    error TEXT,
    user_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
  CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at);
  CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
  CREATE INDEX IF NOT EXISTS idx_api_tokens_user_id ON api_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_api_tokens_token ON api_tokens(token);
  CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
  CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);

  -- Full Text Search Table
  CREATE VIRTUAL TABLE IF NOT EXISTS bookmarks_fts USING fts5(
    id UNINDEXED,
    user_id UNINDEXED,
    title,
    description,
    notes,
    url
  );

  -- Triggers to keep FTS table in sync
  CREATE TRIGGER IF NOT EXISTS bookmarks_ai AFTER INSERT ON bookmarks BEGIN
    INSERT INTO bookmarks_fts(id, user_id, title, description, notes, url)
    VALUES (new.id, new.user_id, new.title, new.description, new.notes, new.url);
  END;

  CREATE TRIGGER IF NOT EXISTS bookmarks_ad AFTER DELETE ON bookmarks BEGIN
    DELETE FROM bookmarks_fts WHERE id = old.id;
  END;

  CREATE TRIGGER IF NOT EXISTS bookmarks_au AFTER UPDATE ON bookmarks BEGIN
    UPDATE bookmarks_fts SET
      title = new.title,
      description = new.description,
      notes = new.notes,
      url = new.url
    WHERE id = old.id;
  END;
`);

// Migration: Initial population of FTS table if empty
const ftsCount = (db.prepare("SELECT COUNT(*) as count FROM bookmarks_fts").get() as { count: number }).count;
if (ftsCount === 0) {
  db.exec(`
    INSERT INTO bookmarks_fts(id, user_id, title, description, notes, url)
    SELECT id, user_id, title, description, notes, url FROM bookmarks;
  `);
}

// Migration: add thumbnail column if missing (for existing DBs)
try {
  db.exec("ALTER TABLE bookmarks ADD COLUMN thumbnail TEXT");
} catch (e) {
  // Column already exists or error
}

// Migration: add github_token to users if missing
try {
  db.exec("ALTER TABLE users ADD COLUMN github_token TEXT");
} catch (e) {
  // Column already exists
}

// Migration: add pagination_limit to users if missing
try {
  db.exec("ALTER TABLE users ADD COLUMN pagination_limit INTEGER DEFAULT 30");
} catch (e) {
  // Column already exists
}

// Migration: add telegram columns to users if missing
try {
  db.exec("ALTER TABLE users ADD COLUMN telegram_chat_id TEXT");
} catch (e) {
  // Column already exists
}

try {
  db.exec("ALTER TABLE users ADD COLUMN telegram_linking_token TEXT");
} catch (e) {
  // Column already exists
}

try {
  db.exec("ALTER TABLE users ADD COLUMN reddit_rss_url TEXT");
} catch (e) {
  // Column already exists
}

try {
  db.exec("ALTER TABLE users ADD COLUMN last_reddit_sync_at DATETIME");
} catch (e) {
  // Column already exists
}

export default db;

// Helper to generate IDs
export function generateId(): string {
  return crypto.randomUUID();
}
