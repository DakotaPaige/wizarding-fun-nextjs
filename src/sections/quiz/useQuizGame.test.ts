import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HAT_LINES } from "@/quiz/hat-lines";
import type { QuizMode } from "@/quiz/types";
import { toWireState, type FetchTurn, type FetchVerdict, type TurnRequest, type TurnResponse, type VerdictResponse } from "./quiz.graphql";
import { ROUND_LENGTH, useQuizGame } from "./useQuizGame";

/** A question whose correct option is "a"; the id carries the turn number. */
function turnResponse(request: TurnRequest, mode: QuizMode = "ai"): TurnResponse {
  const n = request.state.turns.length;
  return {
    mode,
    hatLine: `Line ${n}`,
    question: {
      id: `q${n}`,
      topic: "wand",
      difficulty: request.dared ? "hard" : "normal",
      prompt: `Question ${n}?`,
      artSlot: null,
      correctOptionId: "a",
      options: ["a", "b", "c", "d"].map((id) => ({ id, label: id.toUpperCase() })),
    },
  };
}

const VERDICT: VerdictResponse = {
  house: "RAVENCLAW",
  verdict: "A mind that weighs a risk.",
  mode: "ai",
  scores: { GRYFFINDOR: 0.5, SLYTHERIN: 0.2, RAVENCLAW: 0.8, HUFFLEPUFF: 0.6 },
};

function setup(over: { fetchTurn?: FetchTurn; fetchVerdict?: FetchVerdict; now?: () => number } = {}) {
  const fetchTurn = vi.fn<FetchTurn>(over.fetchTurn ?? (async (request) => turnResponse(request)));
  const fetchVerdict = vi.fn<FetchVerdict>(over.fetchVerdict ?? (async () => VERDICT));
  const hook = renderHook(() => useQuizGame({ fetchTurn, fetchVerdict, now: over.now, seed: 1234 }));
  return { fetchTurn, fetchVerdict, hook };
}

type Hook = ReturnType<typeof setup>["hook"];

/** Dare, wait for the question, answer it, and (unless told not to) move on. */
async function playTurn(hook: Hook, { dared, optionId }: { dared: boolean; optionId: string }) {
  act(() => hook.result.current.choose(dared));
  await waitFor(() => expect(hook.result.current.phase).toBe("question"));
  act(() => hook.result.current.answer(optionId));
  expect(hook.result.current.phase).toBe("answered");
  act(() => hook.result.current.next());
}

