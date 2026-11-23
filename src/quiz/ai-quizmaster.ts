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
import { AI_TIMEOUT_MS } from "./time-budget";
import type { PlayStats, Quizmaster, Topic } from "./types";

const TURN_MAX_TOKENS = 400;
const VERDICT_MAX_TOKENS = 300;

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
  /**
   * Called once per call with the tokens it used, so the guard can settle its reservation;
   * 0 when the request failed and nothing came back.
   */
  onUsage: (tokens: number) => Promise<void>;
  /** The SDK timeout for this request's one call (shortened by the request's time budget). */
  timeoutMs?: number;
}

const poseQuestionInput = z.object({
  topic: z.enum(TOPIC_VALUES),
  difficulty: z.enum(DIFFICULTY_VALUES),
  hat_line: z.string().trim().min(1).max(HAT_LINE_MAX_LENGTH),
});

export function createAiQuizmaster(deps: AiQuizmasterDeps): Quizmaster {
  const requestOptions = { timeout: deps.timeoutMs ?? AI_TIMEOUT_MS, maxRetries: 0 } as const;

  async function report(tokens: number) {
    // A failing meter must not decide the outcome.
    try {
      await deps.onUsage(tokens);
    } catch {
      /* swallowed on purpose */
    }
  }

  async function send(params: Omit<Anthropic.MessageCreateParamsNonStreaming, "model" | "output_config">) {
    let response: Anthropic.Message;
    try {
      response = await deps.client.messages.create(
        {
          model: deps.model,
          output_config: { effort: "low" },
          ...params,
        },
        requestOptions,
      );
    } catch (cause) {
      await report(0);
      throw new AiQuizmasterError("Claude request failed", { cause });
    }
    // Usage is spent whether or not the response is usable. A missing count reports NaN, which
    // keeps the reservation rather than guessing low.
    const usage = response.usage as Anthropic.Usage | undefined;
    await report(Number(usage?.input_tokens) + Number(usage?.output_tokens));
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
