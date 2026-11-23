import type { HouseName } from "@/data/types";
import type { PlayStats, Topic, TurnRecord } from "./types";

export type { PlayStats } from "./types";
export type HouseScores = Record<HouseName, number>;

export const SORTING_WEIGHTS = {
  ravenclawSaturation: 5,
  streakWeight: 0.5,
  accuracyWeight: 0.5,
} as const;

const STREAK_CAP = 10;
/** Earlier entries win ties. */
const TIE_BREAK: HouseName[] = ["RAVENCLAW", "HUFFLEPUFF", "GRYFFINDOR", "SLYTHERIN"];

function pointsFor(turn: TurnRecord): number {
  if (!turn.correct) return 0;
  return turn.dared ? 2 : 1;
}

/** Topics whose accuracy over the game is at least the overall accuracy. */
function strongTopics(turns: TurnRecord[]): Set<Topic> {
  const overall = turns.filter((t) => t.correct).length / turns.length;
  const byTopic = new Map<Topic, { asked: number; correct: number }>();
  for (const t of turns) {
    const entry = byTopic.get(t.topic) ?? { asked: 0, correct: 0 };
    entry.asked += 1;
    if (t.correct) entry.correct += 1;
    byTopic.set(t.topic, entry);
  }
  const strong = new Set<Topic>();
  for (const [topic, { asked, correct }] of byTopic) {
    if (correct / asked >= overall) strong.add(topic);
  }
  return strong;
}

export function computePlayStats(turns: TurnRecord[]): PlayStats {
  const stats: PlayStats = {
    turns: turns.length,
    dares: 0,
    hardAsked: 0,
    hardCorrect: 0,
    correct: 0,
    longestStreak: 0,
    totalPoints: 0,
    pointsFromStrongTopicDares: 0,
  };
  if (turns.length === 0) return stats;

  const strong = strongTopics(turns);
  let streak = 0;
  for (const t of turns) {
    if (t.dared) stats.dares += 1;
    if (t.difficulty === "hard") {
      stats.hardAsked += 1;
      if (t.correct) stats.hardCorrect += 1;
    }
    if (t.correct) {
      stats.correct += 1;
      streak += 1;
      stats.longestStreak = Math.max(stats.longestStreak, streak);
    } else {
      streak = 0;
    }
    const points = pointsFor(t);
    stats.totalPoints += points;
    if (t.dared && strong.has(t.topic)) stats.pointsFromStrongTopicDares += points;
  }
  return stats;
}

export function sortIntoHouse(stats: PlayStats): { house: HouseName; scores: HouseScores } {
  if (stats.turns === 0) {
    return {
      house: "RAVENCLAW",
      scores: { GRYFFINDOR: 0, SLYTHERIN: 0, RAVENCLAW: 0, HUFFLEPUFF: 0 },
    };
  }
  const { ravenclawSaturation, streakWeight, accuracyWeight } = SORTING_WEIGHTS;
  const scores: HouseScores = {
    GRYFFINDOR: stats.dares / stats.turns,
    RAVENCLAW:
      stats.hardAsked === 0
        ? 0
        : (stats.hardCorrect / stats.hardAsked) * Math.min(1, stats.hardAsked / ravenclawSaturation),
    HUFFLEPUFF:
      streakWeight * (stats.longestStreak / STREAK_CAP) + accuracyWeight * (stats.correct / stats.turns),
    SLYTHERIN: stats.totalPoints === 0 ? 0 : stats.pointsFromStrongTopicDares / stats.totalPoints,
  };
  // Strict ">" over the tie-break order keeps the earlier house on ties.
  let house: HouseName = "RAVENCLAW";
  for (const candidate of TIE_BREAK) {
    if (scores[candidate] > scores[house] + 1e-9) house = candidate;
  }
  return { house, scores };
}
