import { createRng } from "./rng";
import { CLASSIC_VERDICTS, HAT_LINES } from "./hat-lines";
import { topicsFor } from "./topic-rules";
import type { GameState, Quizmaster, Topic } from "./types";

const UNSEEN_ACCURACY = 0.5;

function accuracyFor(topic: Topic, state: GameState): number {
  const asked = state.turns.filter((t) => t.topic === topic);
  if (asked.length === 0) return UNSEEN_ACCURACY;
  return asked.filter((t) => t.correct).length / asked.length;
}

function pick<T>(items: T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)] as T;
}

function hatLineFor(state: GameState, rng: () => number): string {
  const last = state.turns[state.turns.length - 1];
  if (!last) return pick(HAT_LINES.opening, rng);
  if (last.dared) return pick(last.correct ? HAT_LINES.daredRight : HAT_LINES.daredWrong, rng);
  return pick(last.correct ? HAT_LINES.safeRight : HAT_LINES.safeWrong, rng);
}

/** Rule-based quizmaster: favours weak topics, never repeats the previous one, follows `topicsFor`. */
export function createClassicQuizmaster(opts: { topics: Topic[] }): Quizmaster {
  return {
    mode: "classic",
    async nextTurn(state, dared) {
      const rng = createRng(state.seed + state.turns.length);
      const previous = state.turns[state.turns.length - 1]?.topic;
      const ruled = topicsFor(opts.topics, state.turns, dared ? "hard" : "normal");
      const allowed = ruled.length > 0 ? ruled : opts.topics;
      const without = allowed.filter((t) => t !== previous);
      const candidates = without.length > 0 ? without : allowed;

      const weights = candidates.map((t) => 2 - accuracyFor(t, state));
      let roll = rng() * weights.reduce((a, b) => a + b, 0);
      let topic = candidates[candidates.length - 1] as Topic;
      for (let i = 0; i < candidates.length; i++) {
        roll -= weights[i] ?? 0;
        if (roll < 0) {
          topic = candidates[i] as Topic;
          break;
        }
      }

      return {
        spec: { topic, difficulty: dared ? "hard" : "normal" },
        hatLine: hatLineFor(state, rng),
      };
    },
    async verdict(_stats, house) {
      return CLASSIC_VERDICTS[house];
    },
  };
}
