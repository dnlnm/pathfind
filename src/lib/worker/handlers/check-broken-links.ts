import db from "../../db";
import { logDebug, isJobCancelled } from "../logger";
import { initJobProgress, updateJobProgress } from "../progress";

async function checkUrl(url: string): Promise<{ status: 'ok' | 'broken' | 'redirected'; code: number | null }> {
    const USER_AGENT = "Mozilla/5.0 (compatible; PathFind-LinkChecker/1.0)";
    const TIMEOUT_MS = 10_000;

    const tryFetch = async (method: string): Promise<Response> => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
            return await fetch(url, {
                method,
                signal: controller.signal,
                redirect: "manual",
                headers: { "User-Agent": USER_AGENT },
            });
        } finally {
            clearTimeout(timer);
        }
    };

    try {
        let res = await tryFetch("HEAD");
        // Some servers reject HEAD — retry with GET
        if (res.status === 405) {
            res = await tryFetch("GET");
        }
        const code = res.status;
        if (code >= 200 && code < 300) return { status: 'ok', code };
        if (code >= 300 && code < 400) return { status: 'redirected', code };
        return { status: 'broken', code };
    } catch {
        // Network error, DNS failure, timeout, TLS error, etc.
        return { status: 'broken', code: null };
    }
}

export async function handleCheckBrokenLinks(job: any, _payload: any) {
    const userId = job.user_id;

    const bookmarks = db.prepare(`
        SELECT id, url FROM bookmarks
        WHERE user_id = ?
        ORDER BY created_at ASC
    `).all(userId) as { id: string; url: string }[];

    const total = bookmarks.length;
    logDebug(`[Worker] Link check: ${total} bookmarks for user ${userId}`);

    if (total === 0) {
        db.prepare("UPDATE users SET last_link_check_at = datetime('now') WHERE id = ?").run(userId);
        return;
    }

    initJobProgress(job.id, total);

    const updateBookmark = db.prepare(`
        UPDATE bookmarks
        SET link_status = ?, link_status_code = ?, link_checked_at = datetime('now')
        WHERE id = ?
    `);

    for (let i = 0; i < bookmarks.length; i++) {
        if (isJobCancelled(job.id)) {
            logDebug(`[Worker] Link check job ${job.id} cancelled at ${i}/${total}`);
            return;
        }

        const bm = bookmarks[i];
        try {
            const result = await checkUrl(bm.url);
            updateBookmark.run(result.status, result.code, bm.id);
            logDebug(`[Worker] ${bm.url} → ${result.status} (${result.code ?? 'err'})`);
        } catch (e) {
            logDebug(`[Worker] Link check failed for ${bm.id}: ` + e);
            updateBookmark.run('broken', null, bm.id);
        }

        updateJobProgress(job.id, i + 1, total);

        await new Promise(resolve => setTimeout(resolve, 500));
    }

    db.prepare("UPDATE users SET last_link_check_at = datetime('now') WHERE id = ?").run(userId);
    logDebug(`[Worker] Link check complete: ${total} URLs checked for user ${userId}`);
}
