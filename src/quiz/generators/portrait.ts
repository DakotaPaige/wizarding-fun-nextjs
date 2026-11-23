import { getArt } from "@/data/art-manifest";
import { buildQuestion, pick } from "@/quiz/generators/build";
import type { QuestionGenerator } from "@/quiz/types";

export const generatePortrait: QuestionGenerator = (difficulty, data, rng) => {
  const pool = data.characters.filter((c) => getArt(`portrait.${c.id}`) !== null);
  if (pool.length === 0) return null;
  const answer = pick(pool, rng);
  const others = pool.filter((c) => c.id !== answer.id);
  const sameHouse =
    difficulty === "hard" ? others.filter((c) => answer.house !== null && c.house === answer.house) : others;

  return buildQuestion(
    {
      topic: "portrait",
      difficulty,
      answerKey: answer.id,
      prompt: "Who is this?",
      artSlot: `portrait.${answer.id}`,
      answer: answer.name,
      preferred: sameHouse.map((c) => c.name),
      fallback: others.map((c) => c.name),
    },
    rng,
  );
};
