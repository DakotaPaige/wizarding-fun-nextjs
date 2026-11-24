import type { Difficulty, Topic, TurnRecord } from "./types";

/**
 * The topics a question may use. Wand lore is niche, so a wand question is only ever a hard
 * one, and a round asks at most one. Order is kept, so callers' preferences still apply.
 */
export function topicsFor(available: readonly Topic[], turns: readonly TurnRecord[], difficulty: Difficulty): Topic[] {
  const wandAllowed = difficulty === "hard" && !turns.some((t) => t.topic === "wand");
  return available.filter((topic) => topic !== "wand" || wandAllowed);
}
