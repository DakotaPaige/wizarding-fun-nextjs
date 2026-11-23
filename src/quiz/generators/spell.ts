import { CURATED_SPELLS } from "@/data/curated/spells";
import { buildQuestion, pick } from "@/quiz/generators/build";
import type { QuestionGenerator, QuizData } from "@/quiz/types";

interface SpellEntry {
  id: string;
  name: string;
  description: string;
}

function curatedPool(data: QuizData): SpellEntry[] {
  const entries: SpellEntry[] = [];
  for (const curated of CURATED_SPELLS) {
    const spell = data.spells.find((s) => s.name === curated.apiName);
    const description = curated.descriptionOverride ?? spell?.description ?? "";
    if (spell && description) entries.push({ id: spell.id, name: spell.name, description });
  }
  return entries;
}

export const generateSpell: QuestionGenerator = (difficulty, data, rng) => {
  const pool: SpellEntry[] =
    difficulty === "normal" ? curatedPool(data) : data.spells.filter((s) => s.description !== "");
  if (pool.length === 0) return null;
  const answer = pick(pool, rng);
  const names = pool.filter((s) => s.id !== answer.id).map((s) => s.name);

  return buildQuestion(
    {
      topic: "spell",
      difficulty,
      answerKey: answer.id,
      prompt: `Which spell: “${answer.description}”?`,
      answer: answer.name,
      preferred: names,
      fallback: names,
    },
    rng,
  );
};
