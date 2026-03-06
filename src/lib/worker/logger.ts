import db from "../db";
import fs from "fs";
import path from "path";

const LOG_PATH = path.join(process.env.DATABASE_PATH ? path.dirname(process.env.DATABASE_PATH) : path.join(process.cwd(), "data"), "worker-debug.log");
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10 MB

let writeStream: fs.WriteStream | null = null;

function getLogStream(): fs.WriteStream {
    if (!writeStream) {
        const dir = path.dirname(LOG_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        writeStream = fs.createWriteStream(LOG_PATH, { flags: "a" });
    }
    return writeStream;
}

function rotateIfNeeded() {
    try {
        if (fs.existsSync(LOG_PATH) && fs.statSync(LOG_PATH).size > MAX_LOG_SIZE) {
            if (writeStream) { writeStream.end(); writeStream = null; }
            const rotated = LOG_PATH + ".old";
            if (fs.existsSync(rotated)) fs.unlinkSync(rotated);
            fs.renameSync(LOG_PATH, rotated);
        }
    } catch {
        // Best effort
    }
}

export function logDebug(msg: string) {
    const time = new Date().toISOString();
    const formatted = `[${time}] ${msg}\n`;
    console.log(msg);
    rotateIfNeeded();
    getLogStream().write(formatted);
}

const isJobCancelledStmt = db.prepare("SELECT status FROM jobs WHERE id = ?");

export function isJobCancelled(jobId: string): boolean {
    const row = isJobCancelledStmt.get(jobId) as { status: string } | undefined;
    return !row || row.status === 'cancelled';
}
