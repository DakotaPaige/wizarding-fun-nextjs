import { describe, expect, it } from "vitest";
import { createBudgetGuard, type RedisLike } from "./budget-guard";
import { hashIp } from "./hash-ip";

function fakeRedis() {
  const store = new Map<string, number>();
  const calls: Array<{ op: "incrby" | "expire"; key: string; arg: number }> = [];
  const redis: RedisLike = {
    async get(key) {
      return store.get(key) ?? null;
    },
    async incrby(key, by) {
      calls.push({ op: "incrby", key, arg: by });
      const next = (store.get(key) ?? 0) + by;
      store.set(key, next);
      return next;
    },
    async expire(key, seconds) {
      calls.push({ op: "expire", key, arg: seconds });
      return 1;
    },
  };
  return { redis, store, calls };
}

const day1 = new Date("2026-10-22T23:59:59Z");
const day2 = new Date("2026-10-23T00:00:01Z");

describe("createBudgetGuard", () => {
  it("refuses the 4th game for the same hash on the same UTC day when the limit is 3", async () => {
    const { redis } = fakeRedis();
    const guard = createBudgetGuard({ redis, dailyTokenBudget: 200_000, gamesPerIpPerDay: 3 });
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await guard.tryStartGame("abc", day1));
    expect(results).toEqual([true, true, true, false]);
  });

  it("uses different keys on either side of UTC midnight", async () => {
    const { redis, store } = fakeRedis();
    const guard = createBudgetGuard({ redis, dailyTokenBudget: 200_000, gamesPerIpPerDay: 1 });
    expect(await guard.tryStartGame("abc", day1)).toBe(true);
    expect(await guard.tryStartGame("abc", day2)).toBe(true);
    expect([...store.keys()].sort()).toEqual(["ai:games:abc:2026-10-22", "ai:games:abc:2026-10-23"]);
  });

  it("reports no budget once recorded tokens reach the daily budget", async () => {
    const { redis, store } = fakeRedis();
    const guard = createBudgetGuard({ redis, dailyTokenBudget: 200_000, gamesPerIpPerDay: 3 });
    expect(await guard.hasBudget(day1)).toBe(true);
    await guard.recordUsage(150_000, day1);
    expect(await guard.hasBudget(day1)).toBe(true);
    await guard.recordUsage(60_000, day1);
    expect(await guard.hasBudget(day1)).toBe(false);
    expect(store.get("ai:tokens:2026-10-22")).toBe(210_000);
    expect(await guard.hasBudget(day2)).toBe(true);
  });

  it("sets a 172800s TTL after every incrby", async () => {
    const { redis, calls } = fakeRedis();
    const guard = createBudgetGuard({ redis, dailyTokenBudget: 200_000, gamesPerIpPerDay: 3 });
    await guard.tryStartGame("abc", day1);
    await guard.recordUsage(500, day1);
    expect(calls).toEqual([
      { op: "incrby", key: "ai:games:abc:2026-10-22", arg: 1 },
      { op: "expire", key: "ai:games:abc:2026-10-22", arg: 172800 },
      { op: "incrby", key: "ai:tokens:2026-10-22", arg: 500 },
      { op: "expire", key: "ai:tokens:2026-10-22", arg: 172800 },
    ]);
  });

  it("skips the write for zero or negative usage", async () => {
    const { redis, calls } = fakeRedis();
    const guard = createBudgetGuard({ redis, dailyTokenBudget: 10, gamesPerIpPerDay: 3 });
    await guard.recordUsage(0, day1);
    await guard.recordUsage(-5, day1);
    expect(calls).toEqual([]);
  });

  it("parses numeric strings and treats junk as zero", async () => {
    const { redis, store } = fakeRedis();
    const guard = createBudgetGuard({ redis, dailyTokenBudget: 100, gamesPerIpPerDay: 3 });
    redis.get = async () => "150";
    expect(await guard.hasBudget(day1)).toBe(false);
    redis.get = async () => "oops";
    expect(await guard.hasBudget(day1)).toBe(true);
    expect(store.size).toBe(0);
  });
});

describe("hashIp", () => {
  it("is 64 hex chars, stable, salt-sensitive and never contains the IP", () => {
    const h = hashIp("1.2.3.4", "s");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIp("1.2.3.4", "s")).toBe(h);
    expect(hashIp("1.2.3.4", "t")).not.toBe(h);
    expect(h).not.toContain("1.2.3.4");
  });
});
