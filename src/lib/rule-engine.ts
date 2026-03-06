import { runInNewContext } from "vm";
import db, { generateId } from "./db";
import { DbRule, RuleCondition, RuleAction, DbBookmark } from "@/types";

function safeRegexTest(pattern: string, input: string, timeoutMs = 1000): boolean {
    return runInNewContext(
        `new RegExp(pattern, "i").test(input)`,
        { pattern, input },
        { timeout: timeoutMs }
    ) as boolean;
}

/**
 * Evaluate all enabled rules for a given event and apply matching actions.
 */
export function evaluateRules(
    event: string,
    bookmark: DbBookmark,
    userId: string
): void {
    const rules = db.prepare(`
        SELECT * FROM rules 
        WHERE event = ? AND user_id = ? AND enabled = 1 
        ORDER BY priority ASC
    `).all(event, userId) as DbRule[];

    for (const rule of rules) {
        try {
            const conditions: RuleCondition[] = JSON.parse(rule.conditions);
            const actions: RuleAction[] = JSON.parse(rule.actions);
            const conditionLogic = rule.condition_logic || "AND";

            if (matchesConditions(conditions, conditionLogic, bookmark, userId)) {
                for (const action of actions) {
                    executeAction(action, bookmark.id, userId);
                }
            }
        } catch (e) {
            console.error(`[RuleEngine] Error evaluating rule "${rule.name}" (${rule.id}):`, e);
        }
    }
}

/**
 * Check whether a bookmark satisfies the conditions based on AND/OR logic.
 */
function matchesConditions(
    conditions: RuleCondition[],
    logic: string,
    bookmark: DbBookmark,
    userId: string
): boolean {
    if (conditions.length === 0) return true;

    const results = conditions.map(c => evaluateCondition(c, bookmark, userId));

    if (logic === "OR") {
        return results.some(r => r);
    }
    // Default: AND
    return results.every(r => r);
}

/**
 * Evaluate a single condition against the bookmark.
 */
function evaluateCondition(condition: RuleCondition, bookmark: DbBookmark, userId: string): boolean {
    const { field, operator, value } = condition;

    // ─── Always True ───────────────────────────────────────────────────────────
    if (field === "always_true") return true;

    // ─── Boolean / Status Fields ────────────────────────────────────────────────
    if (field === "is_archived") {
        const actual = bookmark.is_archived === 1 || (bookmark.is_archived as any) === true;
        return operator === "is_true" ? actual : !actual;
    }
    if (field === "is_read_later") {
        const actual = bookmark.is_read_later === 1 || (bookmark.is_read_later as any) === true;
        return operator === "is_true" ? actual : !actual;
    }
    if (field === "is_nsfw") {
        const actual = bookmark.is_nsfw === 1 || (bookmark.is_nsfw as any) === true;
        return operator === "is_true" ? actual : !actual;
    }

    // ─── Relational Fields: tags / collection ───────────────────────────────────
    if (field === "tags") {
        const tagName = (value || "").toLowerCase().trim();
        if (!tagName) return false;
        const row = db.prepare(`
            SELECT 1 FROM bookmark_tags bt
            JOIN tags t ON t.id = bt.tag_id
            WHERE bt.bookmark_id = ? AND LOWER(t.name) = ?
        `).get(bookmark.id, tagName);
        const hasTag = !!row;
        if (operator === "equals" || operator === "contains") return hasTag;
        if (operator === "not_equals" || operator === "not_contains") return !hasTag;
        return false;
    }

    if (field === "collection") {
        const collName = (value || "").toLowerCase().trim();
        if (!collName) return false;
        const row = db.prepare(`
            SELECT 1 FROM bookmark_collections bc
            JOIN collections c ON c.id = bc.collection_id
            WHERE bc.bookmark_id = ? AND LOWER(c.name) = ? AND c.user_id = ?
        `).get(bookmark.id, collName, userId);
        const inColl = !!row;
        if (operator === "equals" || operator === "contains") return inColl;
        if (operator === "not_equals" || operator === "not_contains") return !inColl;
        return false;
    }

    // ─── String Fields: url / title / description / domain ──────────────────────
    let fieldValue: string;
    switch (field) {
        case "url":
            fieldValue = bookmark.url || "";
            break;
        case "title":
            fieldValue = bookmark.title || "";
            break;
        case "description":
            fieldValue = bookmark.description || "";
            break;
        case "domain": {
            try {
                fieldValue = new URL(bookmark.url).hostname;
            } catch {
                fieldValue = "";
            }
            break;
        }
        default:
            return false;
    }

    const target = (value || "").toLowerCase();
    const haystack = fieldValue.toLowerCase();

    switch (operator) {
        case "contains":
            return haystack.includes(target);
        case "not_contains":
            return !haystack.includes(target);
        case "starts_with":
            return haystack.startsWith(target);
        case "ends_with":
            return haystack.endsWith(target);
        case "equals":
            return haystack === target;
        case "not_equals":
            return haystack !== target;
        case "matches_regex": {
            try {
                if (value.length > 500) return false;
                return safeRegexTest(value, fieldValue.substring(0, 10_000));
            } catch {
                return false;
            }
        }
        case "is_empty":
            return fieldValue.trim() === "";
        case "is_not_empty":
            return fieldValue.trim() !== "";
        default:
            return false;
    }
}

