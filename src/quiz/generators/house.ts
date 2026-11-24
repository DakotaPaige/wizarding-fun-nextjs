import { buildQuestion, capitalise, pick } from "@/quiz/generators/build";
import { FEATURED } from "@/data/curated/featured";
import type { CharacterRecord, HouseName } from "@/data/types";
import { featuredOnly } from "@/quiz/generators/featured";
import type { QuestionGenerator } from "@/quiz/types";

const HOUSE_NAMES: readonly HouseName[] = ["GRYFFINDOR", "SLYTHERIN", "RAVENCLAW", "HUFFLEPUFF"];

const houseLabel = (house: HouseName) => capitalise(house.toLowerCase());

/** "Hufflepuff ghost" names its own answer. */
const NAMES_A_HOUSE = /gryffindor|slytherin|ravenclaw|hufflepuff/i;

/** "Unidentified Slytherin boy", "Boy who ...": descriptions of someone, not names. */
const IS_A_DESCRIPTION = /^(unidentified|(boy|girl|man|woman) who)\b/i;

/**
 * Hard questions may use any kept character, except one whose name gives the answer away or is only
 * a description, and except the featured characters: "Which house was Harry Potter in?" is no dare.
 * The name must also identify a single character (otherwise "Emily" has several houses and the other
 * three may not be formable).
 */
function hardPool(characters: readonly CharacterRecord[]): CharacterRecord[] {
  const nameCounts = new Map<string, number>();
  for (const c of characters) nameCounts.set(c.name, (nameCounts.get(c.name) ?? 0) + 1);
  return characters.filter(
    (c) =>
      c.house !== null &&
      nameCounts.get(c.name) === 1 &&
      !Object.hasOwn(FEATURED, c.id) &&
      !NAMES_A_HOUSE.test(c.name) &&
      !IS_A_DESCRIPTION.test(c.name),
  );
}

export const generateHouse: QuestionGenerator = (difficulty, data, rng) => {
  const pool =
    difficulty === "hard"
      ? hardPool(data.characters)
      : featuredOnly(data.characters).filter((c) => c.house !== null);
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
