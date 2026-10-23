import type Anthropic from "@anthropic-ai/sdk";
import type { Difficulty, GameState, Topic } from "./types";

export const TOPIC_VALUES = ["wand", "patronus", "spell", "actor", "house", "portrait"] as const satisfies readonly Topic[];
export const DIFFICULTY_VALUES = ["normal", "hard"] as const satisfies readonly Difficulty[];
export const HAT_LINE_MAX_LENGTH = 160;
export const TURNS_PER_GAME = 10;

/** Fixed text: no interpolation, so the request prefix stays byte-stable. */
export const SYSTEM_PROMPT = `You are the Sorting Hat, an ancient, witty, slightly theatrical hat quizzing a student before sorting them into a house. You run a ten-question round, and each turn you choose the next question's topic and difficulty and add one line of commentary.

Always respond by calling the pose_question tool. Never reply with plain text.

Rules:
- Topics: wand, patronus, spell, actor, house, portrait. Only choose a topic the turn message lists as allowed for this game.
- Difficulties: normal, hard.
- Vary the topics. Avoid repeating the last topic, and spread questions across the allowed topics over the round.
- Lean toward the topics where the student's accuracy is weakest, while still mixing in the others.
- Match difficulty to the dare: if the turn message says the student dared, choose hard; otherwise choose normal.
- hat_line is one short line of commentary, at most ${HAT_LINE_MAX_LENGTH} characters, in the Hat's voice. React to how the student did on the previous question when there was one.
- Never hint at, reveal, or narrow down the correct answer. Do not mention answer options.
- Stay in character and keep it friendly and PG.

When asked for a verdict, you are given the house the Hat has decided on and the student's play statistics. Reply in 2 to 3 sentences of plain prose, in the Hat's voice, naming the house and giving a reason drawn from the statistics. Do not call any tool.`;

export const POSE_QUESTION_TOOL = {
  name: "pose_question",
  description: "Choose the topic and difficulty of the next quiz question and say one line as the Sorting Hat.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      topic: { type: "string", enum: [...TOPIC_VALUES] },
      difficulty: { type: "string", enum: [...DIFFICULTY_VALUES] },
      hat_line: { type: "string", maxLength: HAT_LINE_MAX_LENGTH },
    },
    required: ["topic", "difficulty", "hat_line"],
    additionalProperties: false,
  },
} as const satisfies Anthropic.Tool;

/** Per-request game state for the turn call; the only variable content in that request. */
export function buildTurnMessage(state: GameState, dared: boolean, topics: Topic[]): string {
  const accuracy = topics
    .map((topic) => {
      const asked = state.turns.filter((t) => t.topic === topic);
      if (asked.length === 0) return `- ${topic}: not asked yet`;
      const right = asked.filter((t) => t.correct).length;
      return `- ${topic}: ${right}/${asked.length} correct`;
    })
    .join("\n");
  const last = state.turns[state.turns.length - 1];
  const lastLine = last
    ? `Last question: ${last.topic}, ${last.difficulty}, answered ${last.correct ? "correctly" : "incorrectly"}.`
    : "Last question: none (this is the opening turn).";

  return [
    `Turn ${state.turns.length + 1} of ${TURNS_PER_GAME}.`,
    `Allowed topics: ${topics.join(", ")}.`,
    `Accuracy so far:\n${accuracy}`,
    lastLine,
    `The student ${dared ? "dared (choose hard)" : "played it safe (choose normal)"}.`,
  ].join("\n");
}
