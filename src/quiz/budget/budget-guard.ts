export { getRedis } from "./redis";
export { hashIp } from "./hash-ip";

export interface RedisLike {
  get(key: string): Promise<number | string | null>;
  /** Redis SET with EX; with `nx`, only when the key is absent ("OK" if written, else null). */
  set(key: string, value: string, opts: { nx?: boolean; ex: number }): Promise<"OK" | null>;
  incrby(key: string, by: number): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
}

export interface BudgetGuard {
  /**
   * Counts a new game against the per-IP limit; false if it is over the limit. Idempotent per
   * game (`seed`): a retried first turn is not counted again and gets the same answer.
   */
  tryStartGame(ipHash: string, now: Date, seed: number): Promise<boolean>;
  /** True while today's recorded tokens are below the daily budget. */
  hasBudget(now: Date): Promise<boolean>;
  recordUsage(tokens: number, now: Date): Promise<void>;
}

const TTL_SECONDS = 172_800;
const ALLOWED = "allowed";
const DENIED = "denied";

function utcDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function toCount(value: number | string | null): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function createBudgetGuard(opts: {
  redis: RedisLike;
  dailyTokenBudget: number;
  gamesPerIpPerDay: number;
}): BudgetGuard {
  const { redis, dailyTokenBudget, gamesPerIpPerDay } = opts;

  async function increment(key: string, by: number): Promise<number> {
    const total = await redis.incrby(key, by);
    await redis.expire(key, TTL_SECONDS);
    return total;
  }

  return {
    async tryStartGame(ipHash, now, seed) {
      const day = utcDate(now);
      const marker = `ai:game:${ipHash}:${seed}:${day}`;
      // Claim the game first; only the request that claims it counts it.
      const claimed = await redis.set(marker, ALLOWED, { nx: true, ex: TTL_SECONDS });
      if (claimed === null) return String(await redis.get(marker)) !== DENIED;

      const allowed = (await increment(`ai:games:${ipHash}:${day}`, 1)) <= gamesPerIpPerDay;
      if (!allowed) await redis.set(marker, DENIED, { ex: TTL_SECONDS });
      return allowed;
    },
    async hasBudget(now) {
      const used = toCount(await redis.get(`ai:tokens:${utcDate(now)}`));
      return used < dailyTokenBudget;
    },
    async recordUsage(tokens, now) {
      if (tokens <= 0) return;
      await increment(`ai:tokens:${utcDate(now)}`, tokens);
    },
  };
}
