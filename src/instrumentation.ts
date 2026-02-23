export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { startWorker } = await import('./lib/worker');
        startWorker().catch(err => {
            console.error('[Worker] Failed to start:', err);
        });
    }
}