describe("useQuizGame", () => {
  it("plays a full 10-turn round to the result, scoring 2 per dared and 1 per safe correct answer", async () => {
    const { hook, fetchVerdict } = setup();
    expect(hook.result.current.phase).toBe("intro");
    act(() => hook.result.current.start());
    expect(hook.result.current.phase).toBe("dare");

    for (let i = 0; i < ROUND_LENGTH; i++) {
      // Dare on odd turns; every 3rd answer is wrong.
      await playTurn(hook, { dared: i % 2 === 1, optionId: i % 3 === 2 ? "b" : "a" });
    }
    await waitFor(() => expect(hook.result.current.phase).toBe("result"));

    const { state, score, result } = hook.result.current;
    expect(state.turns).toHaveLength(10);
    const expected = state.turns.reduce((sum, t) => sum + (t.correct ? (t.dared ? 2 : 1) : 0), 0);
    expect(score).toBe(expected);
    expect(score).toBe(11);
    expect(fetchVerdict).toHaveBeenCalledTimes(1);
    expect(fetchVerdict).toHaveBeenCalledWith({ state });
    expect(result).toEqual({ house: VERDICT.house, scores: VERDICT.scores, verdict: VERDICT.verdict });
  });

  it("records the dare, the difficulty and the answer time from question shown to answer", async () => {
    let clock = 1000;
    const { hook } = setup({ now: () => clock });
    act(() => hook.result.current.start());
    act(() => hook.result.current.choose(true));
    await waitFor(() => expect(hook.result.current.phase).toBe("question"));
    clock = 4250;
    act(() => hook.result.current.answer("a"));
    expect(hook.result.current.state.turns).toEqual([
      { topic: "wand", difficulty: "hard", dared: true, correct: true, msToAnswer: 3250, questionId: "q0" },
    ]);
  });

  it("sends each answered question's id back, so the server can avoid asking it again", () => {
    const wire = toWireState({
      seed: 1,
      mode: "ai",
      turns: [{ topic: "wand", difficulty: "hard", dared: true, correct: true, msToAnswer: 3250, questionId: "q0" }],
    });
    expect(wire.turns).toEqual([
      { topic: "WAND", difficulty: "HARD", dared: true, correct: true, msToAnswer: 3250, questionId: "q0" },
    ]);
  });

  it("stays classic for the rest of the game once any response says classic", async () => {
    const { hook, fetchTurn } = setup({
      fetchTurn: async (request) => turnResponse(request, request.state.turns.length === 2 ? "classic" : "ai"),
    });
    act(() => hook.result.current.start());
    expect(hook.result.current.mode).toBe("ai");
    for (let i = 0; i < ROUND_LENGTH; i++) {
      act(() => hook.result.current.choose(false));
      await waitFor(() => expect(hook.result.current.phase).toBe("question"));
      expect(hook.result.current.mode).toBe(i < 2 ? "ai" : "classic");
      act(() => hook.result.current.answer("a"));
      act(() => hook.result.current.next());
    }
    await waitFor(() => expect(hook.result.current.phase).toBe("result"));
    expect(hook.result.current.mode).toBe("classic");
    // The sticky mode is what the client sends from then on.
    expect(fetchTurn.mock.calls.map(([request]) => request.state.mode)).toEqual([
      "ai", "ai", "ai", "classic", "classic", "classic", "classic", "classic", "classic", "classic",
    ]);
  });

  it("keeps the game on a failed turn and retries exactly the request that failed (Review Focus 4)", async () => {
    let failNext = false;
    const { hook, fetchTurn } = setup({
      fetchTurn: async (request) => {
        if (failNext) {
          failNext = false;
          throw new Error("network");
        }
        return turnResponse(request);
      },
    });
    act(() => hook.result.current.start());
    for (let i = 0; i < 3; i++) await playTurn(hook, { dared: false, optionId: "a" });

    failNext = true;
    act(() => hook.result.current.choose(true));
    await waitFor(() => expect(hook.result.current.phase).toBe("error"));
    expect(hook.result.current.state.turns).toHaveLength(3);
    const failed = fetchTurn.mock.calls.at(-1)![0];

    act(() => hook.result.current.retry());
    await waitFor(() => expect(hook.result.current.phase).toBe("question"));
    expect(fetchTurn).toHaveBeenCalledTimes(5);
    expect(fetchTurn.mock.calls.at(-1)![0]).toEqual(failed);
    expect(fetchTurn.mock.calls.at(-1)![0]).toEqual({ state: hook.result.current.state, dared: true });
    expect(hook.result.current.state.turns).toHaveLength(3);
    expect(hook.result.current.question?.difficulty).toBe("hard");

    act(() => hook.result.current.answer("a"));
    expect(hook.result.current.state.turns).toHaveLength(4);
  });

  it("retries a failed verdict with the same state", async () => {
    let fail = true;
    const { hook, fetchVerdict } = setup({
      fetchVerdict: async () => {
        if (fail) {
          fail = false;
          throw new Error("boom");
        }
        return VERDICT;
      },
    });
    act(() => hook.result.current.start());
    for (let i = 0; i < ROUND_LENGTH; i++) await playTurn(hook, { dared: false, optionId: "a" });
    await waitFor(() => expect(hook.result.current.phase).toBe("error"));

    act(() => hook.result.current.retry());
    await waitFor(() => expect(hook.result.current.phase).toBe("result"));
    expect(fetchVerdict).toHaveBeenCalledTimes(2);
    expect(fetchVerdict.mock.calls[1]).toEqual(fetchVerdict.mock.calls[0]);
  });

  it("restart() returns to the intro with a fresh game and a new seed, ignoring a late response", async () => {
    let hold = false;
    const held: Array<() => void> = [];
    const { hook } = setup({
      fetchTurn: (request) =>
        hold
          ? new Promise((resolve) => held.push(() => resolve(turnResponse(request))))
          : Promise.resolve(turnResponse(request, "classic")),
    });
    act(() => hook.result.current.start());
    await playTurn(hook, { dared: true, optionId: "a" });
    expect(hook.result.current.state.seed).toBe(1234);
    expect(hook.result.current.mode).toBe("classic");

    hold = true;
    act(() => hook.result.current.choose(false));
    expect(hook.result.current.phase).toBe("loading");
    act(() => hook.result.current.restart());

    const fresh = () => {
      const { phase, state, score, result, question } = hook.result.current;
      expect(phase).toBe("intro");
      expect(state.turns).toEqual([]);
      expect(state.mode).toBe("ai");
      expect(state.seed).not.toBe(1234);
      expect(Number.isInteger(state.seed)).toBe(true);
      expect(score).toBe(0);
      expect(result).toBeNull();
      expect(question).toBeNull();
    };
    fresh();
    // The turn that was in flight resolves after the restart; it must not leak into the new game.
    await act(async () => held[0]!());
    fresh();
  });

  describe("the Hat's voice", () => {
    it.each([
      [false, "a", HAT_LINES.safeRight],
      [false, "b", HAT_LINES.safeWrong],
      [true, "a", HAT_LINES.daredRight],
      [true, "b", HAT_LINES.daredWrong],
    ] as const)("reacts at once to an answer (dared %s, option %s) from the matching list", async (dared, optionId, list) => {
      const { hook } = setup();
      act(() => hook.result.current.start());
      act(() => hook.result.current.choose(dared));
      await waitFor(() => expect(hook.result.current.phase).toBe("question"));
      const before = hook.result.current.hatLineId;
      act(() => hook.result.current.answer(optionId));
      expect(list).toContain(hook.result.current.hatLine);
      expect(hook.result.current.hatLineId).toBe(before + 1);
    });

    it("picks the reaction deterministically from the seed and turn", async () => {
      const lines: string[] = [];
      for (let run = 0; run < 2; run++) {
        const { hook } = setup();
        act(() => hook.result.current.start());
        act(() => hook.result.current.choose(true));
        await waitFor(() => expect(hook.result.current.phase).toBe("question"));
        act(() => hook.result.current.answer("a"));
        lines.push(hook.result.current.hatLine);
        hook.unmount();
      }
      expect(lines[0]).toBe(lines[1]);
    });

    it("shows the server's line on turn 0 in either mode", async () => {
      const { hook } = setup({ fetchTurn: async (request) => turnResponse(request, "classic") });
      act(() => hook.result.current.start());
      act(() => hook.result.current.choose(false));
      await waitFor(() => expect(hook.result.current.phase).toBe("question"));
      expect(hook.result.current.hatLine).toBe("Line 0");
    });

    it("in classic mode, shows the choice line with the next question instead of the server's", async () => {
      const { hook } = setup({ fetchTurn: async (request) => turnResponse(request, "classic") });
      act(() => hook.result.current.start());
      await playTurn(hook, { dared: false, optionId: "a" });
      act(() => hook.result.current.choose(true));
      expect(HAT_LINES.daring).toContain(hook.result.current.hatLine);
      const choice = hook.result.current.hatLine;
      await waitFor(() => expect(hook.result.current.phase).toBe("question"));
      expect(hook.result.current.hatLine).toBe(choice);
    });

    it("in AI mode, shows the server's line with the next question", async () => {
      const { hook } = setup();
      act(() => hook.result.current.start());
      await playTurn(hook, { dared: false, optionId: "a" });
      act(() => hook.result.current.choose(false));
      await waitFor(() => expect(hook.result.current.phase).toBe("question"));
      expect(hook.result.current.hatLine).toBe("Line 1");
    });

    it("gives every new line a new id, even when its text repeats", async () => {
      const { hook } = setup({ fetchTurn: async (request) => ({ ...turnResponse(request), hatLine: "Same again." }) });
      act(() => hook.result.current.start());
      const ids = [hook.result.current.hatLineId];
      for (let i = 0; i < 2; i++) {
        act(() => hook.result.current.choose(false));
        await waitFor(() => expect(hook.result.current.phase).toBe("question"));
        ids.push(hook.result.current.hatLineId);
        act(() => hook.result.current.answer("a"));
        act(() => hook.result.current.next());
      }
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
