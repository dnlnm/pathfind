import 'dotenv/config';
import Database from 'better-sqlite3';
import * as sqliteVec from "sqlite-vec";
import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY in environment variables.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

const db = new Database("data/pathfind.db");
sqliteVec.load(db);

// Ensure the virtual table exists before querying it
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS vec_bookmarks USING vec0(
    embedding float[768]
  );
`);

const missingEmbeddings = db.prepare(`
  SELECT b.rowid, b.id, b.title, b.description, b.notes 
  FROM bookmarks b
  LEFT JOIN vec_bookmarks v on b.rowid = v.rowid
  WHERE v.rowid IS NULL
`).all();

console.log(`Found ${missingEmbeddings.length} bookmarks missing semantic embeddings.`);

async function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
}

let count = 0;
for (const item of missingEmbeddings) {
    try {
        const textToEmbed = `${item.title || ''} ${item.description || ''} ${item.notes || ''}`.trim();
        if (!textToEmbed) continue;

        // Call Gemini API
        const result = await model.embedContent({
            content: { parts: [{ text: textToEmbed }], role: "user" },
            outputDimensionality: 768
        });
        const embedding = result.embedding.values;
        const f32arr = new Float32Array(embedding);

        db.prepare("INSERT INTO vec_bookmarks(rowid, embedding) VALUES (?, ?)").run(BigInt(item.rowid), f32arr);

        count++;
        console.log(`[${count}/${missingEmbeddings.length}] Embedded: ${item.title}`);

        // Avoid rate limits
        await delay(300);
    } catch (error) {
        console.error(`Error processing bookmark ${item.id}:`, error.message);
    }
}

console.log("Backfill complete!");
process.exit(0);
