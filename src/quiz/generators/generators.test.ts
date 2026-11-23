import { describe, expect, it } from "vitest";
import charactersSnapshot from "@/data/snapshot/characters.json";
import spellsSnapshot from "@/data/snapshot/spells.json";
import { RawCharacterSchema, RawSpellSchema } from "@/data/hp-api/schemas";
import { normaliseCharacter, normaliseSpell } from "@/data/normalise";
import { availableTopics, generateQuestion } from "@/quiz/generators";
import { createRng } from "@/quiz/rng";
import type { Difficulty, QuizData } from "@/quiz/types";

const data: QuizData = {
  characters: (charactersSnapshot as unknown[])
    .map((c) => RawCharacterSchema.safeParse(c))
    .flatMap((r) => (r.success ? [normaliseCharacter(r.data)] : [])),
  spells: (spellsSnapshot as unknown[])
    .map((s) => RawSpellSchema.safeParse(s))
    .flatMap((r) => (r.success ? [normaliseSpell(r.data)] : [])),
};
const DIFFICULTIES: Difficulty[] = ["normal", "hard"];

describe("question generators", () => {
  it("builds valid 4-option questions for every available topic and difficulty", () => {
    const topics = availableTopics(data);
    expect(topics.length).toBeGreaterThan(0);
    for (const topic of topics) {
      for (const difficulty of DIFFICULTIES) {
        for (let seed = 1; seed <= 20; seed++) {
          const q = generateQuestion({ topic, difficulty }, data, createRng(seed));
          expect(q, `${topic}/${difficulty}/${seed}`).not.toBeNull();
          expect(q!.options).toHaveLength(4);
          expect(new Set(q!.options.map((o) => o.label)).size).toBe(4);
          expect(q!.options.map((o) => o.id)).toContain(q!.correctOptionId);
          expect(q!.prompt.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("is deterministic for a seed and varies across seeds", () => {
    const spec = { topic: "wand", difficulty: "normal" } as const;
    expect(generateQuestion(spec, data, createRng(42))).toEqual(generateQuestion(spec, data, createRng(42)));
    const differs = availableTopics(data).some(
      (topic) =>
        JSON.stringify(generateQuestion({ topic, difficulty: "normal" }, data, createRng(1))) !==
        JSON.stringify(generateQuestion({ topic, difficulty: "normal" }, data, createRng(2))),
    );
    expect(differs).toBe(true);
  });

  it("gives hard wand questions distractors that share wood or core with the answer", () => {
    const q = generateQuestion({ topic: "wand", difficulty: "hard" }, data, createRng(42))!;
    const byName = (label: string) => data.characters.find((c) => c.name === label && c.wand)!;
    const answer = byName(q.options.find((o) => o.id === q.correctOptionId)!.label);
    const poolSize = data.characters.filter(
      (c) =>
        c.id !== answer.id &&
        c.wand?.wood &&
        c.wand.core &&
        c.wand.lengthInches !== null &&
        (c.wand.wood === answer.wand!.wood || c.wand.core === answer.wand!.core),
    ).length;
    expect(poolSize).toBeGreaterThanOrEqual(3);
    for (const option of q.options.filter((o) => o.id !== q.correctOptionId)) {
      const other = byName(option.label);
      expect(other.wand!.wood === answer.wand!.wood || other.wand!.core === answer.wand!.core).toBe(true);
    }
  });

  it("excludes portrait while the art manifest is empty", () => {
    expect(availableTopics(data)).not.toContain("portrait");
    for (const difficulty of DIFFICULTIES) {
      expect(generateQuestion({ topic: "portrait", difficulty }, data, createRng(42))).toBeNull();
    }
  });

  it("returns null when fewer than 4 distinct labels can be formed", () => {
    const three = data.characters
      .filter((c) => c.wand?.wood && c.wand.core && c.wand.lengthInches !== null)
      .slice(0, 3);
    expect(three).toHaveLength(3);
    const small: QuizData = { characters: three, spells: data.spells };
    expect(generateQuestion({ topic: "wand", difficulty: "normal" }, small, createRng(42))).toBeNull();
  });
});
