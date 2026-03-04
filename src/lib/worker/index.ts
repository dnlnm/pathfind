import { logDebug } from "./logger";
import { runWorkerLane } from "./lane-runner";
import { runSchedulerLoop, runMaintenanceScanLoop } from "./scheduler";

let isWorkerRunning = false;

export async function startWorker() {
    if (isWorkerRunning) return;
    isWorkerRunning = true;
    logDebug("[Worker] Background worker started");

    // Parallel lanes — each one processes its own job types independently
    for (let i = 0; i < 5; i++) {
        runWorkerLane(`fast-${i}`, ["metadata_fetch"]);
    }
    runWorkerLane("sync", ["reddit_rss_sync", "github_starred_sync"]);
    runWorkerLane("bulk", ["backfill_thumbnails", "backfill_embeddings", "check_broken_links"]);
    runSchedulerLoop();
    runMaintenanceScanLoop();
}
