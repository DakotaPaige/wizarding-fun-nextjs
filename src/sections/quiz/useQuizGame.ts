import { useReducer } from "react";
import type { HouseName } from "@/data/types";
import { HAT_LINES } from "@/quiz/hat-lines";
import { createRng } from "@/quiz/rng";
import { computePlayStats, type HouseScores } from "@/quiz/sorting";
import type { GameState, Question, QuizMode, TurnRecord } from "@/quiz/types";
import type {
  FetchTurn,
  FetchVerdict,
  TurnRequest,
  TurnResponse,
  VerdictRequest,
  VerdictResponse,
} from "./quiz.graphql";

export const ROUND_LENGTH = 10;

export type QuizPhase =
  | "intro"
  | "dare"
  | "loading"
  | "question"
  | "answered"
  | "verdict-loading"
  | "result"
  | "error";

export interface QuizResult {
  house: HouseName;
  scores: HouseScores;
  verdict: string;
}

/** A request to the server, kept by identity so a retry re-sends exactly what failed. */
type Pending = { kind: "turn"; request: TurnRequest } | { kind: "verdict"; request: VerdictRequest };

interface Game {
  phase: QuizPhase;
  state: GameState;
  question: Question | null;
  /** The player's choice for the current question. */
  dared: boolean;
  chosenOptionId: string | null;
  /** When the current question was shown (ms, from `now`). */
  shownAt: number;
  hatLine: string;
  /** Bumped whenever a line is set, so a repeated line is still typed and announced anew. */
  hatLineId: number;
  result: QuizResult | null;
  /** The request in flight, or the one that failed while `phase` is "error". */
  pending: Pending | null;
}

type Action =
  | { type: "start" }
  | { type: "send"; pending: Pending }
  | { type: "turn-loaded"; pending: Pending; response: TurnResponse; at: number }
  | { type: "verdict-loaded"; pending: Pending; response: VerdictResponse }
  | { type: "failed"; pending: Pending }
  | { type: "answer"; optionId: string; at: number }
  | { type: "next" }
  | { type: "restart"; seed: number };

/** The Hat's invitation before the first question (the wireframe's opening line). */
const INVITATION = HAT_LINES.opening[0]!;

/** A positive 31-bit seed (GraphQL `Int` is 32-bit), different from `previous`. */
function newSeed(previous?: number): number {
  let seed: number;
  do seed = 1 + Math.floor(Math.random() * 0x7ffffffe);
  while (seed === previous);
  return seed;
}

function freshGame(seed: number, hatLineId = 0): Game {
  return {
    phase: "intro",
    state: { seed, mode: "ai", turns: [] },
    question: null,
    dared: false,
    chosenOptionId: null,
    shownAt: 0,
    hatLine: INVITATION,
    hatLineId,
    result: null,
    pending: null,
  };
}

/** Once any response says classic, the game stays classic. */
const stickyMode = (current: QuizMode, reported: QuizMode): QuizMode =>
  current === "classic" ? "classic" : reported;

/** Keeps the reaction's pick independent of the choice line's at the same turn. */
const REACTION_RNG_OFFSET = 0x7a11;

/** A deterministic pick, so the same game always hears the same lines. */
function pickLine(lines: readonly string[], seed: number): string {
  return lines[Math.floor(createRng(seed)() * lines.length)]!;
}

/** The Hat's reaction to the Safe/Dare choice, shown while the question loads. */
function choiceLine(state: GameState, dared: boolean): string {
  return pickLine(dared ? HAT_LINES.daring : HAT_LINES.safe, state.seed + state.turns.length);
}

/** The Hat's reaction to the turn just answered, shown at once. */
function reactionLine(state: GameState, turn: TurnRecord): string {
  const lines = turn.dared
    ? turn.correct
      ? HAT_LINES.daredRight
      : HAT_LINES.daredWrong
    : turn.correct
      ? HAT_LINES.safeRight
      : HAT_LINES.safeWrong;
  return pickLine(lines, state.seed + state.turns.length + REACTION_RNG_OFFSET);
}

const say = (game: Game, hatLine: string): Pick<Game, "hatLine" | "hatLineId"> => ({
  hatLine,
  hatLineId: game.hatLineId + 1,
});

