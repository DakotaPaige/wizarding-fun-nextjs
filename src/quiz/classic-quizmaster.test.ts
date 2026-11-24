import { describe, expect, it } from "vitest";
import { createClassicQuizmaster } from "./classic-quizmaster";
import { CLASSIC_VERDICTS, HAT_LINES } from "./hat-lines";
import type { GameState, PlayStats, Topic, TurnRecord } from "./types";

const TOPICS: Topic[] = ["wand", "patronus", "spell", "actor", "house", "portrait"];

function turn(topic: Topic, correct: boolean, dared = false): TurnRecord {
  return { topic, difficulty: dared ? "hard" : "normal", dared, correct, msToAnswer: 1000 };
}

function state(seed: number, turns: TurnRecord[] = []): GameState {
  return { seed, mode: "classic", turns };
}

const STATS: PlayStats = {
  turns: 10,
  dares: 3,
  hardAsked: 3,
  hardCorrect: 2,
  correct: 7,
  longestStreak: 4,
  totalPoints: 10,
  pointsFromStrongTopicDares: 2,
};

describe("createClassicQuizmaster", () => {
  const qm = createClassicQuizmaster({ topics: TOPICS });

  it("is in classic mode", () => {
    expect(qm.mode).toBe("classic");
  });

  it("is deterministic for the same state", async () => {
    const s = state(42, [turn("wand", true)]);
    expect(await qm.nextTurn(s, false)).toEqual(await qm.nextTurn(s, false));
  });

  it("never repeats a topic across 9 sequential turns", async () => {
    const turns: TurnRecord[] = [];
    for (let i = 0; i < 9; i++) {
      const { spec } = await qm.nextTurn(state(7, turns), false);
      if (turns.length > 0) expect(spec.topic).not.toBe(turns[turns.length - 1]?.topic);
      turns.push(turn(spec.topic, i % 2 === 0));
    }
  });

  it("maps dared to hard difficulty and otherwise normal", async () => {
    expect((await qm.nextTurn(state(1), true)).spec.difficulty).toBe("hard");
    expect((await qm.nextTurn(state(1), false)).spec.difficulty).toBe("normal");
  });

  it("uses an opening line on turn 0", async () => {
    expect(HAT_LINES.opening).toContain((await qm.nextTurn(state(3), false)).hatLine);
  });

  it("reacts to the last turn", async () => {
    const cases: [boolean, boolean, string[]][] = [
      [false, true, HAT_LINES.safeRight],
      [false, false, HAT_LINES.safeWrong],
      [true, true, HAT_LINES.daredRight],
      [true, false, HAT_LINES.daredWrong],
    ];
    for (const [dared, correct, lines] of cases) {
      const r = await qm.nextTurn(state(5, [turn("spell", correct, dared)]), false);
      expect(lines).toContain(r.hatLine);
    }
  });

  it("favours weak topics over strong ones", async () => {
    const two = createClassicQuizmaster({ topics: ["patronus", "wand", "spell"] });
    let patronus = 0;
    let wand = 0;
    for (let seed = 0; seed < 200; seed++) {
      const turns = [
        turn("patronus", false), turn("patronus", false), turn("patronus", false),
        turn("wand", true), turn("wand", true), turn("wand", true),
        turn("spell", true),
      ];
      const { spec } = await two.nextTurn(state(seed, turns), false);
      if (spec.topic === "patronus") patronus += 1;
      if (spec.topic === "wand") wand += 1;
    }
    expect(patronus).toBeGreaterThan(wand);
  });

  it("only picks from the configured topics", async () => {
    const some = createClassicQuizmaster({ topics: ["actor", "house"] });
    for (let seed = 0; seed < 30; seed++) {
      expect(["actor", "house"]).toContain((await some.nextTurn(state(seed), false)).spec.topic);
    }
  });

  it("returns the only topic rather than throwing", async () => {
    const one = createClassicQuizmaster({ topics: ["wand"] });
    const r = await one.nextTurn(state(1, [turn("wand", true)]), false);
    expect(r.spec.topic).toBe("wand");
  });

  it("returns the house verdict", async () => {
    expect(await qm.verdict(STATS, "SLYTHERIN")).toBe(CLASSIC_VERDICTS.SLYTHERIN);
  });
});

describe("hat lines", () => {
  it("has at least 3 lines per list and a verdict per house", () => {
    for (const lines of Object.values(HAT_LINES)) expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(Object.keys(CLASSIC_VERDICTS).sort()).toEqual(["GRYFFINDOR", "HUFFLEPUFF", "RAVENCLAW", "SLYTHERIN"]);
  });

  it("asks wand only on dared turns, and at most once per round", async () => {
    const qm = createClassicQuizmaster({ topics: TOPICS });
    for (let seed = 1; seed <= 200; seed++) {
      const turns: TurnRecord[] = [];
      for (let i = 0; i < 10; i++) {
        const dared = (seed + i) % 2 === 0;
        const { spec } = await qm.nextTurn(state(seed, turns), dared);
        if (spec.topic === "wand") {
          expect(dared, `seed ${seed} turn ${i}`).toBe(true);
          expect(turns.some((t) => t.topic === "wand"), `seed ${seed} turn ${i}`).toBe(false);
        }
        turns.push(turn(spec.topic, i % 2 === 0, dared));
      }
    }
  });
});

