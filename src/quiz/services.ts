import Anthropic from "@anthropic-ai/sdk";
import { createAiQuizmaster } from "@/quiz/ai-quizmaster";
import { createBudgetGuard, getRedis, type BudgetGuard } from "@/quiz/budget/budget-guard";
import { createClassicQuizmaster } from "@/quiz/classic-quizmaster";
import { readQuizConfig, type QuizConfig } from "@/quiz/config";
import { availableTopics } from "@/quiz/generators/index";
import type { Quizmaster, QuizData } from "@/quiz/types";

/** Everything a quiz resolver needs from the outside world; tests inject fakes. */
export interface QuizServices {
  config: QuizConfig;
  guard: BudgetGuard | null;
  makeAi: () => Quizmaster;
  classic: Quizmaster;
  now: Date;
}

/** Builds the real services from env. Cheap and non-throwing when env is missing. */
export function createQuizServices(
  data: QuizData,
  env: Record<string, string | undefined> = process.env,
): QuizServices {
  const config = readQuizConfig(env);
  const topics = availableTopics(data);
  const classic = createClassicQuizmaster({ topics });
  const now = new Date();

  const redis = config.apiKey ? getRedis() : null;
  const guard = redis
    ? createBudgetGuard({
        redis,
        dailyTokenBudget: config.dailyTokenBudget,
        gamesPerIpPerDay: config.gamesPerIpPerDay,
      })
    : null;

  const apiKey = config.apiKey;
  const makeAi = (): Quizmaster => {
    if (!apiKey || !guard) return classic;
    return createAiQuizmaster({
      client: new Anthropic({ apiKey }),
      model: config.model,
      topics,
      onUsage: (tokens) => guard.recordUsage(tokens, now),
    });
  };

  return { config, guard, makeAi, classic, now };
}
