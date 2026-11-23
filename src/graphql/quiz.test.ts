import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { parse } from "graphql";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { loadWizardingData } from "@/data/repository";
import type { WizardingData } from "@/data/types";
import type { GraphQLContext } from "@/graphql/context";
import { executeQuery } from "@/graphql/execute";
import { createGraphQLServer } from "@/graphql/yoga";
import { AI_CALL_TOKEN_ESTIMATE, createBudgetGuard } from "@/quiz/budget/budget-guard";
import { fakeRedis } from "@/test/fake-redis";
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
      isGameAllowed: vi.fn().mockResolvedValue(true),
      tryCountAiCall: vi.fn().mockResolvedValue(true),
      hasBudget: vi.fn().mockResolvedValue(true),
      reserveTokens: vi.fn().mockResolvedValue(true),
      settleTokens: vi.fn().mockResolvedValue(undefined),
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

const runTurn = (quiz: QuizServices, n = 0, mode = "AI", dared = false, startedAt?: number) =>
  executeQuery(
    doc<TurnResult, StateVars>(TURN),
    { input: { state: { seed: 7, mode, turns: gqlTurns(n) }, dared } },
    { data, quiz, ip: "9.9.9.9", startedAt },
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

/** Services over the real budget guard and the in-memory Redis, with a fake AI that reports usage. */
function guardedServices(budget = 200_000) {
  const fake = fakeRedis();
  const guard = createBudgetGuard({ redis: fake.redis, dailyTokenBudget: budget, gamesPerIpPerDay: 3 });
  const now = new Date("2026-10-22T12:00:00Z");
  const ai = fakeAi({
    nextTurn: vi.fn(async () => {
      await guard.settleTokens(1_200, now);
      return { spec: { topic: "wand" as const, difficulty: "normal" as const }, hatLine: "Hmm, a wand." };
    }),
    verdict: vi.fn(async () => {
      await guard.settleTokens(900, now);
      return "AI verdict text";
    }),
  });
  const makeAi = vi.fn<QuizServices["makeAi"]>(() => ai);
  const quiz = { ...services(), guard, makeAi, now };
  return { ...fake, quiz, ai, makeAi };
}

describe("AI cost layers (real guard, in-memory Redis)", () => {
  const verdict = (quiz: QuizServices, seed = 7) =>
    executeQuery(
      doc<VerdictResult, StateVars>(VERDICT),
      { input: { state: { seed, mode: "AI", turns: gqlTurns(10) } } },
      { data, quiz, ip: "9.9.9.9" },
    );

  it("plays turn 3 in classic, without an AI call, when the game never started", async () => {
    const { quiz, ai, store } = guardedServices();
    expect((await runTurn(quiz, 3)).quizTurn.mode).toBe("CLASSIC");
    expect(ai.nextTurn).not.toHaveBeenCalled();
    expect(store.get("ai:tokens:2026-10-22")).toBeUndefined();
  });

  it("delivers a classic verdict, without an AI call, when the game never started", async () => {
    const { quiz, ai } = guardedServices();
    expect((await verdict(quiz)).quizVerdict.mode).toBe("CLASSIC");
    expect(ai.verdict).not.toHaveBeenCalled();
  });

  it("plays a real game in AI mode and settles each reservation to the actual usage", async () => {
    const { quiz, store } = guardedServices();
    for (let n = 0; n < 10; n++) expect((await runTurn(quiz, n)).quizTurn.mode).toBe("AI");
    expect((await verdict(quiz)).quizVerdict.mode).toBe("AI");
    expect(store.get("ai:tokens:2026-10-22")).toBe(10 * 1_200 + 900);
    // An 11-call game cannot make a 12th AI call.
    expect((await runTurn(quiz, 9)).quizTurn.mode).toBe("CLASSIC");
  });

  it("releases the reservation when the AI call fails before any usage", async () => {
    const { quiz, store, makeAi } = guardedServices();
    const failing = fakeAi({
      nextTurn: vi.fn(async () => {
        await quiz.guard.settleTokens(0, quiz.now);
        throw new Error("timed out");
      }),
    });
    makeAi.mockReturnValue(failing);
    expect((await runTurn(quiz, 0)).quizTurn.mode).toBe("CLASSIC");
    expect(store.get("ai:tokens:2026-10-22")).toBe(0);
  });

  it("goes classic when the daily budget cannot hold another reservation", async () => {
    const { quiz, ai } = guardedServices(AI_CALL_TOKEN_ESTIMATE - 1);
    expect((await runTurn(quiz, 0)).quizTurn.mode).toBe("CLASSIC");
    expect(ai.nextTurn).not.toHaveBeenCalled();
  });

  it("resolves to classic, never a GraphQL error, when Redis is down", async () => {
    const { quiz, state } = guardedServices();
    state.fail = true;
    expect((await runTurn(quiz, 0)).quizTurn.mode).toBe("CLASSIC");
    expect((await runTurn(quiz, 4)).quizTurn.mode).toBe("CLASSIC");
    expect((await verdict(quiz)).quizVerdict.mode).toBe("CLASSIC");
  });

  it("goes classic when the request has already used up its time budget", async () => {
    const { quiz, ai } = guardedServices();
    expect((await runTurn(quiz, 0, "AI", false, Date.now() - 7_500)).quizTurn.mode).toBe("CLASSIC");
    expect(ai.nextTurn).not.toHaveBeenCalled();
  });

  it("shortens the AI timeout by the time the request has already spent", async () => {
    const { quiz, makeAi } = guardedServices();
    await runTurn(quiz, 0, "AI", false, Date.now() - 4_000);
    const { timeoutMs } = makeAi.mock.calls[0]![0];
    expect(timeoutMs).toBeLessThanOrEqual(4_500);
    expect(timeoutMs).toBeGreaterThan(4_000);
  });
});

describe("HTTP endpoint", () => {
  const input = { state: { seed: 7, mode: "AI", turns: [] }, dared: false };

  function server(quiz: QuizServices, graphiql?: boolean) {
    const context = async (): Promise<GraphQLContext> => ({ data, ip: "9.9.9.9", startedAt: Date.now(), quiz });
    return createGraphQLServer({ context, graphiql });
  }

  async function post(quiz: QuizServices, query: string) {
    const response = await server(quiz).fetch("http://localhost/api/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables: { input, v: { state: { ...input.state, turns: gqlTurns(10) } } } }),
    });
    return (await response.json()) as { data?: unknown; errors?: Array<{ extensions?: { code?: string } }> };
  }

  it("serves a single quizTurn", async () => {
    const ai = fakeAi();
    const body = await post(services({ ai }), `mutation ($input: QuizTurnInput!) { quizTurn(input: $input) { mode } }`);
    expect(body.errors).toBeUndefined();
    expect(body.data).toEqual({ quizTurn: { mode: "AI" } });
  });

  it.each([
    ["aliases", `mutation ($input: QuizTurnInput!) { a: quizTurn(input: $input) { mode } b: quizTurn(input: $input) { mode } }`],
    [
      "a turn and a verdict",
      `mutation ($input: QuizTurnInput!, $v: QuizVerdictInput!) { quizTurn(input: $input) { mode } quizVerdict(input: $v) { mode } }`,
    ],
    [
      "fragments",
      `mutation ($input: QuizTurnInput!) { ...F ... on Mutation { quizTurn(input: $input) { mode } } }
       fragment F on Mutation { quizTurn(input: $input) { mode } }`,
    ],
  ])("rejects more than one quiz root field (%s) with BAD_INPUT and makes no AI call", async (_name, query) => {
    const ai = fakeAi();
    const body = await post(services({ ai }), query);
    expect(body.data).toBeUndefined();
    expect(body.errors?.[0]?.extensions?.code).toBe("BAD_INPUT");
    expect(ai.nextTurn).not.toHaveBeenCalled();
    expect(ai.verdict).not.toHaveBeenCalled();
  });

  it("serves GraphiQL only when enabled (off in production)", async () => {
    const get = (graphiql: boolean) =>
      server(services(), graphiql).fetch("http://localhost/api/graphql", { headers: { accept: "text/html" } });
    expect((await get(true)).headers.get("content-type")).toMatch(/text\/html/);
    expect((await get(false)).headers.get("content-type") ?? "").not.toMatch(/text\/html/);
  });
});
