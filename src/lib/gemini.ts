import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
import * as path from "node:path";
const apiKey = process.env.GEMINI_API_KEY;

let ai: GoogleGenAI | null = null;
if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
}

const MAX_INPUT_LENGTH = 10_000;
const MAX_RETRIES = 3;

export async function generateEmbedding(text: string, imagePath?: string | null, taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" | "SEMANTIC_SIMILARITY" = "RETRIEVAL_DOCUMENT"): Promise<number[] | null> {
    if (!ai) {
        console.warn("GEMINI_API_KEY is not set. Cannot generate embedding.");
        return null;
    }

    const truncatedText = text.length > MAX_INPUT_LENGTH ? text.substring(0, MAX_INPUT_LENGTH) : text;
    
    let parts: any[] = [{ text: truncatedText }];
    
    if (imagePath && imagePath.startsWith('thumbnails/')) {
        try {
            const absolutePath = path.join(process.cwd(), 'public', imagePath);
            if (fs.existsSync(absolutePath)) {
                const imgBase64 = fs.readFileSync(absolutePath, { encoding: "base64" });
                const ext = path.extname(absolutePath).toLowerCase();
                let mimeType = 'image/jpeg';
                if (ext === '.png') mimeType = 'image/png';
                else if (ext === '.webp') mimeType = 'image/webp';
                else if (ext === '.gif') mimeType = 'image/gif';
                
                parts.push({
                    inlineData: { mimeType, data: imgBase64 }
                });
            }
        } catch (e) {
            console.error("Failed to load image for embedding:", e);
        }
    }

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const result = await ai.models.embedContent({
                model: "gemini-embedding-2-preview",
                contents: { parts },
                config: {
                    outputDimensionality: 768,
                    taskType
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
