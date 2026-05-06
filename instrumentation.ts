export async function register() {
  // Skip pg-boss workers on Vercel — serverless functions are ephemeral
  // and cannot maintain the persistent DB connections pg-boss requires.
  if (process.env.NEXT_RUNTIME === "nodejs" && !process.env.VERCEL) {
    const { startWorkers } = await import("@/lib/queue/workers");
    await startWorkers();
  }
}
