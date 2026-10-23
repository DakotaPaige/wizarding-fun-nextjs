export const QUIZ_MODELS = ["claude-haiku-5-5", "claude-opus-5-5"] as const;
export type QuizModel = (typeof QUIZ_MODELS)[number];

export interface QuizConfig {
  apiKey: string | null;
  model: QuizModel;
  dailyTokenBudget: number;
  gamesPerIpPerDay: number;
  ipSalt: string | null;
}

const DEFAULT_MODEL: QuizModel = "claude-haiku-5-5";
const DEFAULT_DAILY_TOKEN_BUDGET = 200_000;
const DEFAULT_GAMES_PER_IP_PER_DAY = 3;

function text(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function positiveNumber(value: string | undefined, fallback: number): number {
  const raw = text(value);
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Quiz settings from env. Every variable is optional; bad or missing values fall back, nothing throws. */
export function readQuizConfig(env: Record<string, string | undefined> = process.env): QuizConfig {
  const model = text(env.QUIZ_MODEL);
  return {
    apiKey: text(env.ANTHROPIC_API_KEY),
    model: QUIZ_MODELS.find((m) => m === model) ?? DEFAULT_MODEL,
    dailyTokenBudget: positiveNumber(env.AI_DAILY_TOKEN_BUDGET, DEFAULT_DAILY_TOKEN_BUDGET),
    gamesPerIpPerDay: positiveNumber(env.AI_GAMES_PER_IP_PER_DAY, DEFAULT_GAMES_PER_IP_PER_DAY),
    ipSalt: text(env.IP_HASH_SALT),
  };
}
