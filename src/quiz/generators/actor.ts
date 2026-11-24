import { buildQuestion, pick } from "@/quiz/generators/build";
import { featuredOnly } from "@/quiz/generators/featured";
import type { QuestionGenerator } from "@/quiz/types";

export const generateActor: QuestionGenerator = (difficulty, data, rng) => {
  const withActor = data.characters.filter((c) => c.actor !== null);
  const pool = difficulty === "hard" ? withActor : featuredOnly(withActor);
  if (pool.length === 0) return null;
  const answer = pick(pool, rng);
  const others = pool.filter((c) => c.id !== answer.id);
  const sameHouse =
    difficulty === "hard" ? withActor.filter((c) => c.id !== answer.id && answer.house !== null && c.house === answer.house) : others;

  return buildQuestion(
    {
      topic: "actor",
      difficulty,
      prompt: `Who played ${answer.name}?`,
      answer: answer.actor!,
      // Another character of the same name was played by someone else.
      alsoCorrect: withActor.filter((c) => c.id !== answer.id && c.name === answer.name).map((c) => c.actor!),
      preferred: sameHouse.map((c) => c.actor!),
      fallback: others.map((c) => c.actor!),
    },
    rng,
  );
};
