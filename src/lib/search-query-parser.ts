export interface Qualifier {
    negated: boolean;
    type: string;
    value: string;
}

export interface ParsedQuery {
    textTerms: string[];
    qualifiers: Qualifier[];
}

export function parseSearchQuery(query: string): ParsedQuery {
    const result: ParsedQuery = {
        textTerms: [],
        qualifiers: [],
    };

    if (!query) return result;

    // Regex to match tokens, respecting quoted strings
    // Matches: word, "quoted string", or qualifier:value, qualifier:"quoted value"
    const tokenRegex = /(-|!)?(?:(\w+):)?(?:\"([^\"]+)\"|(\S+))/g;
    let match;

    while ((match = tokenRegex.exec(query)) !== null) {
        const [fullToken, prefix, type, quotedValue, rawValue] = match;
        const negated = prefix === "-" || prefix === "!";
        const value = (quotedValue || rawValue || "").trim();

        if (!value) continue;

        // Handle #tag shorthand
        if (!type && value.startsWith("#")) {
            result.qualifiers.push({
                negated,
                type: "tag",
                value: value.slice(1),
            });
            continue;
        }

        if (type) {
            result.qualifiers.push({
                negated,
                type: type.toLowerCase(),
                value,
            });
        } else {
            // It's a plain text term
            if (negated) {
                // We could handle negated text search if needed, but for now just treat as term
                result.textTerms.push(`-${value}`);
            } else {
                result.textTerms.push(value);
            }
        }
    }

    return result;
}
