import type { HouseName } from "@/data/types";
import { gqlFetch } from "@/graphql/client";
import { graphql } from "@/graphql/generated";
import type { GameStateInput, QuizTurnMutation, QuizVerdictMutation } from "@/graphql/generated/graphql";
import type { HouseScores } from "@/quiz/sorting";
import type { Difficulty, GameState, Question, QuizMode, Topic } from "@/quiz/types";

/*
 * The quiz's only contact with the wire. GraphQL enums are upper-case (`AI`, `WAND`, `HARD`);
 * the domain types are lower-case. Every conversion between the two happens here.
 */

const QuizTurnDocument = graphql(`
  mutation QuizTurn($input: QuizTurnInput!) {
    quizTurn(input: $input) {
      hatLine
      mode
      question {
        id
        topic
        difficulty
        prompt
        artSlot
        correctOptionId
        options {
          id
          label
        }
      }
    }
  }
`);

const QuizVerdictDocument = graphql(`
  mutation QuizVerdict($input: QuizVerdictInput!) {
    quizVerdict(input: $input) {
      house
      verdict
      mode
      scores {
        gryffindor
        slytherin
        ravenclaw
        hufflepuff
      }
    }
  }
`);

export interface TurnRequest {
  state: GameState;
  dared: boolean;
}

export interface TurnResponse {
  question: Question;
  hatLine: string;
  mode: QuizMode;
}

export interface VerdictRequest {
  state: GameState;
}

export interface VerdictResponse {
  house: HouseName;
  scores: HouseScores;
  verdict: string;
  mode: QuizMode;
}

export type FetchTurn = (request: TurnRequest) => Promise<TurnResponse>;
export type FetchVerdict = (request: VerdictRequest) => Promise<VerdictResponse>;

const toWire = <T extends string>(value: T) => value.toUpperCase() as Uppercase<T>;
const fromWire = <T extends string>(value: Uppercase<T>) => value.toLowerCase() as T;

export function toWireState(state: GameState): GameStateInput {
  return {
    seed: state.seed,
    mode: toWire(state.mode),
    // Field by field, so a client-only field on TurnRecord can never reach the server's input type.
    turns: state.turns.map(({ topic, difficulty, dared, correct, msToAnswer, questionId }) => ({
      topic: toWire(topic),
      difficulty: toWire(difficulty),
      dared,
      correct,
      msToAnswer,
      questionId: questionId ?? null,
    })),
  };
}

export function fromWireTurn({ quizTurn }: QuizTurnMutation): TurnResponse {
  const { question } = quizTurn;
  return {
    hatLine: quizTurn.hatLine,
    mode: fromWire<QuizMode>(quizTurn.mode),
    question: {
      id: question.id,
      topic: fromWire<Topic>(question.topic),
      difficulty: fromWire<Difficulty>(question.difficulty),
      prompt: question.prompt,
      artSlot: question.artSlot ?? null,
      correctOptionId: question.correctOptionId,
      options: question.options.map(({ id, label }) => ({ id, label })),
    },
  };
}

export function fromWireVerdict({ quizVerdict }: QuizVerdictMutation): VerdictResponse {
  const { scores } = quizVerdict;
  return {
    house: quizVerdict.house,
    verdict: quizVerdict.verdict,
    mode: fromWire<QuizMode>(quizVerdict.mode),
    scores: {
      GRYFFINDOR: scores.gryffindor,
      SLYTHERIN: scores.slytherin,
      RAVENCLAW: scores.ravenclaw,
      HUFFLEPUFF: scores.hufflepuff,
    },
  };
}

export const fetchQuizTurn: FetchTurn = async ({ state, dared }) =>
  fromWireTurn(await gqlFetch(QuizTurnDocument, { input: { state: toWireState(state), dared } }));

export const fetchQuizVerdict: FetchVerdict = async ({ state }) =>
  fromWireVerdict(await gqlFetch(QuizVerdictDocument, { input: { state: toWireState(state) } }));
