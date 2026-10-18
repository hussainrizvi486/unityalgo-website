/** Runs once when the Next.js server starts. */
export async function register() {
    // Only the Node.js server talks to the database (not the edge runtime).
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;
    const { checkDatabaseOnStartup } = await import('./lib/db-startup-check');
    await checkDatabaseOnStartup();
}
