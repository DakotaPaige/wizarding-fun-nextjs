import { describe, expect, it, vi } from "vitest";
import { hashIp } from "@/quiz/budget/hash-ip";
import type { BudgetGuard } from "@/quiz/budget/budget-guard";
import { readQuizConfig, type QuizConfig } from "@/quiz/config";
import { selectQuizmaster } from "@/quiz/select-quizmaster";
import type { GameState, Quizmaster } from "@/quiz/types";

const NOW = new Date("2026-10-22T12:00:00Z");
const CONFIG: QuizConfig = {
  apiKey: "sk-test",
  model: "claude-haiku-5-5",
  dailyTokenBudget: 1000,
  gamesPerIpPerDay: 3,
  ipSalt: "salt",
};
const classic = { mode: "classic" } as Quizmaster;
const ai = { mode: "ai" } as Quizmaster;
const state = (over: Partial<GameState> = {}): GameState => ({ seed: 1, mode: "ai", turns: [], ...over });

function guard(over: Partial<BudgetGuard> = {}): BudgetGuard {
  return {
    tryStartGame: vi.fn().mockResolvedValue(true),
    hasBudget: vi.fn().mockResolvedValue(true),
    recordUsage: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

function select(over: Partial<Parameters<typeof selectQuizmaster>[0]> = {}) {
  const makeAi = vi.fn(() => ai);
  return selectQuizmaster({
    state: state(),
    ip: "1.2.3.4",
    now: NOW,
    config: CONFIG,
    guard: guard(),
    makeAi,
    classic,
    ...over,
  });
}

describe("selectQuizmaster", () => {
  it("returns classic when the game is already classic", async () => {
    const g = guard();
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
    const g = guard({ tryStartGame: vi.fn().mockResolvedValue(false) });
    expect(await select({ guard: g, state: state({ seed: 99 }) })).toBe(classic);
    expect(g.tryStartGame).toHaveBeenCalledWith(hashIp("1.2.3.4", "salt"), NOW, 99);
  });

  it("returns classic when the daily budget is spent", async () => {
    expect(await select({ guard: guard({ hasBudget: vi.fn().mockResolvedValue(false) }) })).toBe(classic);
  });

  it("returns the AI quizmaster when everything allows it", async () => {
    expect(await select()).toBe(ai);
  });

  it("counts a game only on turn 0", async () => {
    const g = guard();
    const turns = [{ topic: "wand", difficulty: "normal", dared: false, correct: true, msToAnswer: 1 }] as const;
    expect(await select({ guard: g, state: state({ turns: [...turns] }) })).toBe(ai);
    expect(g.tryStartGame).not.toHaveBeenCalled();
  });

  it("returns classic when the guard rejects (Redis down)", async () => {
    const g = guard({ tryStartGame: vi.fn().mockRejectedValue(new Error("redis down")) });
    expect(await select({ guard: g })).toBe(classic);
    const h = guard({ hasBudget: vi.fn().mockRejectedValue(new Error("redis down")) });
    expect(await select({ guard: h })).toBe(classic);
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
