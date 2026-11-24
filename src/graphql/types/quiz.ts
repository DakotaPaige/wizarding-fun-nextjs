import { GraphQLError } from "graphql";
import { builder, HOUSE_NAMES, HouseNameEnum } from "@/graphql/builder";
import type { GraphQLContext } from "@/graphql/context";
import { availableTopics, generateQuestion } from "@/quiz/generators/index";
import { createRng } from "@/quiz/rng";
import { topicsFor } from "@/quiz/topic-rules";
import { selectQuizmaster } from "@/quiz/select-quizmaster";
import { computePlayStats, sortIntoHouse, type HouseScores } from "@/quiz/sorting";
import type {
  Difficulty,
  GameState,
  Option,
  Question,
  Quizmaster,
  QuizMode,
  Topic,
  TurnRecord,
} from "@/quiz/types";
import type { HouseName } from "@/data/types";

const ROUND_LENGTH = 10;
/** Keeps the question rng distinct from the quizmaster's own `seed + turns.length` stream. */
const QUESTION_RNG_OFFSET = 0x51ed;

const TOPICS = ["wand", "patronus", "spell", "actor", "house", "portrait"] as const satisfies readonly Topic[];
const DIFFICULTIES = ["normal", "hard"] as const satisfies readonly Difficulty[];
const MODES = ["ai", "classic"] as const satisfies readonly QuizMode[];

/** Lower-case in TypeScript, upper-case in GraphQL (same mapping as SpellEffectKey). */
function upperEnum<T extends string>(name: string, values: readonly T[]) {
  return builder.enumType(name, {
    values: Object.fromEntries(values.map((v) => [v.toUpperCase(), { value: v }])) as Record<
      Uppercase<T>,
      { value: T }
    >,
  });
}

const TopicEnum = upperEnum("Topic", TOPICS);
const DifficultyEnum = upperEnum("Difficulty", DIFFICULTIES);
const QuizModeEnum = upperEnum("QuizMode", MODES);

const TurnRecordInput = builder.inputType("TurnRecordInput", {
  fields: (t) => ({
    topic: t.field({ type: TopicEnum, required: true }),
    difficulty: t.field({ type: DifficultyEnum, required: true }),
    dared: t.boolean({ required: true }),
    correct: t.boolean({ required: true }),
    msToAnswer: t.int({ required: true }),
    // Optional so a page loaded before this field existed can finish its round.
    questionId: t.id({ required: false }),
  }),
});

const GameStateInput = builder.inputType("GameStateInput", {
  fields: (t) => ({
    seed: t.int({ required: true }),
    mode: t.field({ type: QuizModeEnum, required: true }),
    turns: t.field({ type: [TurnRecordInput], required: true }),
  }),
});

const QuizTurnInput = builder.inputType("QuizTurnInput", {
  fields: (t) => ({
    state: t.field({ type: GameStateInput, required: true }),
    dared: t.boolean({ required: true }),
  }),
});

const QuizVerdictInput = builder.inputType("QuizVerdictInput", {
  fields: (t) => ({ state: t.field({ type: GameStateInput, required: true }) }),
});

const OptionRef = builder.objectRef<Option>("QuizOption").implement({
  fields: (t) => ({ id: t.exposeID("id"), label: t.exposeString("label") }),
});

const QuestionRef = builder.objectRef<Question>("QuizQuestion").implement({
  description: "Includes the correct option; the client scores locally.",
  fields: (t) => ({
    id: t.exposeID("id"),
    topic: t.field({ type: TopicEnum, resolve: (q) => q.topic }),
    difficulty: t.field({ type: DifficultyEnum, resolve: (q) => q.difficulty }),
    prompt: t.exposeString("prompt"),
    artSlot: t.exposeString("artSlot", { nullable: true }),
    options: t.field({ type: [OptionRef], resolve: (q) => q.options }),
    correctOptionId: t.exposeID("correctOptionId"),
  }),
});

interface QuizTurnModel {
  question: Question;
  hatLine: string;
  mode: QuizMode;
}

const QuizTurnRef = builder.objectRef<QuizTurnModel>("QuizTurn").implement({
  fields: (t) => ({
    question: t.field({ type: QuestionRef, resolve: (r) => r.question }),
    hatLine: t.exposeString("hatLine"),
    mode: t.field({ type: QuizModeEnum, resolve: (r) => r.mode }),
  }),
});

const HouseScoresRef = builder.objectRef<HouseScores>("HouseScores").implement({
  fields: (t) => ({
    gryffindor: t.float({ resolve: (s) => s.GRYFFINDOR }),
    slytherin: t.float({ resolve: (s) => s.SLYTHERIN }),
    ravenclaw: t.float({ resolve: (s) => s.RAVENCLAW }),
    hufflepuff: t.float({ resolve: (s) => s.HUFFLEPUFF }),
  }),
});

interface QuizVerdictModel {
  house: HouseName;
  scores: HouseScores;
  verdict: string;
  mode: QuizMode;
}

const QuizVerdictRef = builder.objectRef<QuizVerdictModel>("QuizVerdict").implement({
  fields: (t) => ({
    house: t.field({ type: HouseNameEnum, resolve: (r) => r.house }),
    scores: t.field({ type: HouseScoresRef, resolve: (r) => r.scores }),
    verdict: t.exposeString("verdict"),
    mode: t.field({ type: QuizModeEnum, resolve: (r) => r.mode }),
  }),
});

