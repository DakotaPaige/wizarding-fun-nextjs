import type { BudgetGuard } from "@/quiz/budget/budget-guard";
import { hashIp } from "@/quiz/budget/hash-ip";
import type { QuizConfig } from "@/quiz/config";
import type { GameState, Quizmaster } from "@/quiz/types";

/**
 * Picks who runs this request. Classic is the safe default: anything missing, exhausted or failing
 * (including the budget store being down) resolves to classic rather than an error.
 */
export async function selectQuizmaster(args: {
  state: GameState;
  ip: string | null;
  now: Date;
  config: QuizConfig;
  guard: BudgetGuard | null;
  makeAi: () => Quizmaster;
  classic: Quizmaster;
}): Promise<Quizmaster> {
  const { state, ip, now, config, guard, makeAi, classic } = args;
  if (state.mode === "classic") return classic;
  if (!config.apiKey || !guard || !ip || !config.ipSalt) return classic;
  try {
    // A game is counted once, when it starts; later turns and the verdict only check the budget.
    if (state.turns.length === 0 && !(await guard.tryStartGame(hashIp(ip, config.ipSalt), now))) return classic;
    if (!(await guard.hasBudget(now))) return classic;
    return makeAi();
  } catch {
    return classic;
  }
}
