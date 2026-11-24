import { describe, expect, it, vi } from "vitest";
import { VERDICT_SYSTEM_PROMPT, POSE_QUESTION_TOOL } from "./ai-prompt";
import { AiQuizmasterError, createAiQuizmaster } from "./ai-quizmaster";
import type { GameState, PlayStats, Topic } from "./types";

const TOPICS: Topic[] = ["wand", "spell", "house"];
const STATE: GameState = { seed: 1, mode: "ai", turns: [] };
const STATS: PlayStats = {
  turns: 10,
  dares: 3,
  hardAsked: 3,
  hardCorrect: 2,
  correct: 7,
  longestStreak: 4,
  totalPoints: 10,
  pointsFromStrongTopicDares: 2,
};

function toolResponse(input: unknown, extra: Record<string, unknown> = {}) {
  return {
    stop_reason: "tool_use",
    content: [{ type: "tool_use", id: "t1", name: "pose_question", input }],
    usage: { input_tokens: 120, output_tokens: 30 },
    ...extra,
  };
}

function textResponse(text: string, stop_reason = "end_turn") {
  return {
    stop_reason,
    content: [{ type: "text", text }],
    usage: { input_tokens: 50, output_tokens: 20 },
  };
}

function setup(create: ReturnType<typeof vi.fn>, onUsage = vi.fn().mockResolvedValue(undefined)) {
  const qm = createAiQuizmaster({
    client: { messages: { create } } as never,
    model: "claude-haiku-5-5",
    topics: TOPICS,
    onUsage,
  });
  return { qm, onUsage, create };
}

const VALID = { topic: "spell", difficulty: "normal", hat_line: "Hmm, a curious mind." };

describe("createAiQuizmaster nextTurn", () => {
  it("returns the spec and hat line and reports token usage", async () => {
    const { qm, onUsage } = setup(vi.fn().mockResolvedValue(toolResponse(VALID)));
    const result = await qm.nextTurn(STATE, false);
    expect(qm.mode).toBe("ai");
    expect(result).toEqual({
      spec: { topic: "spell", difficulty: "normal" },
      hatLine: "Hmm, a curious mind.",
    });
    expect(onUsage).toHaveBeenCalledWith(150);
  });

  it("sends the mandated request settings and options", async () => {
    const { qm, create } = setup(vi.fn().mockResolvedValue(toolResponse(VALID)));
    await qm.nextTurn(STATE, false);
    expect(create).toHaveBeenCalledTimes(1);
    const [params, options] = create.mock.calls[0] as [Record<string, unknown>, unknown];
    expect(params).toMatchObject({
      model: "claude-haiku-5-5",
      max_tokens: 400,
      tool_choice: { type: "auto" },
      output_config: { effort: "low" },
    });
    expect((params.tools as Array<{ strict: boolean; name: string }>)[0]).toMatchObject({
      name: "pose_question",
      strict: true,
    });
    expect(options).toEqual({ timeout: 6000, maxRetries: 0 });
  });

  it("offers wand to the model only on a dared turn", async () => {
    const { qm, create } = setup(vi.fn().mockResolvedValue(toolResponse(VALID)));
    const allowed = () => {
      const [params] = create.mock.calls.at(-1) as [{ messages: { content: string }[] }];
      return params.messages[0]!.content.match(/^Allowed topics: (.+)\.$/m)![1]!.split(", ");
    };
    await qm.nextTurn(STATE, false);
    expect(allowed()).not.toContain("wand");
    await qm.nextTurn(STATE, true);
    expect(allowed()).toContain("wand");
  });

  it("forces hard difficulty when the player dared", async () => {
    const { qm } = setup(vi.fn().mockResolvedValue(toolResponse(VALID)));
    const result = await qm.nextTurn(STATE, true);
    expect(result.spec.difficulty).toBe("hard");
  });

  it("forces normal difficulty when the player played safe", async () => {
    const { qm } = setup(
      vi.fn().mockResolvedValue(toolResponse({ ...VALID, difficulty: "hard" })),
    );
    const result = await qm.nextTurn(STATE, false);
    expect(result.spec.difficulty).toBe("normal");
  });

  it("throws, but still reports usage, when there is no tool_use block", async () => {
    const { qm, onUsage } = setup(vi.fn().mockResolvedValue(textResponse("hello", "end_turn")));
    await expect(qm.nextTurn(STATE, false)).rejects.toBeInstanceOf(AiQuizmasterError);
    expect(onUsage).toHaveBeenCalledWith(70);
  });

  it("throws when the topic is not allowed for this game", async () => {
    const { qm, onUsage } = setup(
      vi.fn().mockResolvedValue(toolResponse({ ...VALID, topic: "patronus" })),
    );
    await expect(qm.nextTurn(STATE, false)).rejects.toBeInstanceOf(AiQuizmasterError);
    expect(onUsage).toHaveBeenCalledWith(150);
  });

  it("throws when the hat line is empty or too long", async () => {
    for (const hat_line of ["   ", "x".repeat(161)]) {
      const { qm } = setup(vi.fn().mockResolvedValue(toolResponse({ ...VALID, hat_line })));
      await expect(qm.nextTurn(STATE, false)).rejects.toBeInstanceOf(AiQuizmasterError);
    }
  });

  it("throws on a refusal and still reports usage", async () => {
    const { qm, onUsage } = setup(
      vi.fn().mockResolvedValue(toolResponse(VALID, { stop_reason: "refusal" })),
    );
    await expect(qm.nextTurn(STATE, false)).rejects.toBeInstanceOf(AiQuizmasterError);
    expect(onUsage).toHaveBeenCalledWith(150);
  });

  it("throws on max_tokens", async () => {
    const { qm } = setup(
      vi.fn().mockResolvedValue(toolResponse(VALID, { stop_reason: "max_tokens" })),
    );
    await expect(qm.nextTurn(STATE, false)).rejects.toBeInstanceOf(AiQuizmasterError);
  });

  it("wraps SDK rejections and keeps the cause", async () => {
    const cause = new Error("timed out");
    const { qm, onUsage } = setup(vi.fn().mockRejectedValue(cause));
    const err = await qm.nextTurn(STATE, false).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiQuizmasterError);
    expect((err as AiQuizmasterError).cause).toBe(cause);
    // Nothing usable came back: report 0 so the token reservation is released.
    expect(onUsage).toHaveBeenCalledExactlyOnceWith(0);
  });

  it("passes a shortened timeout through, still with no retries", async () => {
    const create = vi.fn().mockResolvedValue(toolResponse(VALID));
    const qm = createAiQuizmaster({
      client: { messages: { create } } as never,
      model: "claude-haiku-5-5",
      topics: TOPICS,
      onUsage: vi.fn().mockResolvedValue(undefined),
      timeoutMs: 4500,
    });
    await qm.nextTurn(STATE, false);
    expect(create.mock.calls[0]?.[1]).toEqual({ timeout: 4500, maxRetries: 0 });
  });

  it("is not masked by a rejecting onUsage", async () => {
    const ok = setup(
      vi.fn().mockResolvedValue(toolResponse(VALID)),
      vi.fn().mockRejectedValue(new Error("redis down")),
    );
    await expect(ok.qm.nextTurn(STATE, false)).resolves.toMatchObject({ hatLine: VALID.hat_line });

    const bad = setup(
      vi.fn().mockResolvedValue(textResponse("hi")),
      vi.fn().mockRejectedValue(new Error("redis down")),
    );
    const err = await bad.qm.nextTurn(STATE, false).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiQuizmasterError);
    expect((err as Error).message).not.toMatch(/redis/);
  });

  it("sends byte-identical system and tools on every call", async () => {
    const { qm, create } = setup(vi.fn().mockResolvedValue(toolResponse(VALID)));
    await qm.nextTurn(STATE, false);
    await qm.nextTurn(
      {
        ...STATE,
        turns: [{ topic: "wand", difficulty: "normal", dared: false, correct: true, msToAnswer: 900 }],
      },
      true,
    );
    const [a, b] = create.mock.calls.map((c) => c[0] as Record<string, unknown>);
    expect(JSON.stringify(a?.system)).toBe(JSON.stringify(b?.system));
    expect(JSON.stringify(a?.tools)).toBe(JSON.stringify(b?.tools));
    expect(a?.messages).not.toEqual(b?.messages);
  });
});

