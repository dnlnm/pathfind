import { logDebug } from "./logger";
import { runWorkerLane } from "./lane-runner";
import { runSchedulerLoop } from "./scheduler";

let isWorkerRunning = false;

export async function startWorker() {
    if (isWorkerRunning) return;
    isWorkerRunning = true;
    logDebug("[Worker] Background worker started");

    // Parallel lanes — each one processes its own job types independently
    runWorkerLane("fast", ["metadata_fetch"]);
    runWorkerLane("sync", ["reddit_rss_sync", "github_starred_sync"]);
    runWorkerLane("bulk", ["backfill_thumbnails", "backfill_embeddings", "check_broken_links"]);
    runSchedulerLoop();
}
