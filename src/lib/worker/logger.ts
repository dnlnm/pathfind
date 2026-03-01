import db from "../db";
import fs from "fs";

export function logDebug(msg: string) {
    const time = new Date().toISOString();
    const formatted = `[${time}] ${msg}\n`;
    console.log(msg);
    fs.appendFileSync("worker-debug.log", formatted);
}

export function isJobCancelled(jobId: string): boolean {
    const row = db.prepare("SELECT status FROM jobs WHERE id = ?").get(jobId) as { status: string } | undefined;
    return !row || row.status === 'cancelled';
}
