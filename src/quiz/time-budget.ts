/** The AI call's own timeout when the request has time to spare. */
export const AI_TIMEOUT_MS = 6000;
/** Everything a quiz request does must finish by then, under Netlify's ~10 s function limit. */
export const REQUEST_DEADLINE_MS = 8500;
/** Below this an AI call is unlikely to answer in time, so the request goes classic instead. */
export const MIN_AI_TIMEOUT_MS = 1500;

/**
 * The AI timeout for a request that started `elapsedMs` ago (data load, Redis):
 * `min(6000, 8500 − elapsed)`, or null when less than 1.5 s would remain.
 */
export function aiTimeoutFor(elapsedMs: number): number | null {
  if (Number.isNaN(elapsedMs)) return null;
  const timeout = Math.min(AI_TIMEOUT_MS, REQUEST_DEADLINE_MS - Math.max(0, elapsedMs));
  return timeout >= MIN_AI_TIMEOUT_MS ? timeout : null;
}
