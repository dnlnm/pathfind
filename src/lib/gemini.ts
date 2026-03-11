import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

let ai: GoogleGenAI | null = null;
if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
}

const MAX_INPUT_LENGTH = 10_000;
const MAX_RETRIES = 3;

export async function generateEmbedding(text: string): Promise<number[] | null> {
    if (!ai) {
        console.warn("GEMINI_API_KEY is not set. Cannot generate embedding.");
        return null;
    }

    const truncatedText = text.length > MAX_INPUT_LENGTH ? text.substring(0, MAX_INPUT_LENGTH) : text;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const result = await ai.models.embedContent({
                model: "gemini-embedding-2-preview",
                contents: truncatedText,
                config: {
                    outputDimensionality: 768
                }
            });
            return result.embeddings?.[0]?.values || null;
        } catch (error: any) {
            const status = error?.status || error?.code;
            const isRetryable = status === 429 || status === 503 || status === 500;

            if (isRetryable && attempt < MAX_RETRIES - 1) {
                const delayMs = Math.pow(2, attempt) * 1000 + Math.random() * 500;
                console.warn(`[Gemini] Retryable error (${status}), retrying in ${Math.round(delayMs)}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                continue;
            }

            console.error("Error generating embedding:", error);
            return null;
        }
    }
    return null;
}
