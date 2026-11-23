import { describe, expect, it, vi } from "vitest";
import { fakeRedis } from "@/test/fake-redis";
import { hashIp } from "@/quiz/budget/hash-ip";
import {
  AI_CALL_TOKEN_ESTIMATE,
  AI_CALLS_PER_GAME,
  createBudgetGuard,
  type BudgetGuard,
} from "@/quiz/budget/budget-guard";
import { readQuizConfig, type QuizConfig } from "@/quiz/config";
import { selectQuizmaster } from "@/quiz/select-quizmaster";
import type { GameState, Quizmaster, TurnRecord } from "@/quiz/types";

const NOW = new Date("2026-10-22T12:00:00Z");
const CONFIG: QuizConfig = {
  apiKey: "sk-test",
  model: "claude-haiku-5-5",
  dailyTokenBudget: 200_000,
  gamesPerIpPerDay: 3,
  ipSalt: "salt",
};
const IP = "1.2.3.4";
const IP_HASH = hashIp(IP, "salt");
const classic = { mode: "classic" } as Quizmaster;
const ai = { mode: "ai" } as Quizmaster;
const TURN: TurnRecord = { topic: "wand", difficulty: "normal", dared: false, correct: true, msToAnswer: 1 };
const state = (over: Partial<GameState> = {}): GameState => ({ seed: 1, mode: "ai", turns: [], ...over });
const turns = (n: number) => Array.from({ length: n }, () => TURN);

