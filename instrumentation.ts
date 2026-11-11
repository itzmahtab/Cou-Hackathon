/**
 * Instrumentation entry point. Next.js calls `register()` once when the server
 * boots. The Node.js runtime owns the database bootstrap; the Edge runtime has
 * nothing to do here.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'edge') return;
  await import('./instrumentation.node').then((mod) => mod.register());
}
