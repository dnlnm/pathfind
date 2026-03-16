export interface FetchedMetadata {
    title: string | null;
    description: string | null;
    favicon: string | null;
    thumbnailUrl: string | null;
    fallbackThumbnail: string | null;
    isNsfw: boolean | undefined;
}

export interface MetadataProvider {
    name: string;
    priority: number;
    match(url: URL): boolean;
    fetch(url: URL, options?: { signal?: AbortSignal }): Promise<FetchedMetadata | null>;
}