function mockGuard(over: Partial<BudgetGuard> = {}): BudgetGuard {
  return {
    tryStartGame: vi.fn().mockResolvedValue(true),
    isGameAllowed: vi.fn().mockResolvedValue(true),
    tryCountAiCall: vi.fn().mockResolvedValue(true),
    hasBudget: vi.fn().mockResolvedValue(true),
    reserveTokens: vi.fn().mockResolvedValue(true),
    settleTokens: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

function select(over: Partial<Parameters<typeof selectQuizmaster>[0]> = {}) {
  return selectQuizmaster({
    state: state(),
    ip: IP,
    now: NOW,
    elapsedMs: 0,
    config: CONFIG,
    guard: mockGuard(),
    makeAi: vi.fn(() => ai),
    classic,
    ...over,
  });
}

/** The real guard over the in-memory Redis. */
function realGuard(budget = CONFIG.dailyTokenBudget) {
  const fake = fakeRedis();
  const guard = createBudgetGuard({ redis: fake.redis, dailyTokenBudget: budget, gamesPerIpPerDay: 3 });
  return { ...fake, guard };
}

describe("selectQuizmaster", () => {
  it("returns classic when the game is already classic", async () => {
    const g = mockGuard();
    expect(await select({ state: state({ mode: "classic" }), guard: g })).toBe(classic);
    expect(g.tryStartGame).not.toHaveBeenCalled();
  });

  it.each([
    ["no API key", { config: { ...CONFIG, apiKey: null } }],
    ["no guard", { guard: null }],
    ["no IP", { ip: null }],
    ["no salt", { config: { ...CONFIG, ipSalt: null } }],
  ])("returns classic with %s", async (_name, over) => {
    expect(await select(over)).toBe(classic);
  });

  it("returns classic on turn 0 when the per-IP limit is reached, hashing the IP and passing the seed", async () => {
    const g = mockGuard({ tryStartGame: vi.fn().mockResolvedValue(false) });
    expect(await select({ guard: g, state: state({ seed: 99 }) })).toBe(classic);
    expect(g.tryStartGame).toHaveBeenCalledWith(IP_HASH, NOW, 99);
  });

  it("returns classic when the token reservation is refused", async () => {
    expect(await select({ guard: mockGuard({ reserveTokens: vi.fn().mockResolvedValue(false) }) })).toBe(classic);
  });

  it("returns the AI quizmaster with the time-budgeted timeout when everything allows it", async () => {
    const makeAi = vi.fn(() => ai);
    expect(await select({ makeAi })).toBe(ai);
    expect(makeAi).toHaveBeenCalledWith({ timeoutMs: 6000 });
    expect(await select({ makeAi, elapsedMs: 4000 })).toBe(ai);
    expect(makeAi).toHaveBeenLastCalledWith({ timeoutMs: 4500 });
  });

  it("skips the AI, before touching Redis, when too little request time is left", async () => {
    const g = mockGuard();
    const makeAi = vi.fn(() => ai);
    expect(await select({ guard: g, makeAi, elapsedMs: 7500 })).toBe(classic);
    expect(makeAi).not.toHaveBeenCalled();
    expect(g.tryStartGame).not.toHaveBeenCalled();
    expect(g.reserveTokens).not.toHaveBeenCalled();
  });

  it("counts a game only on turn 0 and checks its marker afterwards", async () => {
    const g = mockGuard();
    expect(await select({ guard: g, state: state({ seed: 5, turns: turns(1) }) })).toBe(ai);
    expect(g.tryStartGame).not.toHaveBeenCalled();
    expect(g.isGameAllowed).toHaveBeenCalledWith(IP_HASH, NOW, 5);
  });

  describe("with the real guard over in-memory Redis", () => {
    it("(a) returns classic for turn 3 when the game was never started (no marker)", async () => {
      const { guard, store } = realGuard();
      expect(await select({ guard, state: state({ turns: turns(3) }) })).toBe(classic);
      // Nothing was reserved or counted for a game that does not exist.
      expect(store.get("ai:tokens:2026-10-22")).toBeUndefined();
    });

    it("(a) returns classic for the verdict when the game was never started", async () => {
      const { guard } = realGuard();
      expect(await select({ guard, state: state({ turns: turns(10) }) })).toBe(classic);
    });

    it("(a) returns classic for later turns of a game that was denied at the per-IP limit", async () => {
      const { guard } = realGuard();
      for (let seed = 1; seed <= 3; seed++) expect(await select({ guard, state: state({ seed }) })).toBe(ai);
      expect(await select({ guard, state: state({ seed: 4 }) })).toBe(classic);
      expect(await select({ guard, state: state({ seed: 4, turns: turns(2) }) })).toBe(classic);
      expect(await select({ guard, state: state({ seed: 2, turns: turns(2) }) })).toBe(ai);
    });

    it("(a) allows the later turns and verdict of a started game", async () => {
      const { guard } = realGuard();
      expect(await select({ guard, state: state({ seed: 8 }) })).toBe(ai);
      expect(await select({ guard, state: state({ seed: 8, turns: turns(4) }) })).toBe(ai);
      expect(await select({ guard, state: state({ seed: 8, turns: turns(10) }) })).toBe(ai);
    });

    it(`(b) caps one game at ${AI_CALLS_PER_GAME} AI calls, then classic`, async () => {
      const { guard } = realGuard();
      const picks = [];
      for (let i = 0; i < AI_CALLS_PER_GAME + 3; i++) {
        picks.push(await select({ guard, state: state({ seed: 3, turns: turns(Math.min(i, 10)) }) }));
      }
      expect(picks.filter((p) => p === ai)).toHaveLength(AI_CALLS_PER_GAME);
      expect(picks.slice(AI_CALLS_PER_GAME).every((p) => p === classic)).toBe(true);
    });

    it("(c) reserves the estimate before the AI call and refuses once the budget is reserved", async () => {
      const { guard, store } = realGuard(AI_CALL_TOKEN_ESTIMATE * 2);
      const makeAi = vi.fn(() => {
        // The reservation is already in place when the AI quizmaster is built.
        expect(store.get("ai:tokens:2026-10-22")).toBeGreaterThanOrEqual(AI_CALL_TOKEN_ESTIMATE);
        return ai;
      });
      const picks = await Promise.all([1, 2, 3, 4].map((seed) => select({ guard, makeAi, state: state({ seed }) })));
      expect(picks.filter((p) => p === ai)).toHaveLength(2);
      expect(store.get("ai:tokens:2026-10-22")).toBe(AI_CALL_TOKEN_ESTIMATE * 2);
    });

    it("(e) returns classic, not an error, when Redis fails at any step", async () => {
      for (const st of [state(), state({ turns: turns(3) }), state({ turns: turns(10) })]) {
        const { guard, state: redisState } = realGuard();
        redisState.fail = true;
        expect(await select({ guard, state: st })).toBe(classic);
      }
    });

    it("(e) returns classic when a later guard step throws", async () => {
      const steps = ["isGameAllowed", "tryCountAiCall", "reserveTokens"] as const;
      for (const step of steps) {
        const g = mockGuard({ [step]: vi.fn().mockRejectedValue(new Error("redis down")) });
        expect(await select({ guard: g, state: state({ turns: turns(2) }) })).toBe(classic);
      }
      const g = mockGuard({ tryStartGame: vi.fn().mockRejectedValue(new Error("redis down")) });
      expect(await select({ guard: g })).toBe(classic);
    });
  });
});

describe("readQuizConfig", () => {
  it("uses defaults when env is empty", () => {
    expect(readQuizConfig({})).toEqual({
      apiKey: null,
      model: "claude-haiku-5-5",
      dailyTokenBudget: 200000,
      gamesPerIpPerDay: 3,
      ipSalt: null,
    });
  });

  it("reads valid values", () => {
    expect(
      readQuizConfig({
        ANTHROPIC_API_KEY: "k",
        QUIZ_MODEL: "claude-opus-5-5",
        AI_DAILY_TOKEN_BUDGET: "500",
        AI_GAMES_PER_IP_PER_DAY: "7",
        IP_HASH_SALT: "s",
      }),
    ).toEqual({ apiKey: "k", model: "claude-opus-5-5", dailyTokenBudget: 500, gamesPerIpPerDay: 7, ipSalt: "s" });
  });

  it.each(["", "  ", "abc", "0", "-5", "NaN"])("falls back for numeric value %j", (v) => {
    const c = readQuizConfig({ AI_DAILY_TOKEN_BUDGET: v, AI_GAMES_PER_IP_PER_DAY: v });
    expect(c.dailyTokenBudget).toBe(200000);
    expect(c.gamesPerIpPerDay).toBe(3);
  });

  it("falls back for unknown model and treats empty strings as missing", () => {
    const c = readQuizConfig({ QUIZ_MODEL: "gpt-4", ANTHROPIC_API_KEY: "", IP_HASH_SALT: "" });
    expect(c).toMatchObject({ model: "claude-haiku-5-5", apiKey: null, ipSalt: null });
  });
});
