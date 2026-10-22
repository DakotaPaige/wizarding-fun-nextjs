export const HP_API_BASE_URL = "https://hp-api.onrender.com";
export const HP_API_TIMEOUT_MS = 4000;
export const HP_API_REVALIDATE_SECONDS = 86400;

export type HpApiEndpoint = "characters" | "spells";

/**
 * GETs a JSON payload from HP-API. Rejects on network failure, non-2xx
 * responses, invalid JSON, or when the request exceeds the timeout.
 */
export async function fetchHpApi(
  endpoint: HpApiEndpoint,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  // Rejecting here (as well as aborting) guarantees we give up on time even
  // if a fetch implementation ignores the abort signal.
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`HP-API ${endpoint} timed out after ${HP_API_TIMEOUT_MS}ms`));
    }, HP_API_TIMEOUT_MS);
  });

  const request = (async () => {
    const response = await fetchImpl(`${HP_API_BASE_URL}/api/${endpoint}`, {
      signal: controller.signal,
      next: { revalidate: HP_API_REVALIDATE_SECONDS },
    });
    if (!response.ok) {
      throw new Error(`HP-API ${endpoint} responded ${response.status}`);
    }
    return (await response.json()) as unknown;
  })();

  try {
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
