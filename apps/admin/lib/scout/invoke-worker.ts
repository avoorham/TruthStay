const WORKER_URL =
  process.env.SCOUT_WORKER_URL ??
  "https://hplczwepdpmtdfkijpnh.supabase.co/functions/v1/scout-worker";

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Fire-and-forget invocation of the scout-worker.
 * Does NOT await — returns immediately after dispatching the fetch.
 * Worker takes 30-180s to complete; UI polls scout_jobs for status.
 * Errors are logged but not propagated — cron backup picks up within 30s.
 */
export function invokeScoutWorkerAsync(): void {
  fetch(WORKER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  }).catch((err) => {
    console.error("[scout] Failed to invoke scout-worker:", err);
    // Intentionally swallowed — cron will retry. Don't fail the API response.
  });
}
