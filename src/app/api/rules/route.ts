import { NextResponse, NextRequest } from "next/server";
import db, { generateId } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { DbRule, Rule, RuleCondition, RuleAction, RuleEvent } from "@/types";

const VALID_EVENTS: RuleEvent[] = ["bookmark.created", "bookmark.updated"];
const VALID_FIELDS = ["url", "title", "description", "domain", "tags", "collection", "is_archived", "is_read_later", "is_nsfw", "always_true"];
const VALID_OPERATORS = ["contains", "not_contains", "starts_with", "ends_with", "equals", "not_equals", "matches_regex", "is_true", "is_false", "is_empty", "is_not_empty"];
const VALID_ACTION_TYPES = ["add_tags", "remove_tags", "add_to_collection", "remove_from_collection", "mark_read_later", "unmark_read_later", "mark_archived", "unmark_archived", "mark_nsfw", "unmark_nsfw"];
// These fields do not require a value string
const NO_VALUE_FIELDS = ["always_true", "is_archived", "is_read_later", "is_nsfw"];

function toRule(row: DbRule): Rule {
    return {
        id: row.id,
        name: row.name,
        event: row.event as RuleEvent,
        conditionLogic: (row.condition_logic || "AND") as "AND" | "OR",
        conditions: JSON.parse(row.conditions),
        actions: JSON.parse(row.actions),
        enabled: !!row.enabled,
        priority: row.priority,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function validateConditions(conditions: any[]): string | null {
    if (!Array.isArray(conditions) || conditions.length === 0) {
        return "At least one condition is required";
    }
    for (const c of conditions) {
        if (!VALID_FIELDS.includes(c.field)) return `Invalid condition field: ${c.field}`;
        if (!VALID_OPERATORS.includes(c.operator)) return `Invalid operator: ${c.operator}`;
        // Only require a value for fields that need one
        if (!NO_VALUE_FIELDS.includes(c.field) && (typeof c.value !== "string" || !c.value.trim())) {
            return "Condition value is required";
        }
    }
    return null;
}

function validateActions(actions: any[]): string | null {
    if (!Array.isArray(actions) || actions.length === 0) {
        return "At least one action is required";
    }
    for (const a of actions) {
        if (!VALID_ACTION_TYPES.includes(a.type)) return `Invalid action type: ${a.type}`;
        if (a.type === "add_tags" || a.type === "remove_tags") {
            if (!Array.isArray(a.params?.tags) || a.params.tags.length === 0) {
                return `${a.type} requires a non-empty tags array`;
            }
        }
        if (a.type === "add_to_collection" || a.type === "remove_from_collection") {
            if (!a.params?.collectionName?.trim()) {
                return `${a.type} requires a collectionName`;
            }
        }
    }
    return null;
}

export async function GET(request: NextRequest) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = db.prepare(
        "SELECT * FROM rules WHERE user_id = ? ORDER BY priority ASC, created_at ASC"
    ).all(userAuth.id) as DbRule[];

    return NextResponse.json({ rules: rows.map(toRule) });
}

export async function POST(request: NextRequest) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, event, conditionLogic, conditions, actions } = body;

    if (!name?.trim()) {
        return NextResponse.json({ error: "Rule name is required" }, { status: 400 });
    }
    if (!VALID_EVENTS.includes(event)) {
        return NextResponse.json({ error: `Invalid event: ${event}` }, { status: 400 });
    }

    const condError = validateConditions(conditions);
    if (condError) return NextResponse.json({ error: condError }, { status: 400 });

    const actError = validateActions(actions);
    if (actError) return NextResponse.json({ error: actError }, { status: 400 });

    const id = generateId();
    db.prepare(`
        INSERT INTO rules (id, name, event, condition_logic, conditions, actions, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        name.trim(),
        event,
        conditionLogic === "OR" ? "OR" : "AND",
        JSON.stringify(conditions),
        JSON.stringify(actions),
        userAuth.id
    );

    const created = db.prepare("SELECT * FROM rules WHERE id = ?").get(id) as DbRule;
    return NextResponse.json(toRule(created), { status: 201 });
}