describe("pose_question schema", () => {
  it("has no maxLength (unsupported in strict mode) and states the limit in the description", () => {
    const hat = POSE_QUESTION_TOOL.input_schema.properties.hat_line;
    expect(JSON.stringify(POSE_QUESTION_TOOL)).not.toMatch(/maxLength|minLength/);
    expect(hat.description).toMatch(/160/);
  });
});

describe("createAiQuizmaster verdict", () => {
  it("returns trimmed text from a tool-less call", async () => {
    const { qm, create, onUsage } = setup(vi.fn().mockResolvedValue(textResponse("  Ravenclaw it is.  ")));
    await expect(qm.verdict(STATS, "RAVENCLAW")).resolves.toBe("Ravenclaw it is.");
    const [params, options] = create.mock.calls[0] as [Record<string, unknown>, unknown];
    expect(params).toMatchObject({
      model: "claude-haiku-5-5",
      max_tokens: 300,
      output_config: { effort: "low" },
    });
    expect(params.system).toBe(VERDICT_SYSTEM_PROMPT);
    expect(params.tools).toBeUndefined();
    expect(options).toEqual({ timeout: 6000, maxRetries: 0 });
    expect(onUsage).toHaveBeenCalledWith(70);
  });

  it("throws on empty text, wrong stop_reason, or SDK failure", async () => {
    for (const create of [
      vi.fn().mockResolvedValue(textResponse("   ")),
      vi.fn().mockResolvedValue(textResponse("fine", "refusal")),
      vi.fn().mockResolvedValue(textResponse("cut off", "max_tokens")),
      vi.fn().mockRejectedValue(new Error("boom")),
    ]) {
      const { qm } = setup(create);
      await expect(qm.verdict(STATS, "GRYFFINDOR")).rejects.toBeInstanceOf(AiQuizmasterError);
    }
  });
});
