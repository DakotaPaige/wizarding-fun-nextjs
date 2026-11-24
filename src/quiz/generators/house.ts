import { buildQuestion, capitalise, pick } from "@/quiz/generators/build";
import type { HouseName } from "@/data/types";
import { featuredOnly } from "@/quiz/generators/featured";
import type { QuestionGenerator } from "@/quiz/types";

const HOUSE_NAMES: readonly HouseName[] = ["GRYFFINDOR", "SLYTHERIN", "RAVENCLAW", "HUFFLEPUFF"];

const houseLabel = (house: HouseName) => capitalise(house.toLowerCase());

export const generateHouse: QuestionGenerator = (difficulty, data, rng) => {
  const housed = (difficulty === "hard" ? data.characters : featuredOnly(data.characters)).filter((c) => c.house !== null);
  // Hard questions may use any kept character, but only one whose name identifies a single character
  // (otherwise "Emily" has several houses and the other three may not be formable).
  const nameCounts = new Map<string, number>();
  for (const c of data.characters) nameCounts.set(c.name, (nameCounts.get(c.name) ?? 0) + 1);
  const pool = difficulty === "hard" ? housed.filter((c) => nameCounts.get(c.name) === 1) : housed;
  if (pool.length === 0) return null;
  const answer = pick(pool, rng);
  const others = HOUSE_NAMES.filter((h) => h !== answer.house).map(houseLabel);

  return buildQuestion(
    {
      topic: "house",
      difficulty,
      prompt: `Which house was ${answer.name} in?`,
      answer: houseLabel(answer.house!),
      // Another character of the same name was in a different house.
      alsoCorrect: data.characters
        .filter((c) => c.id !== answer.id && c.name === answer.name && c.house !== null)
        .map((c) => houseLabel(c.house!)),
      preferred: others,
      fallback: others,
    },
    rng,
  );
};
