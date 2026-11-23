import { generateActor } from "@/quiz/generators/actor";
import { generateHouse } from "@/quiz/generators/house";
import { generatePatronus } from "@/quiz/generators/patronus";
import { generatePortrait } from "@/quiz/generators/portrait";
import { generateSpell } from "@/quiz/generators/spell";
import { generateWand } from "@/quiz/generators/wand";
import type { Question, QuestionGenerator, QuestionSpec, QuizData, Rng, Topic } from "@/quiz/types";

const GENERATORS: Record<Topic, QuestionGenerator> = {
  wand: generateWand,
  patronus: generatePatronus,
  spell: generateSpell,
  actor: generateActor,
  house: generateHouse,
  portrait: generatePortrait,
};

/** A topic is available when it can form a question at both difficulties (probed with a throwaway rng). */
export function availableTopics(data: QuizData): Topic[] {
  return (Object.keys(GENERATORS) as Topic[]).filter((topic) =>
    (["normal", "hard"] as const).every((difficulty) => GENERATORS[topic](difficulty, data, () => 0) !== null),
  );
}

export function generateQuestion(spec: QuestionSpec, data: QuizData, rng: Rng): Question | null {
  return GENERATORS[spec.topic](spec.difficulty, data, rng);
}
