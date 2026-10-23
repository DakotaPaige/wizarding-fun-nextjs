import { describe, expect, it } from "vitest";
import { computePlayStats, sortIntoHouse } from "./sorting";
import type { Topic, TurnRecord } from "./types";

function turn(topic: Topic, dared: boolean, correct: boolean): TurnRecord {
  return { topic, difficulty: dared ? "hard" : "normal", dared, correct, msToAnswer: 1000 };
}

function run(topic: Topic, dared: boolean, pattern: string): TurnRecord[] {
  return [...pattern].map((c) => turn(topic, dared, c === "C"));
}

describe("sortIntoHouse", () => {
  it("sorts 10 safe correct answers into HUFFLEPUFF", () => {
    const { house, scores } = sortIntoHouse(computePlayStats(run("spell", false, "CCCCCCCCCC")));
    expect(house).toBe("HUFFLEPUFF");
    expect(scores.HUFFLEPUFF).toBeCloseTo(1);
  });

  it("sorts 10 dared correct answers into RAVENCLAW via the tie-break", () => {
    const { house, scores } = sortIntoHouse(computePlayStats(run("spell", true, "CCCCCCCCCC")));
    expect(house).toBe("RAVENCLAW");
    expect(scores.GRYFFINDOR).toBeCloseTo(1);
    expect(scores.RAVENCLAW).toBeCloseTo(1);
    expect(scores.HUFFLEPUFF).toBeCloseTo(1);
    expect(scores.SLYTHERIN).toBeCloseTo(1);
  });

  it("sorts 10 dared wrong answers into GRYFFINDOR", () => {
    expect(sortIntoHouse(computePlayStats(run("spell", true, "WWWWWWWWWW"))).house).toBe("GRYFFINDOR");
  });

  it("sorts a strong-topic dare mix into SLYTHERIN with the expected scores", () => {
    const turns = [...run("wand", true, "CCCW"), ...run("patronus", false, "CCCWWW")];
    const stats = computePlayStats(turns);
    expect(stats).toEqual({
      turns: 10,
      dares: 4,
      hardAsked: 4,
      hardCorrect: 3,
      correct: 6,
      longestStreak: 3,
      totalPoints: 9,
      pointsFromStrongTopicDares: 6,
    });
    const { house, scores } = sortIntoHouse(stats);
    expect(house).toBe("SLYTHERIN");
    expect(scores.GRYFFINDOR).toBeCloseTo(0.4);
    expect(scores.RAVENCLAW).toBeCloseTo(0.6);
    expect(scores.HUFFLEPUFF).toBeCloseTo(0.45);
    expect(scores.SLYTHERIN).toBeCloseTo(2 / 3);
  });

  it("returns zeroed stats and RAVENCLAW for no turns", () => {
    const stats = computePlayStats([]);
    expect(stats).toEqual({
      turns: 0,
      dares: 0,
      hardAsked: 0,
      hardCorrect: 0,
      correct: 0,
      longestStreak: 0,
      totalPoints: 0,
      pointsFromStrongTopicDares: 0,
    });
    const { house, scores } = sortIntoHouse(stats);
    expect(house).toBe("RAVENCLAW");
    expect(Object.values(scores)).toEqual([0, 0, 0, 0]);
  });
});
