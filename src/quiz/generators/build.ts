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
  prompt: string;
  artSlot?: string | null;
  answer: string;
  /**
   * Labels that answer the prompt just as well (e.g. both owners of a stag Patronus). They are
   * never offered, so a question cannot have two right answers.
   */
  alsoCorrect?: readonly string[];
  /** Distractor labels tried first (shuffled). */
  preferred: readonly string[];
  /** Distractor labels used to top up when `preferred` has too few distinct labels. */
  fallback: readonly string[];
}

/** FNV-1a, 32-bit, in base 36: short and stable, not cryptographic. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/**
 * A question's id names what the player is asked: two questions share one exactly when they
 * read the same (same topic, prompt and art), whatever the difficulty or which record answers it.
 * That is what "never ask the same question twice" compares.
 */
export function questionId(topic: Topic, prompt: string, artSlot: string | null): string {
  return `${topic}:${hash(`${prompt}\u0000${artSlot ?? ""}`)}`;
}

/** Assembles a shuffled 4-option question, or null if fewer than 4 distinct labels exist. */
export function buildQuestion(draft: QuestionDraft, rng: Rng): Question | null {
  const labels = [draft.answer];
  const seen = new Set([...labels, ...(draft.alsoCorrect ?? [])]);
  for (const label of [...shuffle(draft.preferred, rng), ...shuffle(draft.fallback, rng)]) {
    if (labels.length === OPTION_COUNT) break;
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }
  if (labels.length < OPTION_COUNT) return null;

  const artSlot = draft.artSlot ?? null;
  const id = questionId(draft.topic, draft.prompt, artSlot);
  const options = shuffle(labels, rng).map((label, index) => ({ id: `${id}:${index}`, label }));
  const correct = options.find((option) => option.label === draft.answer);
  if (!correct) return null;

  return {
    id,
    topic: draft.topic,
    difficulty: draft.difficulty,
    prompt: draft.prompt,
    artSlot,
    options,
    correctOptionId: correct.id,
  };
}
