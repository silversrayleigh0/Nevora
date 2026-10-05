// Sliding-window limit per user. State lives in the function instance, so it is
// a first line of defence against runaway clients, not a hard global quota.
// Set a credit limit on the OpenRouter key for a hard spending cap.
const hits = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;

export function takeToken(uid: string, perHour: number): boolean {
  const now = Date.now();
  const recent = (hits.get(uid) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= perHour) {
    hits.set(uid, recent);
    return false;
  }
  recent.push(now);
  hits.set(uid, recent);
  if (hits.size > 5000) {
    for (const [key, times] of hits) if (!times.some((t) => now - t < WINDOW_MS)) hits.delete(key);
  }
  return true;
}
