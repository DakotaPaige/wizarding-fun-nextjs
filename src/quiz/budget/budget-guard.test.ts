import { describe, expect, it } from "vitest";
import { createBudgetGuard, type RedisLike } from "./budget-guard";
import { hashIp } from "./hash-ip";

function fakeRedis() {
  const store = new Map<string, number | string>();
  const calls: Array<{ op: "incrby" | "expire"; key: string; arg: number }> = [];
  const markers: Array<{ key: string; value: string; nx: boolean; ex: number }> = [];
  const redis: RedisLike = {
    async get(key) {
      return store.get(key) ?? null;
    },
    async set(key, value, { nx = false, ex }) {
      markers.push({ key, value, nx, ex });
      if (nx && store.has(key)) return null;
      store.set(key, value);
      return "OK";
    },
    async incrby(key, by) {
      calls.push({ op: "incrby", key, arg: by });
      const next = Number(store.get(key) ?? 0) + by;
      store.set(key, next);
      return next;
    },
    async expire(key, seconds) {
      calls.push({ op: "expire", key, arg: seconds });
      return 1;
    },
  };
  return { redis, store, calls, markers };
}

const day1 = new Date("2026-10-22T23:59:59Z");
const day2 = new Date("2026-10-23T00:00:01Z");

describe("createBudgetGuard", () => {
  it("refuses the 4th game for the same hash on the same UTC day when the limit is 3", async () => {
    const { redis } = fakeRedis();
    const guard = createBudgetGuard({ redis, dailyTokenBudget: 200_000, gamesPerIpPerDay: 3 });
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await guard.tryStartGame("abc", day1, i));
    expect(results).toEqual([true, true, true, false]);
  });

  it("counts a game once however often its first turn is retried, and gives the same answer", async () => {
    const { redis, store } = fakeRedis();
    const guard = createBudgetGuard({ redis, dailyTokenBudget: 200_000, gamesPerIpPerDay: 1 });
    expect(await guard.tryStartGame("abc", day1, 7)).toBe(true);
    expect(await guard.tryStartGame("abc", day1, 7)).toBe(true);
    expect(store.get("ai:games:abc:2026-10-22")).toBe(1);

    expect(await guard.tryStartGame("abc", day1, 8)).toBe(false);
    expect(await guard.tryStartGame("abc", day1, 8)).toBe(false);
    expect(store.get("ai:games:abc:2026-10-22")).toBe(2);
    // The first game's retry still gets its original answer after the limit is reached.
    expect(await guard.tryStartGame("abc", day1, 7)).toBe(true);
  });

  it("marks each game with SET NX and a 172800s TTL, keyed by hash, seed and UTC day", async () => {
    const { redis, markers } = fakeRedis();
    const guard = createBudgetGuard({ redis, dailyTokenBudget: 200_000, gamesPerIpPerDay: 3 });
    await guard.tryStartGame("abc", day1, 42);
    expect(markers[0]).toEqual({ key: "ai:game:abc:42:2026-10-22", value: "allowed", nx: true, ex: 172800 });
  });

  it("uses different keys on either side of UTC midnight", async () => {
    const { redis, store } = fakeRedis();
    const guard = createBudgetGuard({ redis, dailyTokenBudget: 200_000, gamesPerIpPerDay: 1 });
    expect(await guard.tryStartGame("abc", day1, 1)).toBe(true);
    expect(await guard.tryStartGame("abc", day2, 1)).toBe(true);
    expect([...store.keys()].filter((k) => k.startsWith("ai:games:")).sort()).toEqual([
      "ai:games:abc:2026-10-22",
      "ai:games:abc:2026-10-23",
    ]);
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
    await guard.tryStartGame("abc", day1, 1);
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
