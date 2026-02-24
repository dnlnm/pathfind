import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

let genAI: GoogleGenerativeAI | null = null;
if (apiKey) {
    genAI = new GoogleGenerativeAI(apiKey);
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
    if (!genAI) {
        console.warn("GEMINI_API_KEY is not set. Cannot generate embedding.");
        return null;
    }
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
        const result = await model.embedContent({
            content: { parts: [{ text }], role: "user" },
            outputDimensionality: 768
        } as any);
        return result.embedding.values;
    } catch (error) {
        console.error("Error generating embedding:", error);
        return null;
    }
}