function reduce(game: Game, action: Action): Game {
  switch (action.type) {
    case "start":
      return game.phase === "intro" ? { ...game, phase: "dare" } : game;

    case "send": {
      const { pending } = action;
      if (pending.kind === "verdict") return { ...game, phase: "verdict-loading", pending };
      const { state, dared } = pending.request;
      return { ...game, phase: "loading", pending, dared, ...say(game, choiceLine(state, dared)) };
    }

    case "turn-loaded": {
      if (action.pending !== game.pending) return game; // stale: restarted meanwhile
      const { question, hatLine, mode: reported } = action.response;
      const mode = stickyMode(game.state.mode, reported);
      // The server's line reacts to the previous answer, which the Hat has already reacted to
      // on the client. Only the AI's line adds something new; on turn 0 it is the opening line.
      // In classic mode the choice line shown while loading stays.
      const voice = game.state.turns.length === 0 || mode === "ai" ? say(game, hatLine) : {};
      return {
        ...game,
        ...voice,
        phase: "question",
        pending: null,
        question,
        chosenOptionId: null,
        shownAt: action.at,
        state: { ...game.state, mode },
      };
    }

    case "verdict-loaded": {
      if (action.pending !== game.pending) return game;
      const { house, scores, verdict, mode } = action.response;
      return {
        ...game,
        phase: "result",
        pending: null,
        result: { house, scores, verdict },
        state: { ...game.state, mode: stickyMode(game.state.mode, mode) },
      };
    }

    case "failed":
      return action.pending === game.pending ? { ...game, phase: "error" } : game;

    case "answer": {
      const { question } = game;
      if (game.phase !== "question" || !question) return game;
      const turn: TurnRecord = {
        topic: question.topic,
        difficulty: question.difficulty,
        dared: game.dared,
        correct: action.optionId === question.correctOptionId,
        msToAnswer: Math.max(0, Math.round(action.at - game.shownAt)),
      };
      return {
        ...game,
        ...say(game, reactionLine(game.state, turn)),
        phase: "answered",
        chosenOptionId: action.optionId,
        state: { ...game.state, turns: [...game.state.turns, turn] },
      };
    }

    case "next":
      return game.phase === "answered" ? { ...game, phase: "dare", question: null, chosenOptionId: null } : game;

    case "restart":
      return freshGame(action.seed, game.hatLineId + 1);
  }
}

export interface QuizGameDeps {
  fetchTurn: FetchTurn;
  fetchVerdict: FetchVerdict;
  now?: () => number;
  seed?: number;
}

/**
 * The Sorting Ceremony's game loop: intro → (dare → question → answered) × 10 → result.
 * The client owns the `GameState`; a turn is recorded only when the player answers, so a failed
 * or retried request never changes it. A failed request moves to "error" and `retry()` re-sends
 * that same request. Responses that arrive after a restart are ignored.
 */
export function useQuizGame({ fetchTurn, fetchVerdict, now = Date.now, seed }: QuizGameDeps) {
  const [game, dispatch] = useReducer(reduce, seed, (initial) => freshGame(initial ?? newSeed()));
  const { phase, state } = game;

  function send(pending: Pending) {
    dispatch({ type: "send", pending });
    if (pending.kind === "turn") {
      fetchTurn(pending.request).then(
        (response) => dispatch({ type: "turn-loaded", pending, response, at: now() }),
        () => dispatch({ type: "failed", pending }),
      );
    } else {
      fetchVerdict(pending.request).then(
        (response) => dispatch({ type: "verdict-loaded", pending, response }),
        () => dispatch({ type: "failed", pending }),
      );
    }
  }

  return {
    phase,
    state,
    mode: state.mode,
    score: computePlayStats(state.turns).totalPoints,
    /** 1-based number of the question being chosen, asked or just answered. */
    questionNumber: Math.min(ROUND_LENGTH, state.turns.length + (phase === "answered" ? 0 : 1)),
    question: game.question,
    dared: game.dared,
    chosenOptionId: game.chosenOptionId,
    hatLine: game.hatLine,
    hatLineId: game.hatLineId,
    result: game.result,

    start: () => dispatch({ type: "start" }),
    choose(dared: boolean) {
      if (phase === "dare") send({ kind: "turn", request: { state, dared } });
    },
    answer: (optionId: string) => dispatch({ type: "answer", optionId, at: now() }),
    next() {
      if (phase !== "answered") return;
      if (state.turns.length >= ROUND_LENGTH) send({ kind: "verdict", request: { state } });
      else dispatch({ type: "next" });
    },
    retry() {
      if (phase === "error" && game.pending) send(game.pending);
    },
    restart: () => dispatch({ type: "restart", seed: newSeed(state.seed) }),
  };
}

export type QuizGame = ReturnType<typeof useQuizGame>;