/**
 * Execute a single action on a bookmark.
 */
function executeAction(action: RuleAction, bookmarkId: string, userId: string): void {
    switch (action.type) {

        // ─── Tag Actions ──────────────────────────────────────────────────────────
        case "add_tags": {
            const tags: string[] = action.params?.tags || [];
            const insertTag = db.prepare("INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)");
            const getTag = db.prepare("SELECT id FROM tags WHERE name = ?");
            const linkTag = db.prepare("INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)");

            for (const tagName of tags) {
                const normalized = tagName.toLowerCase().trim();
                if (!normalized) continue;
                insertTag.run(generateId(), normalized);
                const tagRow = getTag.get(normalized) as { id: string };
                if (tagRow) linkTag.run(bookmarkId, tagRow.id);
            }
            break;
        }

        case "remove_tags": {
            const tags: string[] = action.params?.tags || [];
            for (const tagName of tags) {
                const normalized = tagName.toLowerCase().trim();
                if (!normalized) continue;
                const tagRow = db.prepare("SELECT id FROM tags WHERE name = ?").get(normalized) as { id: string } | undefined;
                if (tagRow) {
                    db.prepare("DELETE FROM bookmark_tags WHERE bookmark_id = ? AND tag_id = ?").run(bookmarkId, tagRow.id);
                }
            }
            break;
        }

        // ─── Collection Actions ──────────────────────────────────────────────────
        case "add_to_collection": {
            const collectionName: string = action.params?.collectionName;
            if (!collectionName) break;

            let collectionId: string;
            const existing = db.prepare(
                "SELECT id FROM collections WHERE name = ? COLLATE NOCASE AND user_id = ?"
            ).get(collectionName, userId) as { id: string } | undefined;

            if (existing) {
                collectionId = existing.id;
            } else {
                collectionId = generateId();
                db.prepare("INSERT INTO collections (id, name, user_id) VALUES (?, ?, ?)").run(
                    collectionId, collectionName, userId
                );
            }

            db.prepare(
                "INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)"
            ).run(bookmarkId, collectionId);
            break;
        }

        case "remove_from_collection": {
            const collectionName: string = action.params?.collectionName;
            if (!collectionName) break;

            const coll = db.prepare(
                "SELECT id FROM collections WHERE name = ? COLLATE NOCASE AND user_id = ?"
            ).get(collectionName, userId) as { id: string } | undefined;

            if (coll) {
                db.prepare(
                    "DELETE FROM bookmark_collections WHERE bookmark_id = ? AND collection_id = ?"
                ).run(bookmarkId, coll.id);
            }
            break;
        }

        // ─── Status Actions ──────────────────────────────────────────────────────
        case "mark_read_later": {
            db.prepare(
                "UPDATE bookmarks SET is_read_later = 1, updated_at = datetime('now') WHERE id = ?"
            ).run(bookmarkId);
            break;
        }

        case "unmark_read_later": {
            db.prepare(
                "UPDATE bookmarks SET is_read_later = 0, updated_at = datetime('now') WHERE id = ?"
            ).run(bookmarkId);
            break;
        }

        case "mark_archived": {
            db.prepare(
                "UPDATE bookmarks SET is_archived = 1, updated_at = datetime('now') WHERE id = ?"
            ).run(bookmarkId);
            break;
        }

        case "unmark_archived": {
            db.prepare(
                "UPDATE bookmarks SET is_archived = 0, updated_at = datetime('now') WHERE id = ?"
            ).run(bookmarkId);
            break;
        }

        case "mark_nsfw": {
            db.prepare(
                "UPDATE bookmarks SET is_nsfw = 1, updated_at = datetime('now') WHERE id = ?"
            ).run(bookmarkId);
            break;
        }

        case "unmark_nsfw": {
            db.prepare(
                "UPDATE bookmarks SET is_nsfw = 0, updated_at = datetime('now') WHERE id = ?"
            ).run(bookmarkId);
            break;
        }

        default:
            console.warn(`[RuleEngine] Unknown action type: ${(action as any).type}`);
    }
}
