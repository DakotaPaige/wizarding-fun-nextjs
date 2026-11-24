import type { CharacterRecord, HouseName, SpellRecord } from "@/data/types";

export type Topic = "wand" | "patronus" | "spell" | "actor" | "house" | "portrait";
export type Difficulty = "normal" | "hard";
export type QuizMode = "ai" | "classic";

export interface QuestionSpec {
  topic: Topic;
  difficulty: Difficulty;
}

export interface Option {
  id: string;
  label: string;
}

export interface Question {
  id: string;
  topic: Topic;
  difficulty: Difficulty;
  prompt: string;
  artSlot: string | null;
  options: Option[];
  correctOptionId: string;
}

export interface TurnRecord {
  topic: Topic;
  difficulty: Difficulty;
  dared: boolean;
  correct: boolean;
  msToAnswer: number;
  /** The question this turn answered (see `questionId`), so a round never asks it again. */
  questionId?: string | null;
}

export interface GameState {
  seed: number;
  mode: QuizMode;
  turns: TurnRecord[];
}

export interface QuizData {
  characters: CharacterRecord[];
  spells: SpellRecord[];
}

export interface PlayStats {
  turns: number;
  dares: number;
  hardAsked: number;
  hardCorrect: number;
  correct: number;
  longestStreak: number;
  totalPoints: number;
  pointsFromStrongTopicDares: number;
}

export interface Quizmaster {
  readonly mode: QuizMode;
  nextTurn(state: GameState, dared: boolean): Promise<{ spec: QuestionSpec; hatLine: string }>;
  verdict(stats: PlayStats, house: HouseName): Promise<string>;
}

export type Rng = () => number;

/** A generator returns null when it cannot form 4 distinct options from the data. */
export type QuestionGenerator = (difficulty: Difficulty, data: QuizData, rng: Rng) => Question | null;
