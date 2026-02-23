export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { startWorker } = await import('./lib/worker');
        const { ensureAdminUser } = await import('./lib/seed');

        ensureAdminUser();

        startWorker().catch(err => {
            console.error('[Worker] Failed to start:', err);
        });
    }
}
