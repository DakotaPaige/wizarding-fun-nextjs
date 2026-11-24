import type { CharacterRecord } from "@/data/types";
import { buildQuestion, capitalise, pick } from "@/quiz/generators/build";
import type { QuestionGenerator } from "@/quiz/types";

function hasFullWand(c: CharacterRecord): boolean {
  return !!c.wand && c.wand.wood !== null && c.wand.core !== null && c.wand.lengthInches !== null;
}

function sameWand(a: CharacterRecord, b: CharacterRecord): boolean {
  const [x, y] = [a.wand!, b.wand!];
  return (
    x.wood!.toLowerCase() === y.wood!.toLowerCase() &&
    x.core!.toLowerCase() === y.core!.toLowerCase() &&
    x.lengthInches === y.lengthInches
  );
}

export const generateWand: QuestionGenerator = (difficulty, data, rng) => {
  const pool = data.characters.filter(hasFullWand);
  if (pool.length === 0) return null;
  const answer = pick(pool, rng);
  const wand = answer.wand!;
  const others = pool.filter((c) => c.id !== answer.id);
  const similar =
    difficulty === "hard"
      ? others.filter((c) => c.wand!.wood === wand.wood || c.wand!.core === wand.core)
      : others;

  return buildQuestion(
    {
      topic: "wand",
      difficulty,
      prompt: `${capitalise(wand.wood!)}, ${wand.core}, ${wand.lengthInches} inches. Whose wand is this?`,
      answer: answer.name,
      alsoCorrect: others.filter((c) => sameWand(c, answer)).map((c) => c.name),
      preferred: similar.map((c) => c.name),
      fallback: others.map((c) => c.name),
    },
    rng,
  );
};
