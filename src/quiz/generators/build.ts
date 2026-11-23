import type { Difficulty, Question, Rng, Topic } from "@/quiz/types";

export const OPTION_COUNT = 4;

export function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)] as T;
}

/** Fisher-Yates shuffle returning a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const swap = result[i] as T;
    result[i] = result[j] as T;
    result[j] = swap;
  }
  return result;
}

export function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export interface QuestionDraft {
  topic: Topic;
  difficulty: Difficulty;
  /** Stable key for the answer, used to build the question id. */
  answerKey: string;
  prompt: string;
  artSlot?: string | null;
  answer: string;
  /** Distractor labels tried first (shuffled). */
  preferred: readonly string[];
  /** Distractor labels used to top up when `preferred` has too few distinct labels. */
  fallback: readonly string[];
}

/** Assembles a shuffled 4-option question, or null if fewer than 4 distinct labels exist. */
export function buildQuestion(draft: QuestionDraft, rng: Rng): Question | null {
  const labels = [draft.answer];
  const seen = new Set(labels);
  for (const label of [...shuffle(draft.preferred, rng), ...shuffle(draft.fallback, rng)]) {
    if (labels.length === OPTION_COUNT) break;
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }
  if (labels.length < OPTION_COUNT) return null;

  const id = `${draft.topic}:${draft.difficulty}:${draft.answerKey}`;
  const options = shuffle(labels, rng).map((label, index) => ({ id: `${id}:${index}`, label }));
  const correct = options.find((option) => option.label === draft.answer);
  if (!correct) return null;

  return {
    id,
    topic: draft.topic,
    difficulty: draft.difficulty,
    prompt: draft.prompt,
    artSlot: draft.artSlot ?? null,
    options,
    correctOptionId: correct.id,
  };
}
