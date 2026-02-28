import db, { generateId } from "./db";
import { DbRule, RuleCondition, RuleAction, DbBookmark } from "@/types";

/**
 * Evaluate all enabled rules for a given event and apply matching actions.
 */
export async function evaluateRules(
    event: string,
    bookmark: DbBookmark,
    userId: string
): Promise<void> {
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

            if (matchesConditions(conditions, conditionLogic, bookmark)) {
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
    bookmark: DbBookmark
): boolean {
    if (conditions.length === 0) return true;

    const results = conditions.map(c => evaluateCondition(c, bookmark));

    if (logic === "OR") {
        return results.some(r => r);
    }
    // Default: AND
    return results.every(r => r);
}

/**
 * Evaluate a single condition against the bookmark.
 */
function evaluateCondition(condition: RuleCondition, bookmark: DbBookmark): boolean {
    let fieldValue: string;

    switch (condition.field) {
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

    const target = condition.value || "";

    switch (condition.operator) {
        case "contains":
            return fieldValue.toLowerCase().includes(target.toLowerCase());
        case "starts_with":
            return fieldValue.toLowerCase().startsWith(target.toLowerCase());
        case "equals":
            return fieldValue.toLowerCase() === target.toLowerCase();
        case "matches_regex": {
            try {
                const regex = new RegExp(target, "i");
                return regex.test(fieldValue);
            } catch {
                return false;
            }
        }
        default:
            return false;
    }
}

/**
 * Execute a single action on a bookmark.
 */
function executeAction(action: RuleAction, bookmarkId: string, userId: string): void {
    switch (action.type) {
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
                linkTag.run(bookmarkId, tagRow.id);
            }
            break;
        }

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

        case "mark_read_later": {
            db.prepare(
                "UPDATE bookmarks SET is_read_later = 1, updated_at = datetime('now') WHERE id = ?"
            ).run(bookmarkId);
            break;
        }

        case "mark_archived": {
            db.prepare(
                "UPDATE bookmarks SET is_archived = 1, updated_at = datetime('now') WHERE id = ?"
            ).run(bookmarkId);
            break;
        }

        default:
            console.warn(`[RuleEngine] Unknown action type: ${action.type}`);
    }
}
