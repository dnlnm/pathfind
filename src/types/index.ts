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
    collections?: { id: string; name: string }[];
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
