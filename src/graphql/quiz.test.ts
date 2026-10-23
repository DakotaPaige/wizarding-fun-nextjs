import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { parse } from "graphql";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { loadWizardingData } from "@/data/repository";
import type { WizardingData } from "@/data/types";
import { executeQuery } from "@/graphql/execute";
import type { QuizServices } from "@/quiz/services";
import { computePlayStats, sortIntoHouse } from "@/quiz/sorting";
import { availableTopics } from "@/quiz/generators/index";
import { createClassicQuizmaster } from "@/quiz/classic-quizmaster";
import type { Quizmaster, TurnRecord } from "@/quiz/types";

let data: WizardingData;
beforeAll(async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  data = await loadWizardingData({ fetchImpl: () => Promise.reject(new Error("offline")) });
  warn.mockRestore();
});

interface TurnResult {
  quizTurn: {
    mode: string;
    hatLine: string;
    question: {
      topic: string;
      options: { id: string; label: string }[];
      correctOptionId: string;
    };
  };
}
interface VerdictResult {
  quizVerdict: { house: string; verdict: string; mode: string; scores: Record<string, number> };
}
interface StateVars {
  input: { state: { seed: number; mode: string; turns: unknown[] }; dared?: boolean };
}

const doc = <R, V>(s: string) => parse(s) as TypedDocumentNode<R, V>;

const TURN = `mutation ($input: QuizTurnInput!) {
  quizTurn(input: $input) {
    mode hatLine
    question { id topic difficulty prompt artSlot correctOptionId options { id label } }
  }
}`;
const VERDICT = `mutation ($input: QuizVerdictInput!) {
  quizVerdict(input: $input) { house verdict mode scores { gryffindor slytherin ravenclaw hufflepuff } }
}`;

const turn = (i: number): TurnRecord => ({
  topic: (["wand", "spell", "house"] as const)[i % 3]!,
  difficulty: i % 2 ? "hard" : "normal",
  dared: i % 2 === 1,
  correct: i % 3 !== 0,
  msToAnswer: 1000 + i,
});
const turns = (n: number) => Array.from({ length: n }, (_, i) => turn(i));
const gqlTurns = (n: number) =>
  turns(n).map((t) => ({ ...t, topic: t.topic.toUpperCase(), difficulty: t.difficulty.toUpperCase() }));

function services(over: Partial<QuizServices> & { ai?: Quizmaster } = {}): QuizServices {
  const classic = createClassicQuizmaster({ topics: availableTopics(data) });
  return {
    config: { apiKey: "k", model: "claude-haiku-5-5", dailyTokenBudget: 1000, gamesPerIpPerDay: 3, ipSalt: "salt" },
    guard: {
      tryStartGame: vi.fn().mockResolvedValue(true),
      hasBudget: vi.fn().mockResolvedValue(true),
      recordUsage: vi.fn().mockResolvedValue(undefined),
    },
    classic,
    makeAi: () => over.ai ?? classic,
    now: new Date("2026-10-22T12:00:00Z"),
    ...over,
  };
}

const fakeAi = (over: Partial<Quizmaster> = {}): Quizmaster => ({
  mode: "ai",
  nextTurn: vi.fn().mockResolvedValue({ spec: { topic: "wand", difficulty: "normal" }, hatLine: "Hmm, a wand." }),
  verdict: vi.fn().mockResolvedValue("AI verdict text"),
  ...over,
});

const runTurn = (quiz: QuizServices, n = 0, mode = "AI", dared = false) =>
  executeQuery(
    doc<TurnResult, StateVars>(TURN),
    { input: { state: { seed: 7, mode, turns: gqlTurns(n) }, dared } },
    { data, quiz, ip: "9.9.9.9" },
  );

