/**
 * Canonical URL normalization for duplicate detection.
 *
 * Transforms a URL into a canonical form so that trivially different URLs
 * (tracking params, www prefix, trailing slash, etc.) resolve to the same key.
 */

const TRACKING_PARAMS = new Set([
    // Google / GA
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
    // Facebook / Meta
    "fbclid", "fb_action_ids", "fb_action_types", "fb_ref", "fb_source",
    // Microsoft / Bing
    "msclkid",
    // Google Ads
    "gclid", "gclsrc", "dclid", "gbraid", "wbraid",
    // Mailchimp
    "mc_cid", "mc_eid",
    // HubSpot
    "hsa_cam", "hsa_grp", "hsa_mt", "hsa_src", "hsa_ad", "hsa_acc", "hsa_net", "hsa_ver", "hsa_la", "hsa_ol", "hsa_kw",
    // General
    "ref", "ref_src", "ref_url", "source", "referrer",
    // Social shares
    "si", "feature", "app",
    // Others
    "_ga", "_gl", "igshid", "s", "t",
]);

export function normalizeUrl(raw: string): string {
    try {
        const url = new URL(raw.trim());

        // 1. Lowercase scheme + hostname
        url.protocol = url.protocol.toLowerCase();
        url.hostname = url.hostname.toLowerCase();

        // 2. Remove www. prefix
        if (url.hostname.startsWith("www.")) {
            url.hostname = url.hostname.slice(4);
        }

        // 3. Remove default ports
        if (
            (url.protocol === "http:" && url.port === "80") ||
            (url.protocol === "https:" && url.port === "443")
        ) {
            url.port = "";
        }

        // 4. Remove fragment / hash
        url.hash = "";

        // 5. Strip tracking query params & sort remaining
        const params = new URLSearchParams(url.search);
        const cleaned: [string, string][] = [];
        for (const [key, value] of params) {
            if (!TRACKING_PARAMS.has(key.toLowerCase())) {
                cleaned.push([key, value]);
            }
        }
        cleaned.sort((a, b) => a[0].localeCompare(b[0]));
        url.search = cleaned.length > 0
            ? "?" + cleaned.map(([k, v]) => v ? `${k}=${v}` : k).join("&")
            : "";

        // 6. Remove trailing slash (but keep "/" for root paths)
        let result = url.toString();
        if (result.endsWith("/") && url.pathname !== "/") {
            result = result.slice(0, -1);
        }

        return result;
    } catch {
        // If URL parsing fails, return the raw string lowercased as a best-effort fallback
        return raw.trim().toLowerCase();
    }
}
