import { Redis } from "@upstash/redis";
import type { RedisLike } from "./budget-guard";

/** Upstash REST client from env, or null when either variable is missing/empty. Never throws. */
export function getRedis(): RedisLike | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const client = new Redis({ url, token });
  return {
    get: (key) => client.get<number | string | null>(key),
    set: async (key, value, { nx, ex }) =>
      (await client.set(key, value, nx ? { nx: true, ex } : { ex })) === "OK" ? "OK" : null,
    incrby: (key, by) => client.incrby(key, by),
    expire: (key, seconds) => client.expire(key, seconds),
  };
}