function fail(code: "BAD_INPUT" | "INTERNAL", message: string): never {
  throw new GraphQLError(message, { extensions: { code } });
}

interface StateInput {
  seed: number;
  mode: QuizMode;
  turns: TurnRecord[];
}

/** Question ids are short hashes (`topic:xxxxxx`); anything longer is not one of ours. */
const MAX_QUESTION_ID_LENGTH = 64;

function toGameState(input: StateInput): GameState {
  for (const turn of input.turns) {
    if (turn.questionId != null && String(turn.questionId).length > MAX_QUESTION_ID_LENGTH) {
      fail("BAD_INPUT", "Invalid question id");
    }
  }
  const turns = input.turns.map((t) => ({ ...t, questionId: t.questionId == null ? null : String(t.questionId) }));
  return { seed: input.seed, mode: input.mode, turns };
}

/** Draws per topic before moving on; topics hold far more questions than a round asks. */
const MAX_DRAWS_PER_TOPIC = 25;

function pickQuizmaster(state: GameState, ctx: GraphQLContext): Promise<Quizmaster> {
  const { config, guard, makeAi, classic, now } = ctx.quiz;
  const elapsedMs = Date.now() - ctx.startedAt;
  return selectQuizmaster({ state, ip: ctx.ip, now, elapsedMs, config, guard, makeAi, classic });
}

/**
 * A question not yet asked this round: the spec's own topic first, then the remaining available
 * topics in order, at the requested difficulty. Deterministic for a game state. Only if every
 * draw repeats (data far smaller than a round) is a repeat returned rather than an error.
 */
function generateWithFallback(
  spec: { topic: Topic; difficulty: Difficulty },
  state: GameState,
  ctx: GraphQLContext,
): Question {
  const rng = createRng(state.seed + state.turns.length + QUESTION_RNG_OFFSET);
  const asked = new Set(state.turns.map((t) => t.questionId).filter(Boolean));
  // The quizmaster's topic first if the rules allow it (the AI may ask for a disallowed one).
  const available = availableTopics(ctx.data);
  const ruled = topicsFor(available, state.turns, spec.difficulty);
  const allowed = ruled.length > 0 ? ruled : available;
  const topics = allowed.includes(spec.topic) ? [spec.topic, ...allowed.filter((t) => t !== spec.topic)] : allowed;
  let repeat: Question | null = null;
  for (const topic of topics) {
    for (let draw = 0; draw < MAX_DRAWS_PER_TOPIC; draw++) {
      const question = generateQuestion({ topic, difficulty: spec.difficulty }, ctx.data, rng);
      if (!question) break;
      if (!asked.has(question.id)) return question;
      repeat ??= question;
    }
  }
  return repeat ?? fail("INTERNAL", "Could not build a question from the available data");
}

builder.mutationField("quizTurn", (t) =>
  t.field({
    type: QuizTurnRef,
    args: { input: t.arg({ type: QuizTurnInput, required: true }) },
    resolve: async (_root, { input }, ctx) => {
      const state = toGameState(input.state);
      if (state.turns.length >= ROUND_LENGTH) fail("BAD_INPUT", `A round has ${ROUND_LENGTH} questions`);

      const quizmaster = await pickQuizmaster(state, ctx);
      let mode: QuizMode = quizmaster.mode;
      let turn;
      try {
        turn = await quizmaster.nextTurn(state, input.dared);
      } catch {
        // One AI call per request: on failure rerun with classic instead of retrying.
        if (quizmaster.mode === "classic") fail("INTERNAL", "Quizmaster failed");
        mode = "classic" as QuizMode;
        turn = await ctx.quiz.classic.nextTurn(state, input.dared);
      }
      let { spec } = turn;
      if (!topicsFor(availableTopics(ctx.data), state.turns, spec.difficulty).includes(spec.topic)) {
        // The AI asked for a topic the rules forbid here: take the classic pick, keep the AI's line.
        ({ spec } = await ctx.quiz.classic.nextTurn(state, input.dared));
      }
      return { question: generateWithFallback(spec, state, ctx), hatLine: turn.hatLine, mode };
    },
  }),
);

builder.mutationField("quizVerdict", (t) =>
  t.field({
    type: QuizVerdictRef,
    args: { input: t.arg({ type: QuizVerdictInput, required: true }) },
    resolve: async (_root, { input }, ctx) => {
      const state = toGameState(input.state);
      if (state.turns.length !== ROUND_LENGTH) fail("BAD_INPUT", `A verdict needs exactly ${ROUND_LENGTH} turns`);

      const stats = computePlayStats(state.turns);
      const { house, scores } = sortIntoHouse(stats);
      // turns.length is ROUND_LENGTH here, so selection requires the game's marker instead of counting a game.
      const quizmaster = await pickQuizmaster(state, ctx);
      try {
        return { house, scores, verdict: await quizmaster.verdict(stats, house), mode: quizmaster.mode };
      } catch {
        if (quizmaster.mode === "classic") fail("INTERNAL", "Quizmaster failed");
        return { house, scores, verdict: await ctx.quiz.classic.verdict(stats, house), mode: "classic" as const };
      }
    },
  }),
);

export { HOUSE_NAMES };
