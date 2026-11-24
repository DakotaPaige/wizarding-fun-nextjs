import { describe, expect, it } from "vitest";
import { topicsFor } from "./topic-rules";
import type { Topic, TurnRecord } from "./types";

const ALL: Topic[] = ["wand", "patronus", "spell", "actor", "house"];
const turn = (topic: Topic): TurnRecord => ({ topic, difficulty: "hard", dared: true, correct: true, msToAnswer: 1 });

describe("topicsFor", () => {
  it("never offers wand on a normal question", () => {
    expect(topicsFor(ALL, [], "normal")).toEqual(["patronus", "spell", "actor", "house"]);
  });

  it("offers wand on a hard question while the round has had none", () => {
    expect(topicsFor(ALL, [turn("spell")], "hard")).toEqual(ALL);
  });

  it("offers wand at most once per round", () => {
    expect(topicsFor(ALL, [turn("wand"), turn("spell")], "hard")).toEqual(["patronus", "spell", "actor", "house"]);
  });
});
