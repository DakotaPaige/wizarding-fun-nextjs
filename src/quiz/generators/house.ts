import { ROSTER } from "@/data/curated/roster";
import { buildQuestion, capitalise, pick } from "@/quiz/generators/build";
import type { HouseName } from "@/data/types";
import type { QuestionGenerator } from "@/quiz/types";

const ROSTER_IDS = new Set(Object.values(ROSTER).flat());
const HOUSE_NAMES: readonly HouseName[] = ["GRYFFINDOR", "SLYTHERIN", "RAVENCLAW", "HUFFLEPUFF"];

const houseLabel = (house: HouseName) => capitalise(house.toLowerCase());

export const generateHouse: QuestionGenerator = (difficulty, data, rng) => {
  const pool = data.characters.filter(
    (c) => c.house !== null && (difficulty === "normal" ? ROSTER_IDS.has(c.id) : !ROSTER_IDS.has(c.id)),
  );
  if (pool.length === 0) return null;
  const answer = pick(pool, rng);
  const others = HOUSE_NAMES.filter((h) => h !== answer.house).map(houseLabel);

  return buildQuestion(
    {
      topic: "house",
      difficulty,
      answerKey: answer.id,
      prompt: `Which house was ${answer.name} in?`,
      answer: houseLabel(answer.house!),
      preferred: others,
      fallback: others,
    },
    rng,
  );
};