describe("quizTurn", () => {
  it("returns an AI question on the happy path", async () => {
    const { quizTurn } = await runTurn(services({ ai: fakeAi() }));
    expect(quizTurn.mode).toBe("AI");
    expect(quizTurn.hatLine).toBe("Hmm, a wand.");
    expect(quizTurn.question.topic).toBe("WAND");
    expect(quizTurn.question.options).toHaveLength(4);
    expect(quizTurn.question.options.map((o: { id: string }) => o.id)).toContain(quizTurn.question.correctOptionId);
  });

  it("falls back to classic when the AI throws", async () => {
    const ai = fakeAi({ nextTurn: vi.fn().mockRejectedValue(new Error("boom")) });
    const { quizTurn } = await runTurn(services({ ai }));
    expect(quizTurn.mode).toBe("CLASSIC");
    expect(quizTurn.question.options).toHaveLength(4);
    expect(ai.nextTurn).toHaveBeenCalledTimes(1);
  });

  it("uses classic when the guard rejects", async () => {
    const quiz = services({ ai: fakeAi() });
    quiz.guard = { ...quiz.guard!, tryStartGame: vi.fn().mockRejectedValue(new Error("redis")) };
    expect((await runTurn(quiz)).quizTurn.mode).toBe("CLASSIC");
  });

  it("stays classic for a classic game", async () => {
    const ai = fakeAi();
    expect((await runTurn(services({ ai }), 3, "CLASSIC")).quizTurn.mode).toBe("CLASSIC");
    expect(ai.nextTurn).not.toHaveBeenCalled();
  });

  it("tries other topics when the generator returns null", async () => {
    const noSpells = { ...data, spells: [] } as WizardingData;
    const ai = fakeAi({
      nextTurn: vi.fn().mockResolvedValue({ spec: { topic: "spell", difficulty: "normal" }, hatLine: "x" }),
    });
    const { quizTurn } = await executeQuery(
      doc<TurnResult, StateVars>(TURN),
      { input: { state: { seed: 7, mode: "AI", turns: [] }, dared: false } },
      { data: noSpells, quiz: services({ ai }), ip: "9.9.9.9" },
    );
    expect(quizTurn.mode).toBe("AI");
    expect(quizTurn.question.topic).not.toBe("SPELL");
    expect(quizTurn.question.options).toHaveLength(4);
  });

  it("rejects 10 or more turns with BAD_INPUT", async () => {
    await expect(runTurn(services(), 11)).rejects.toMatchObject({
      errors: [expect.objectContaining({ extensions: expect.objectContaining({ code: "BAD_INPUT" }) })],
    });
    await expect(runTurn(services(), 10)).rejects.toMatchObject({
      errors: [expect.objectContaining({ extensions: expect.objectContaining({ code: "BAD_INPUT" }) })],
    });
  });

  it("fails with INTERNAL when no topic can produce a question", async () => {
    const quiz = services();
    quiz.classic = createClassicQuizmaster({ topics: ["wand"] });
    quiz.makeAi = () => quiz.classic;
    const empty = { characters: [], spells: [] } as unknown as WizardingData;
    await expect(
      executeQuery(
        doc<TurnResult, StateVars>(TURN),
        { input: { state: { seed: 1, mode: "CLASSIC", turns: [] }, dared: false } },
        { data: empty, quiz },
      ),
    ).rejects.toMatchObject({
      errors: [expect.objectContaining({ extensions: expect.objectContaining({ code: "INTERNAL" }) })],
    });
  });
});

describe("quizVerdict", () => {
  const run = (quiz: QuizServices, n = 10) =>
    executeQuery(
      doc<VerdictResult, StateVars>(VERDICT),
      { input: { state: { seed: 7, mode: "AI", turns: gqlTurns(n) } } },
      { data, quiz, ip: "9.9.9.9" },
    );

  it("returns the house from sortIntoHouse and the AI verdict, without starting a game", async () => {
    const quiz = services({ ai: fakeAi() });
    const { quizVerdict } = await run(quiz);
    const expected = sortIntoHouse(computePlayStats(turns(10)));
    expect(quizVerdict.house).toBe(expected.house);
    expect(quizVerdict.scores.ravenclaw).toBeCloseTo(expected.scores.RAVENCLAW);
    expect(quizVerdict.verdict).toBe("AI verdict text");
    expect(quizVerdict.mode).toBe("AI");
    expect(quiz.guard!.tryStartGame).not.toHaveBeenCalled();
  });

  it("returns the classic verdict when the AI throws", async () => {
    const ai = fakeAi({ verdict: vi.fn().mockRejectedValue(new Error("boom")) });
    const { quizVerdict } = await run(services({ ai }));
    expect(quizVerdict.mode).toBe("CLASSIC");
    expect(quizVerdict.verdict.length).toBeGreaterThan(0);
  });

  it("requires exactly 10 turns", async () => {
    await expect(run(services(), 9)).rejects.toMatchObject({
      errors: [expect.objectContaining({ extensions: expect.objectContaining({ code: "BAD_INPUT" }) })],
    });
  });
});
