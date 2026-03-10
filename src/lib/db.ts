import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { normalizeUrl } from "./url-normalizer";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "pathfind.db");

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Load sqlite-vec extension
import * as sqliteVec from "sqlite-vec";
sqliteVec.load(db);

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

  CREATE TABLE IF NOT EXISTS favicon_colors (
    domain TEXT PRIMARY KEY,
    color TEXT NOT NULL,
    fetched_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS domain_favicons (
    domain TEXT PRIMARY KEY,
    favicon TEXT NOT NULL,
    fetched_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    color TEXT,
    is_smart INTEGER DEFAULT 0,
    query TEXT,
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

  CREATE TABLE IF NOT EXISTS rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    event TEXT NOT NULL,
    condition_logic TEXT DEFAULT 'AND',
    conditions TEXT NOT NULL,
    actions TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    priority INTEGER DEFAULT 0,
    user_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
  CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at);
  CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_collections_name_user_id ON collections(name COLLATE NOCASE, user_id);
  CREATE INDEX IF NOT EXISTS idx_api_tokens_user_id ON api_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_api_tokens_token ON api_tokens(token);
  CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
  CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
  CREATE INDEX IF NOT EXISTS idx_rules_user_id ON rules(user_id);
  CREATE INDEX IF NOT EXISTS idx_rules_event ON rules(event);

  CREATE TABLE IF NOT EXISTS maintenance_stats (
    user_id TEXT PRIMARY KEY,
    missing_thumbnails INTEGER DEFAULT 0,
    missing_embeddings INTEGER DEFAULT 0,
    scanned_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

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

  -- Vector Search Table using sqlite-vec
  CREATE VIRTUAL TABLE IF NOT EXISTS vec_bookmarks USING vec0(
    embedding float[768]
  );

  CREATE TRIGGER IF NOT EXISTS vec_bookmarks_ad AFTER DELETE ON bookmarks BEGIN
    DELETE FROM vec_bookmarks WHERE rowid = old.rowid;
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

try {
  db.exec("ALTER TABLE users ADD COLUMN github_sync_enabled INTEGER DEFAULT 0");
} catch (e) {
  // Column already exists
}

try {
  db.exec("ALTER TABLE users ADD COLUMN reddit_sync_enabled INTEGER DEFAULT 0");
} catch (e) {
  // Column already exists
}

try {
  db.exec("ALTER TABLE users ADD COLUMN last_github_sync_at DATETIME");
} catch (e) {
  // Column already exists
}

try {
  db.exec("ALTER TABLE users ADD COLUMN youtube_token TEXT");
} catch (e) { /* Column already exists */ }

try {
  db.exec("ALTER TABLE users ADD COLUMN youtube_refresh_token TEXT");
} catch (e) { /* Column already exists */ }

try {
  db.exec("ALTER TABLE users ADD COLUMN youtube_token_expires_at INTEGER");
} catch (e) { /* Column already exists */ }

try {
  db.exec("ALTER TABLE users ADD COLUMN youtube_sync_enabled INTEGER DEFAULT 0");
} catch (e) { /* Column already exists */ }

try {
  db.exec("ALTER TABLE users ADD COLUMN last_youtube_sync_at DATETIME");
} catch (e) { /* Column already exists */ }

try {
  db.exec("ALTER TABLE users ADD COLUMN youtube_playlists_sync TEXT");
} catch (e) { /* Column already exists */ }

// Migration: add favicon_colors cache table if missing
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS favicon_colors (
      domain TEXT PRIMARY KEY,
      color TEXT NOT NULL,
      fetched_at TEXT DEFAULT (datetime('now'))
    );
  `);
} catch (e) {
  // Table already exists
}

// Migration: create domain_favicons and migrate existing favicons
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS domain_favicons (
      domain TEXT PRIMARY KEY,
      favicon TEXT NOT NULL,
      fetched_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const cols = db.pragma("table_info(bookmarks)") as { name: string }[];
  if (cols.some((c) => c.name === "favicon")) {
    const bms = db.prepare("SELECT id, url, favicon FROM bookmarks WHERE favicon IS NOT NULL AND favicon != ''").all() as any[];
    const insertFavicon = db.prepare('INSERT OR IGNORE INTO domain_favicons (domain, favicon) VALUES (?, ?)');
    db.transaction(() => {
      for (const bm of bms) {
        try {
          const domain = new URL(bm.url).hostname;
          if (domain && bm.favicon) {
            insertFavicon.run(domain, bm.favicon);
          }
        } catch { } // ignore invalid urls
      }
    })();
    db.exec('ALTER TABLE bookmarks DROP COLUMN favicon;');
  }
} catch (e) {
  console.error("Migration error for domain_favicons:", e);
}

// Migration: seed default "Reddit Auto-Organize" rule for existing users
try {
  const users = db.prepare("SELECT id FROM users").all() as { id: string }[];
  for (const user of users) {
    const existing = db.prepare(
      "SELECT id FROM rules WHERE name = ? AND user_id = ?"
    ).get("Reddit Auto-Organize", user.id);
    if (!existing) {
      const ruleId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO rules (id, name, event, condition_logic, conditions, actions, enabled, priority, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        ruleId,
        "Reddit Auto-Organize",
        "bookmark.created",
        "AND",
        JSON.stringify([{ field: "domain", operator: "contains", value: "reddit.com" }]),
        JSON.stringify([
          { type: "add_to_collection", params: { collectionName: "Reddit" } },
          { type: "add_tags", params: { tags: ["reddit"] } }
        ]),
        1,
        0,
        user.id
      );
    }
  }
} catch (e) {
  // Seed may fail if rules table doesn't exist yet (first run)
}

// Migration: add available_at column to jobs for exponential backoff
try {
  db.exec("ALTER TABLE jobs ADD COLUMN available_at TEXT");
} catch (e) {
  // Column already exists
}

// Migration: broken link checker columns on bookmarks
try {
  db.exec("ALTER TABLE bookmarks ADD COLUMN link_status TEXT");
} catch (e) { /* Column already exists */ }

try {
  db.exec("ALTER TABLE bookmarks ADD COLUMN link_status_code INTEGER");
} catch (e) { /* Column already exists */ }

try {
  db.exec("ALTER TABLE bookmarks ADD COLUMN link_checked_at TEXT");
} catch (e) { /* Column already exists */ }

// Migration: link-check schedule columns on users
try {
  db.exec("ALTER TABLE users ADD COLUMN link_check_enabled INTEGER DEFAULT 0");
} catch (e) { /* Column already exists */ }

try {
  db.exec("ALTER TABLE users ADD COLUMN link_check_interval TEXT DEFAULT 'weekly'");
} catch (e) { /* Column already exists */ }

try {
  db.exec("ALTER TABLE users ADD COLUMN link_check_interval_days INTEGER DEFAULT 7");
} catch (e) { /* Column already exists */ }

try {
  db.exec("ALTER TABLE users ADD COLUMN last_link_check_at TEXT");
} catch (e) { /* Column already exists */ }

// Migration: NSFW flag on bookmarks
try {
  db.exec("ALTER TABLE bookmarks ADD COLUMN is_nsfw INTEGER DEFAULT 0");
} catch (e) { /* Column already exists */ }

// Migration: NSFW display preference on users
// Options: 'blur' (default) | 'hide' | 'show'
try {
  db.exec("ALTER TABLE users ADD COLUMN nsfw_display TEXT DEFAULT 'blur'");
} catch (e) { /* Column already exists */ }

// Migration: canonical URL for duplicate detection
try {
  db.exec("ALTER TABLE bookmarks ADD COLUMN canonical_url TEXT");
} catch (e) { /* Column already exists */ }

try {
  db.exec("CREATE INDEX IF NOT EXISTS idx_bookmarks_canonical_url ON bookmarks(canonical_url, user_id)");
} catch (e) { /* Index already exists */ }

// One-time backfill: populate canonical_url for existing bookmarks

{
  const nullCount = (db.prepare("SELECT COUNT(*) as c FROM bookmarks WHERE canonical_url IS NULL").get() as { c: number }).c;
  if (nullCount > 0) {
    const rows = db.prepare("SELECT id, url FROM bookmarks WHERE canonical_url IS NULL").all() as { id: string; url: string }[];
    const updateStmt = db.prepare("UPDATE bookmarks SET canonical_url = ? WHERE id = ?");
    db.transaction(() => {
      for (const row of rows) {
        updateStmt.run(normalizeUrl(row.url), row.id);
      }
    })();
    console.log(`[Migration] Backfilled canonical_url for ${rows.length} bookmarks`);
  }
}

// Migration: add role column to users
try {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
  // Promote all existing users to admin (they were created before multi-user)
  db.exec("UPDATE users SET role = 'admin' WHERE role = 'user' OR role IS NULL");
  console.log("[Migration] Added role column and promoted existing users to admin");
} catch (e) { /* Column already exists */ }


// Migration: add username column to users
try {
  db.exec("ALTER TABLE users ADD COLUMN username TEXT");
  // Backfill username from name (lower+strip spaces) or email prefix
  const existingUsers = db.prepare("SELECT id, name, email FROM users WHERE username IS NULL").all() as { id: string; name: string | null; email: string }[];
  const updateUsername = db.prepare("UPDATE users SET username = ? WHERE id = ?");
  const takenUsernames = new Set<string>();
  db.transaction(() => {
    for (const u of existingUsers) {
      const base = (u.name || u.email.split("@")[0])
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 28) || "user";
      let candidate = base;
      let suffix = 2;
      while (takenUsernames.has(candidate)) {
        candidate = `${base.slice(0, 25)}_${suffix++}`;
      }
      takenUsernames.add(candidate);
      updateUsername.run(candidate, u.id);
    }
  })();
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username COLLATE NOCASE)");
  console.log("[Migration] Added username column and backfilled existing users");
} catch (e) { /* Column already exists */ }

// Migration: add is_smart and query to collections
try {
  db.exec("ALTER TABLE collections ADD COLUMN is_smart INTEGER DEFAULT 0");
} catch (e) { /* Column already exists */ }

try {
  db.exec("ALTER TABLE collections ADD COLUMN query TEXT");
} catch (e) { /* Column already exists */ }

export default db;

// Helper to generate IDs
export function generateId(): string {
  return crypto.randomUUID();
}

export function upsertDomainFavicon(url: string, faviconUrl: string | null) {
  if (!faviconUrl) return;
  try {
    const domain = new URL(url).hostname;
    if (domain) {
      db.prepare(`
        INSERT OR REPLACE INTO domain_favicons (domain, favicon, fetched_at) 
        VALUES (?, ?, datetime('now'))
      `).run(domain, faviconUrl);
    }
  } catch {
    // invalid URL
  }
}
