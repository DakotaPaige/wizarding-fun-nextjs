import type { BudgetGuard } from "@/quiz/budget/budget-guard";
import { hashIp } from "@/quiz/budget/hash-ip";
import type { QuizConfig } from "@/quiz/config";
import { aiTimeoutFor } from "@/quiz/time-budget";
import type { GameState, Quizmaster } from "@/quiz/types";

/**
 * Picks who runs this request. Classic is the safe default: anything missing, exhausted or failing
 * (including the budget store being down) resolves to classic rather than an error.
 *
 * The AI is chosen only when every layer agrees, checked in this order:
 * 1. enough request time is left for an AI call (no Redis traffic otherwise);
 * 2. the game is allowed: turn 0 counts it against the per-IP limit, and every later turn and the
 *    verdict require the marker that turn 0 wrote (a client cannot skip turn 0 with made-up state);
 * 3. the game has AI calls left (10 turns + verdict);
 * 4. a token reservation fits in today's budget. The AI quizmaster settles it after its call.
 */
export async function selectQuizmaster(args: {
  state: GameState;
  ip: string | null;
  now: Date;
  /** Time already spent on this request (data load etc.), which shortens the AI timeout. */
  elapsedMs: number;
  config: QuizConfig;
  guard: BudgetGuard | null;
  makeAi: (opts: { timeoutMs: number }) => Quizmaster;
  classic: Quizmaster;
}): Promise<Quizmaster> {
  const { state, ip, now, elapsedMs, config, guard, makeAi, classic } = args;
  if (state.mode === "classic") return classic;
  if (!config.apiKey || !guard || !ip || !config.ipSalt) return classic;
  const timeoutMs = aiTimeoutFor(elapsedMs);
  if (timeoutMs === null) return classic;
  try {
    const ipHash = hashIp(ip, config.ipSalt);
    // A retried first turn counts the same seed again, which the guard ignores.
    const allowed =
      state.turns.length === 0
        ? await guard.tryStartGame(ipHash, now, state.seed)
        : await guard.isGameAllowed(ipHash, now, state.seed);
    if (!allowed) return classic;
    if (!(await guard.tryCountAiCall(ipHash, now, state.seed))) return classic;
    if (!(await guard.reserveTokens(now))) return classic;
    return makeAi({ timeoutMs });
  } catch {
    return classic;
  }
}
