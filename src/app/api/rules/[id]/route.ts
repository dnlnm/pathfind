import { NextResponse, NextRequest } from "next/server";
import db from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { DbRule, RuleEvent } from "@/types";

const VALID_EVENTS: RuleEvent[] = ["bookmark.created", "bookmark.updated"];
const VALID_FIELDS = ["url", "title", "description", "domain", "tags", "collection", "is_archived", "is_read_later", "is_nsfw", "always_true"];
const VALID_OPERATORS = ["contains", "not_contains", "starts_with", "ends_with", "equals", "not_equals", "matches_regex", "is_true", "is_false", "is_empty", "is_not_empty"];
const VALID_ACTION_TYPES = ["add_tags", "remove_tags", "add_to_collection", "remove_from_collection", "mark_read_later", "unmark_read_later", "mark_archived", "unmark_archived", "mark_nsfw", "unmark_nsfw"];
const NO_VALUE_FIELDS = ["always_true", "is_archived", "is_read_later", "is_nsfw"];

function toRule(row: DbRule) {
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

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = db.prepare(
        "SELECT * FROM rules WHERE id = ? AND user_id = ?"
    ).get(id, userAuth.id) as DbRule | undefined;

    if (!existing) {
        return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, event, conditionLogic, conditions, actions, enabled, priority } = body;

    // Validate if provided
    if (event !== undefined && !VALID_EVENTS.includes(event)) {
        return NextResponse.json({ error: `Invalid event: ${event}` }, { status: 400 });
    }
    if (conditions !== undefined) {
        if (!Array.isArray(conditions) || conditions.length === 0) {
            return NextResponse.json({ error: "At least one condition is required" }, { status: 400 });
        }
        for (const c of conditions) {
            if (!VALID_FIELDS.includes(c.field)) return NextResponse.json({ error: `Invalid field: ${c.field}` }, { status: 400 });
            if (!VALID_OPERATORS.includes(c.operator)) return NextResponse.json({ error: `Invalid operator: ${c.operator}` }, { status: 400 });
            if (!NO_VALUE_FIELDS.includes(c.field) && (typeof c.value !== "string" || !c.value.trim())) {
                return NextResponse.json({ error: "Condition value is required" }, { status: 400 });
            }
        }
    }
    if (actions !== undefined) {
        if (!Array.isArray(actions) || actions.length === 0) {
            return NextResponse.json({ error: "At least one action is required" }, { status: 400 });
        }
        for (const a of actions) {
            if (!VALID_ACTION_TYPES.includes(a.type)) return NextResponse.json({ error: `Invalid action type: ${a.type}` }, { status: 400 });
        }
    }

    db.prepare(`
        UPDATE rules SET
            name = ?,
            event = ?,
            condition_logic = ?,
            conditions = ?,
            actions = ?,
            enabled = ?,
            priority = ?,
            updated_at = datetime('now')
        WHERE id = ?
    `).run(
        name?.trim() || existing.name,
        event || existing.event,
        conditionLogic === "OR" ? "OR" : (conditionLogic === "AND" ? "AND" : existing.condition_logic),
        conditions ? JSON.stringify(conditions) : existing.conditions,
        actions ? JSON.stringify(actions) : existing.actions,
        enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
        priority !== undefined ? priority : existing.priority,
        id
    );

    const updated = db.prepare("SELECT * FROM rules WHERE id = ?").get(id) as DbRule;
    return NextResponse.json(toRule(updated));
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = db.prepare(
        "SELECT id FROM rules WHERE id = ? AND user_id = ?"
    ).get(id, userAuth.id);

    if (!existing) {
        return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    db.prepare("DELETE FROM rules WHERE id = ?").run(id);
    return NextResponse.json({ success: true });
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = db.prepare(
        "SELECT * FROM rules WHERE id = ? AND user_id = ?"
    ).get(id, userAuth.id) as DbRule | undefined;

    if (!existing) {
        return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    const body = await request.json();
    const { enabled } = body;

    if (enabled === undefined) {
        return NextResponse.json({ error: "enabled field is required" }, { status: 400 });
    }

    db.prepare(
        "UPDATE rules SET enabled = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(enabled ? 1 : 0, id);

    const updated = db.prepare("SELECT * FROM rules WHERE id = ?").get(id) as DbRule;
    return NextResponse.json(toRule(updated));
}
