import type { CharacterRecord } from "@/data/types";
import { buildQuestion, pick } from "@/quiz/generators/build";
import { featuredOnly } from "@/quiz/generators/featured";
import type { QuestionGenerator } from "@/quiz/types";

function hasPatronus(c: CharacterRecord): boolean {
  return c.patronus !== null && c.patronus.toLowerCase() !== "non-corporeal";
}

function samePatronus(a: CharacterRecord, b: CharacterRecord): boolean {
  return a.patronus!.toLowerCase() === b.patronus!.toLowerCase();
}

function withArticle(word: string): string {
  return `${/^[aeiou]/i.test(word) ? "an" : "a"} ${word}`;
}

export const generatePatronus: QuestionGenerator = (difficulty, data, rng) => {
  const candidates = difficulty === "hard" ? data.characters : featuredOnly(data.characters);
  const pool = candidates.filter(hasPatronus);
  if (pool.length === 0) return null;
  const answer = pick(pool, rng);
  const others = pool.filter((c) => c.id !== answer.id);
  const sameHouse =
    difficulty === "hard" ? others.filter((c) => answer.house !== null && c.house === answer.house) : others;

  return buildQuestion(
    {
      topic: "patronus",
      difficulty,
      prompt: `Whose Patronus is ${withArticle(answer.patronus!)}?`,
      answer: answer.name,
      alsoCorrect: others.filter((c) => samePatronus(c, answer)).map((c) => c.name),
      preferred: sameHouse.map((c) => c.name),
      fallback: others.map((c) => c.name),
    },
    rng,
  );
};
