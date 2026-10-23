import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { HouseName } from "@/data/types";
import {
  DIFFICULTY_VALUES,
  HAT_LINE_MAX_LENGTH,
  POSE_QUESTION_TOOL,
  SYSTEM_PROMPT,
  VERDICT_SYSTEM_PROMPT,
  TOPIC_VALUES,
  buildTurnMessage,
} from "./ai-prompt";
import type { PlayStats, Quizmaster, Topic } from "./types";

const TURN_MAX_TOKENS = 400;
const VERDICT_MAX_TOKENS = 300;
const REQUEST_OPTIONS = { timeout: 6000, maxRetries: 0 } as const;

export class AiQuizmasterError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiQuizmasterError";
  }
}

export interface AiQuizmasterDeps {
  client: Pick<Anthropic, "messages">;
  model: string;
  topics: Topic[];
  onUsage: (tokens: number) => Promise<void>;
}

const poseQuestionInput = z.object({
  topic: z.enum(TOPIC_VALUES),
  difficulty: z.enum(DIFFICULTY_VALUES),
  hat_line: z.string().trim().min(1).max(HAT_LINE_MAX_LENGTH),
});

export function createAiQuizmaster(deps: AiQuizmasterDeps): Quizmaster {
  async function send(params: Omit<Anthropic.MessageCreateParamsNonStreaming, "model" | "output_config">) {
    let response: Anthropic.Message;
    try {
      response = await deps.client.messages.create(
        {
          model: deps.model,
          output_config: { effort: "low" },
          ...params,
        },
        REQUEST_OPTIONS,
      );
    } catch (cause) {
      throw new AiQuizmasterError("Claude request failed", { cause });
    }
    // Usage is spent whether or not the response is usable; a failing meter must not decide the outcome.
    try {
      await deps.onUsage(response.usage.input_tokens + response.usage.output_tokens);
    } catch {
      /* swallowed on purpose */
    }
    return response;
  }

  function requireStopReason(response: Anthropic.Message, expected: "tool_use" | "end_turn") {
    if (response.stop_reason !== expected) {
      throw new AiQuizmasterError(`Unexpected stop_reason "${String(response.stop_reason)}" (expected "${expected}")`);
    }
  }

  return {
    mode: "ai",

    async nextTurn(state, dared) {
      const response = await send({
        system: SYSTEM_PROMPT,
        max_tokens: TURN_MAX_TOKENS,
        tools: [POSE_QUESTION_TOOL],
        tool_choice: { type: "auto" },
        messages: [{ role: "user", content: buildTurnMessage(state, dared, deps.topics) }],
      });
      requireStopReason(response, "tool_use");

      const block = response.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === POSE_QUESTION_TOOL.name,
      );
      if (!block) throw new AiQuizmasterError("Response contained no pose_question tool call");

      const parsed = poseQuestionInput.safeParse(block.input);
      if (!parsed.success) {
        throw new AiQuizmasterError("pose_question input failed validation", { cause: parsed.error });
      }
      const { topic, hat_line } = parsed.data;
      if (!deps.topics.includes(topic)) {
        throw new AiQuizmasterError(`Topic "${topic}" is not allowed in this game`);
      }
      // The dare is the player's choice, not the model's.
      return { spec: { topic, difficulty: dared ? "hard" : "normal" }, hatLine: hat_line };
    },

    async verdict(stats: PlayStats, house: HouseName) {
      const response = await send({
        system: VERDICT_SYSTEM_PROMPT,
        max_tokens: VERDICT_MAX_TOKENS,
        messages: [
          {
            role: "user",
            content: `Deliver the verdict. The Hat has decided on ${house}.\nPlay statistics: ${JSON.stringify(stats)}`,
          },
        ],
      });
      requireStopReason(response, "end_turn");

      const text = response.content
        .flatMap((b) => (b.type === "text" ? [b.text] : []))
        .join("")
        .trim();
      if (!text) throw new AiQuizmasterError("Verdict response was empty");
      return text;
    },
  };
}
