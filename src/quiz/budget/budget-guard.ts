export { getRedis } from "./redis";
export { hashIp } from "./hash-ip";

export interface RedisLike {
  get(key: string): Promise<number | string | null>;
  incrby(key: string, by: number): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
}

export interface BudgetGuard {
  /** Increments the per-IP counter; false if it is now over the limit. */
  tryStartGame(ipHash: string, now: Date): Promise<boolean>;
  /** True while today's recorded tokens are below the daily budget. */
  hasBudget(now: Date): Promise<boolean>;
  recordUsage(tokens: number, now: Date): Promise<void>;
}

const TTL_SECONDS = 172_800;

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
    async tryStartGame(ipHash, now) {
      const count = await increment(`ai:games:${ipHash}:${utcDate(now)}`, 1);
      return count <= gamesPerIpPerDay;
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
