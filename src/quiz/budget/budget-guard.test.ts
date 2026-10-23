import { describe, expect, it } from "vitest";
import { fakeRedis } from "@/test/fake-redis";
import { AI_CALL_TOKEN_ESTIMATE, AI_CALLS_PER_GAME, createBudgetGuard } from "./budget-guard";
import { hashIp } from "./hash-ip";

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

  it("reports budget only while one more reservation would fit", async () => {
    const { redis, store } = fakeRedis();
    const guard = createBudgetGuard({ redis, dailyTokenBudget: 10_000, gamesPerIpPerDay: 3 });
    expect(await guard.hasBudget(day1)).toBe(true);
    store.set("ai:tokens:2026-10-22", 10_000 - AI_CALL_TOKEN_ESTIMATE);
    expect(await guard.hasBudget(day1)).toBe(true);
    store.set("ai:tokens:2026-10-22", 10_000 - AI_CALL_TOKEN_ESTIMATE + 1);
    expect(await guard.hasBudget(day1)).toBe(false);
    expect(await guard.hasBudget(day2)).toBe(true);
  });

  it("parses numeric strings and treats junk as zero", async () => {
    const { redis, store } = fakeRedis();
    const guard = createBudgetGuard({ redis, dailyTokenBudget: 1_600, gamesPerIpPerDay: 3 });
    redis.get = async () => "150";
    expect(await guard.hasBudget(day1)).toBe(false);
    redis.get = async () => "oops";
    expect(await guard.hasBudget(day1)).toBe(true);
    expect(store.size).toBe(0);
  });
});

describe("isGameAllowed", () => {
  it("is true only when the game's marker exists and records allowed, and never writes", async () => {
    const { redis, calls, markers } = fakeRedis();
    const guard = createBudgetGuard({ redis, dailyTokenBudget: 200_000, gamesPerIpPerDay: 1 });
    expect(await guard.isGameAllowed("abc", day1, 1)).toBe(false);
    expect(markers).toEqual([]);
    expect(calls).toEqual([]);

    await guard.tryStartGame("abc", day1, 1);
    await guard.tryStartGame("abc", day1, 2); // over the limit: marked denied
    expect(await guard.isGameAllowed("abc", day1, 1)).toBe(true);
    expect(await guard.isGameAllowed("abc", day1, 2)).toBe(false);
    expect(await guard.isGameAllowed("other", day1, 1)).toBe(false);
    expect(await guard.isGameAllowed("abc", day2, 1)).toBe(false);
  });
});

describe("tryCountAiCall", () => {
  it(`allows ${AI_CALLS_PER_GAME} AI calls per game, keyed by hash, seed and UTC day, with a TTL`, async () => {
    const { redis, calls } = fakeRedis();
    const guard = createBudgetGuard({ redis, dailyTokenBudget: 200_000, gamesPerIpPerDay: 3 });
    const results = [];
    for (let i = 0; i < AI_CALLS_PER_GAME + 1; i++) results.push(await guard.tryCountAiCall("abc", day1, 5));
    expect(results.filter(Boolean)).toHaveLength(AI_CALLS_PER_GAME);
    expect(results.at(-1)).toBe(false);
    expect(calls.slice(0, 2)).toEqual([
      { op: "incrby", key: "ai:calls:abc:5:2026-10-22", arg: 1 },
      { op: "expire", key: "ai:calls:abc:5:2026-10-22", arg: 172800 },
    ]);
    // Another game, or the same game the next day, has its own counter.
    expect(await guard.tryCountAiCall("abc", day1, 6)).toBe(true);
    expect(await guard.tryCountAiCall("abc", day2, 5)).toBe(true);
  });
});

describe("token reservation", () => {
  it("reserves the estimate before the call and reconciles to the actual usage after it", async () => {
    const { redis, store, calls } = fakeRedis();
    const guard = createBudgetGuard({ redis, dailyTokenBudget: 200_000, gamesPerIpPerDay: 3 });
    expect(await guard.reserveTokens(day1)).toBe(true);
    expect(store.get("ai:tokens:2026-10-22")).toBe(AI_CALL_TOKEN_ESTIMATE);
    await guard.settleTokens(1_300, day1);
    expect(store.get("ai:tokens:2026-10-22")).toBe(1_300);
    await guard.reserveTokens(day1);
    await guard.settleTokens(1_800, day1);
    expect(store.get("ai:tokens:2026-10-22")).toBe(3_100);
    expect(calls.filter((c) => c.op === "expire").every((c) => c.arg === 172800)).toBe(true);
  });

  it("releases the whole reservation when the call used nothing", async () => {
    const { redis, store } = fakeRedis();
    const guard = createBudgetGuard({ redis, dailyTokenBudget: 200_000, gamesPerIpPerDay: 3 });
    await guard.reserveTokens(day1);
    await guard.settleTokens(0, day1);
    expect(store.get("ai:tokens:2026-10-22")).toBe(0);
  });

  it("keeps the estimate when the actual usage is not a usable number", async () => {
    const { redis, store, calls } = fakeRedis();
    const guard = createBudgetGuard({ redis, dailyTokenBudget: 200_000, gamesPerIpPerDay: 3 });
    await guard.reserveTokens(day1);
    const before = calls.length;
    await guard.settleTokens(Number.NaN, day1);
    await guard.settleTokens(-5, day1);
    await guard.settleTokens(AI_CALL_TOKEN_ESTIMATE, day1);
    expect(calls.length).toBe(before);
    expect(store.get("ai:tokens:2026-10-22")).toBe(AI_CALL_TOKEN_ESTIMATE);
  });

  it("checks the budget against the post-reservation total, so a burst cannot overshoot", async () => {
    const { redis, store } = fakeRedis();
    const budget = AI_CALL_TOKEN_ESTIMATE * 3;
    const guard = createBudgetGuard({ redis, dailyTokenBudget: budget, gamesPerIpPerDay: 3 });
    // Ten concurrent requests all see an empty counter before any of them is answered.
    const results = await Promise.all(Array.from({ length: 10 }, () => guard.reserveTokens(day1)));
    expect(results.filter(Boolean)).toHaveLength(3);
    // Refused reservations are released again.
    expect(store.get("ai:tokens:2026-10-22")).toBe(budget);
    expect(await guard.hasBudget(day1)).toBe(false);
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
