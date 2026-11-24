import { describe, expect, it } from "vitest";
import charactersSnapshot from "@/data/snapshot/characters.json";
import spellsSnapshot from "@/data/snapshot/spells.json";
import { FEATURED } from "@/data/curated/featured";
import { CURATED_SPELLS } from "@/data/curated/spells";
import type { CharacterRecord, SpellRecord } from "@/data/types";
import { availableTopics, generateQuestion } from "@/quiz/generators";
import { createRng } from "@/quiz/rng";
import type { Difficulty, Question, QuizData, Topic } from "@/quiz/types";

const data: QuizData = {
  characters: charactersSnapshot as CharacterRecord[],
  spells: spellsSnapshot as SpellRecord[],
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

  /** Every label that truly answers `q`, judged from the data rather than the generator. */
  function labelsThatFit(q: Question): Set<string> {
    const c = data.characters;
    const names = (keep: (x: (typeof c)[number]) => boolean) => new Set(c.filter(keep).map((x) => x.name));
    const m = (re: RegExp) => q.prompt.match(re)![1]!;
    switch (q.topic) {
      case "patronus": {
        const animal = m(/^Whose Patronus is an? (.+)\?$/).toLowerCase();
        return names((x) => x.patronus?.toLowerCase() === animal);
      }
      case "wand":
        return names(
          (x) =>
            !!x.wand?.wood &&
            q.prompt.toLowerCase() ===
              `${x.wand.wood}, ${x.wand.core}, ${x.wand.lengthInches} inches. whose wand is this?`.toLowerCase(),
        );
      case "spell": {
        const text = m(/^Which spell: “([\s\S]+)”\?$/);
        const override = (slug: string) => CURATED_SPELLS.find((s) => s.slug === slug)?.descriptionOverride;
        return new Set(data.spells.filter((s) => s.description === text || override(s.id) === text).map((s) => s.name));
      }
      case "actor": {
        const who = m(/^Who played (.+)\?$/);
        return new Set(c.filter((x) => x.name === who && x.actor).map((x) => x.actor!));
      }
      case "house": {
        const who = m(/^Which house was (.+) in\?$/);
        return new Set(c.filter((x) => x.name === who && x.house).map((x) => x.house!.charAt(0) + x.house!.slice(1).toLowerCase()));
      }
      default:
        throw new Error(`no oracle for ${q.topic}`);
    }
  }

  it("offers exactly one option that fits the prompt (no second right answer)", () => {
    const failures: string[] = [];
    for (const topic of availableTopics(data)) {
      for (const difficulty of DIFFICULTIES) {
        for (let seed = 1; seed <= 400; seed++) {
          const q = generateQuestion({ topic, difficulty }, data, createRng(seed));
          expect(q, `${topic}/${difficulty}/${seed}`).not.toBeNull();
          if (q === null) continue;
          const fit = labelsThatFit(q);
          const fitting = q.options.filter((o) => fit.has(o.label));
          const correct = q.options.find((o) => o.id === q.correctOptionId)!;
          if (fitting.length !== 1 || fitting[0] !== correct) {
            failures.push(`${q.prompt} → ${fitting.map((o) => o.label).join(" & ")}`);
          }
        }
      }
    }
    expect([...new Set(failures)]).toEqual([]);
  });

  it("gives questions that read the same the same id, and different questions different ids", () => {
    const byId = new Map<string, string>();
    for (const topic of availableTopics(data) as Topic[]) {
      for (const difficulty of DIFFICULTIES) {
        for (let seed = 1; seed <= 300; seed++) {
          const q = generateQuestion({ topic, difficulty }, data, createRng(seed));
          expect(q, `${topic}/${difficulty}/${seed}`).not.toBeNull();
          if (q === null) continue;
          const looks = `${q.topic}|${q.prompt}|${q.artSlot}`;
          expect(byId.get(q.id) ?? looks, q.id).toBe(looks);
          byId.set(q.id, looks);
        }
      }
    }
    const looks = [...byId.values()];
    expect(new Set(looks).size).toBe(looks.length);
  });

  it("asks normal questions about featured characters only", () => {
    const featured = data.characters.filter((c) => Object.hasOwn(FEATURED, c.id));
    const names = new Set(featured.map((c) => c.name));
    const actors = new Set(featured.map((c) => c.actor).filter((a) => a !== null));
    const patronusOf = new Set(featured.map((c) => c.patronus?.toLowerCase()));
    for (const topic of ["patronus", "house", "actor", "wand"] as const) {
      for (let seed = 1; seed <= 300; seed++) {
        const q = generateQuestion({ topic, difficulty: "normal" }, data, createRng(seed));
        expect(q, `${topic}/${seed}`).not.toBeNull();
        const labels = q!.options.map((o) => o.label);
        const correct = q!.options.find((o) => o.id === q!.correctOptionId)!.label;
        if (topic === "patronus" || topic === "wand") {
          expect(names.has(correct), `${q!.prompt} → ${correct}`).toBe(true);
          expect(labels.every((l) => names.has(l)), q!.prompt).toBe(true);
        }
        if (topic === "patronus") {
          expect(patronusOf.has(q!.prompt.match(/^Whose Patronus is an? (.+)\?$/)![1]!.toLowerCase())).toBe(true);
        }
        if (topic === "house") {
          const who = q!.prompt.match(/^Which house was (.+) in\?$/)![1]!;
          expect(names.has(who), q!.prompt).toBe(true);
        }
        if (topic === "actor") {
          const who = q!.prompt.match(/^Who played (.+)\?$/)![1]!;
          expect(names.has(who), q!.prompt).toBe(true);
          expect(labels.every((l) => actors.has(l)), q!.prompt).toBe(true);
        }
      }
    }
  });

  it("never returns null for a hard house question, and its name identifies one character", () => {
    for (let seed = 1; seed <= 400; seed++) {
      const q = generateQuestion({ topic: "house", difficulty: "hard" }, data, createRng(seed));
      expect(q, `seed ${seed}`).not.toBeNull();
      const who = q!.prompt.match(/^Which house was (.+) in\?$/)![1]!;
      expect(data.characters.filter((c) => c.name === who && c.house !== null), who).toHaveLength(1);
    }
  });
});
