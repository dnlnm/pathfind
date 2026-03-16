import { MetadataProvider, FetchedMetadata } from "./types";
import { RedditProvider } from "./providers/reddit";
import { YouTubeProvider } from "./providers/youtube";

const providers: MetadataProvider[] = [
    new RedditProvider(),
    new YouTubeProvider(),
];

export async function fetchWithProviders(url: URL, options?: { signal?: AbortSignal }): Promise<FetchedMetadata | null> {
    // Sort by priority (descending)
    const sortedProviders = [...providers].sort((a, b) => b.priority - a.priority);

    for (const provider of sortedProviders) {
        if (provider.match(url)) {
            try {
                const result = await provider.fetch(url, options);
                if (result && result.title) {
                    return result;
                }
            } catch (e) {
                console.error(`[Metadata] Provider ${provider.name} failed:`, e);
            }
        }
    }

    return null;
}
