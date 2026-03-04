export type UserRole = 'admin' | 'user';

export interface DbUser {
    id: string;
    email: string;
    name: string | null;
    username: string | null;
    password: string;
    role: UserRole;
    created_at: string;
    updated_at: string;
}

export interface DbBookmark {
    id: string;
    url: string;
    title: string | null;
    description: string | null;
    notes: string | null;
    thumbnail: string | null;
    is_archived: number;
    is_read_later: number;
    is_nsfw: number;
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
    isNsfw: boolean;
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
export type ConditionField =
    | 'url' | 'title' | 'description' | 'domain'
    | 'tags' | 'collection'
    | 'is_archived' | 'is_read_later' | 'is_nsfw'
    | 'always_true';
export type ConditionOperator =
    | 'contains' | 'not_contains'
    | 'starts_with' | 'ends_with'
    | 'equals' | 'not_equals'
    | 'matches_regex'
    | 'is_true' | 'is_false'
    | 'is_empty' | 'is_not_empty';
export type ActionType =
    | 'add_tags' | 'remove_tags'
    | 'add_to_collection' | 'remove_from_collection'
    | 'mark_read_later' | 'unmark_read_later'
    | 'mark_archived' | 'unmark_archived'
    | 'mark_nsfw' | 'unmark_nsfw';

// User NSFW display preference
export type NsfwDisplay = 'blur' | 'hide' | 'show';

export interface RuleCondition {
    field: ConditionField;
    operator: ConditionOperator;
    value: string; // May be empty string for always_true / boolean conditions
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
