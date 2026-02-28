export interface DbUser {
    id: string;
    email: string;
    name: string | null;
    password: string;
    created_at: string;
    updated_at: string;
}

export interface DbBookmark {
    id: string;
    url: string;
    title: string | null;
    description: string | null;
    notes: string | null;
    favicon: string | null;
    thumbnail: string | null;
    is_archived: number;
    is_read_later: number;
    created_at: string;
    updated_at: string;
    user_id: string;
}

export interface DbTag {
    id: string;
    name: string;
    created_at: string;
}

export interface DbBookmarkTag {
    bookmark_id: string;
    tag_id: string;
}

export interface DbCollection {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    color: string | null;
    user_id: string;
    created_at: string;
    updated_at: string;
}

export interface DbBookmarkCollection {
    bookmark_id: string;
    collection_id: string;
}

// Frontend-facing types
export interface BookmarkWithTags {
    id: string;
    url: string;
    title: string | null;
    description: string | null;
    notes: string | null;
    favicon: string | null;
    thumbnail: string | null;
    isArchived: boolean;
    isReadLater: boolean;
    createdAt: string;
    updatedAt: string;
    userId: string;
    tags: { id: string; name: string }[];
    collections?: { id: string; name: string; color?: string | null }[];
}

export interface TagWithCount {
    id: string;
    name: string;
    createdAt: string;
    count: number;
}

export interface CollectionWithCount {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    color: string | null;
    count: number;
}

// Rule Engine types
export type RuleEvent = 'bookmark.created' | 'bookmark.updated';
export type ConditionField = 'url' | 'title' | 'description' | 'domain';
export type ConditionOperator = 'contains' | 'starts_with' | 'equals' | 'matches_regex';
export type ActionType = 'add_tags' | 'add_to_collection' | 'mark_read_later' | 'mark_archived';

export interface RuleCondition {
    field: ConditionField;
    operator: ConditionOperator;
    value: string;
}

export interface RuleAction {
    type: ActionType;
    params: Record<string, any>;
}

export interface DbRule {
    id: string;
    name: string;
    event: string;
    condition_logic: string;
    conditions: string;
    actions: string;
    enabled: number;
    priority: number;
    user_id: string;
    created_at: string;
    updated_at: string;
}

export interface Rule {
    id: string;
    name: string;
    event: RuleEvent;
    conditionLogic: 'AND' | 'OR';
    conditions: RuleCondition[];
    actions: RuleAction[];
    enabled: boolean;
    priority: number;
    createdAt: string;
    updatedAt: string;
}
