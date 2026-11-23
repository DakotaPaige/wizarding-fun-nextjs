import { Redis } from "@upstash/redis";
import type { RedisLike } from "./budget-guard";

/**
 * Upstash REST client from env, or null when either variable is missing/empty or invalid, so the
 * quiz falls back to classic mode. Never throws: a bad value (e.g. one pasted with its quotes
 * into a host's env settings) must not take the page down.
 */
export function getRedis(): RedisLike | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  let client: Redis;
  try {
    client = new Redis({ url, token });
  } catch (error) {
    // The value is a secret, so only the reason is logged.
    console.warn(
      `UPSTASH_REDIS_REST_URL is invalid (it must start with https:// and have no quotes); the quiz runs in classic mode. ${error instanceof Error ? error.name : ""}`,
    );
    return null;
  }
  return {
    get: (key) => client.get<number | string | null>(key),
    set: async (key, value, { nx, ex }) =>
      (await client.set(key, value, nx ? { nx: true, ex } : { ex })) === "OK" ? "OK" : null,
    incrby: (key, by) => client.incrby(key, by),
    expire: (key, seconds) => client.expire(key, seconds),
  };
}
