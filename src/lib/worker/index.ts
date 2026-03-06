import db from "../db";
import { logDebug } from "./logger";
import { runWorkerLane } from "./lane-runner";
import { runSchedulerLoop, runMaintenanceScanLoop } from "./scheduler";

let isWorkerRunning = false;

function recoverStaleJobs() {
    const result = db.prepare(`
        UPDATE jobs 
        SET status = 'pending', updated_at = datetime('now')
        WHERE status = 'processing'
    `).run();

    if (result.changes > 0) {
        logDebug(`[Worker] Recovered ${result.changes} stale job(s) stuck in 'processing' state`);
    }
}

export async function startWorker() {
    if (isWorkerRunning) return;
    isWorkerRunning = true;
    logDebug("[Worker] Background worker started");

    recoverStaleJobs();

    // Parallel lanes — each one processes its own job types independently
    for (let i = 0; i < 5; i++) {
        runWorkerLane(`fast-${i}`, ["metadata_fetch"]);
    }
    runWorkerLane("sync", ["reddit_rss_sync", "github_starred_sync"]);
    runWorkerLane("bulk", ["backfill_thumbnails", "backfill_embeddings", "check_broken_links"]);
    runSchedulerLoop();
    runMaintenanceScanLoop();
}
