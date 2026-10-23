export { getRedis } from "./redis";
export { hashIp } from "./hash-ip";

export interface RedisLike {
  get(key: string): Promise<number | string | null>;
  /** Redis SET with EX; with `nx`, only when the key is absent ("OK" if written, else null). */
  set(key: string, value: string, opts: { nx?: boolean; ex: number }): Promise<"OK" | null>;
  incrby(key: string, by: number): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
}

/** Tokens set aside for one AI call before it is made (a turn uses about 1,300); reconciled afterwards. */
export const AI_CALL_TOKEN_ESTIMATE = 1_500;
/** AI calls one game may make: 10 turns plus the verdict. */
export const AI_CALLS_PER_GAME = 11;

export interface BudgetGuard {
  /**
   * Counts a new game against the per-IP limit; false if it is over the limit. Idempotent per
   * game (`seed`): a retried first turn is not counted again and gets the same answer.
   */
  tryStartGame(ipHash: string, now: Date, seed: number): Promise<boolean>;
  /** Read-only: true only when `tryStartGame` marked this game (hash, seed, UTC day) as allowed. */
  isGameAllowed(ipHash: string, now: Date, seed: number): Promise<boolean>;
  /** Counts one AI call for this game; false once it has made `AI_CALLS_PER_GAME` calls. */
  tryCountAiCall(ipHash: string, now: Date, seed: number): Promise<boolean>;
  /** True while one more reservation would fit in today's budget (the check `reserveTokens` makes). */
  hasBudget(now: Date): Promise<boolean>;
  /**
   * Atomically adds `AI_CALL_TOKEN_ESTIMATE` to today's counter and keeps it only if the new
   * total is within the budget; otherwise releases it and returns false.
   */
  reserveTokens(now: Date): Promise<boolean>;
  /** Replaces a reservation with the tokens the call actually used (0 releases it entirely). */
  settleTokens(actualTokens: number, now: Date): Promise<void>;
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
  const gameMarker = (ipHash: string, now: Date, seed: number) => `ai:game:${ipHash}:${seed}:${utcDate(now)}`;
  const tokensKey = (now: Date) => `ai:tokens:${utcDate(now)}`;

  async function increment(key: string, by: number): Promise<number> {
    const total = await redis.incrby(key, by);
    await redis.expire(key, TTL_SECONDS);
    return total;
  }

  return {
    async tryStartGame(ipHash, now, seed) {
      const marker = gameMarker(ipHash, now, seed);
      // Claim the game first; only the request that claims it counts it.
      const claimed = await redis.set(marker, ALLOWED, { nx: true, ex: TTL_SECONDS });
      if (claimed === null) return String(await redis.get(marker)) !== DENIED;

      const allowed = (await increment(`ai:games:${ipHash}:${utcDate(now)}`, 1)) <= gamesPerIpPerDay;
      if (!allowed) await redis.set(marker, DENIED, { ex: TTL_SECONDS });
      return allowed;
    },
    async isGameAllowed(ipHash, now, seed) {
      return String(await redis.get(gameMarker(ipHash, now, seed))) === ALLOWED;
    },
    async tryCountAiCall(ipHash, now, seed) {
      return (await increment(`ai:calls:${ipHash}:${seed}:${utcDate(now)}`, 1)) <= AI_CALLS_PER_GAME;
    },
    async hasBudget(now) {
      return toCount(await redis.get(tokensKey(now))) + AI_CALL_TOKEN_ESTIMATE <= dailyTokenBudget;
    },
    async reserveTokens(now) {
      const total = await increment(tokensKey(now), AI_CALL_TOKEN_ESTIMATE);
      if (total <= dailyTokenBudget) return true;
      await redis.incrby(tokensKey(now), -AI_CALL_TOKEN_ESTIMATE);
      return false;
    },
    async settleTokens(actualTokens, now) {
      // An unusable number keeps the estimate rather than guessing low.
      if (!Number.isFinite(actualTokens) || actualTokens < 0) return;
      const delta = Math.round(actualTokens) - AI_CALL_TOKEN_ESTIMATE;
      if (delta !== 0) await increment(tokensKey(now), delta);
    },
  };
}
