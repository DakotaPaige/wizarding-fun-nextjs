"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import type { QuizMode } from "@/quiz/types";
import { DareStep } from "./DareStep";
import { HatVoice } from "./HatVoice";
import { QuestionCard } from "./QuestionCard";
import { fetchQuizTurn, fetchQuizVerdict, type FetchTurn, type FetchVerdict } from "./quiz.graphql";
import { Result } from "./Result";
import { ROUND_LENGTH, useQuizGame, type QuizPhase } from "./useQuizGame";
import styles from "./quiz.module.css";

export const SORTING_CEREMONY_ID = "sorting-ceremony";
const TITLE_ID = `${SORTING_CEREMONY_ID}-title`;

const BADGE: Record<QuizMode, string> = {
  ai: "The Hat is awake · AI quizmaster",
  classic: "The Hat is resting · classic mode",
};

export const ERROR_COPY = "The Hat lost its train of thought — try again";

interface QuizProps {
  /** Injectable for tests; the page uses the GraphQL mutations. */
  fetchTurn?: FetchTurn;
  fetchVerdict?: FetchVerdict;
}

/**
 * The Sorting Ceremony (spec §4.4): ten dare-then-answer questions from the Hat, then its
 * verdict. The mode badge appears with the first response and follows the server silently
 * (classic is a fallback, not an error);
 * only a failed request shows an error, with a Retry that keeps the game.
 *
 * Each step's main element carries `data-autofocus`; when the step changes, focus moves there
 * so keyboard and screen-reader users follow the round without hunting for it.
 */
export function Quiz({ fetchTurn = fetchQuizTurn, fetchVerdict = fetchQuizVerdict }: QuizProps) {
  const root = useRef<HTMLElement>(null);
  const game = useQuizGame({ fetchTurn, fetchVerdict });
  const { phase } = game;

  const lastPhase = useRef<QuizPhase>(phase);
  useEffect(() => {
    if (lastPhase.current === phase) return;
    lastPhase.current = phase;
    root.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, [phase]);

  const answered = phase === "answered";
  const progress = (game.state.turns.length / ROUND_LENGTH);

  return (
    <section ref={root} id={SORTING_CEREMONY_ID} aria-labelledby={TITLE_ID} className={styles.section}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div className={styles.headings}>
            <p className={styles.eyebrow}>Chapter III · The Sorting Ceremony</p>
            <h2 id={TITLE_ID} className={styles.title}>
              Let the Hat test you
            </h2>
          </div>
          {game.reportedMode ? (
            <p className={styles.badge} data-mode={game.reportedMode}>
              {BADGE[game.reportedMode]}
            </p>
          ) : (
            // Holds the badge's place until the server says which mode it runs in.
            <span className={styles.badge} data-mode="pending" aria-hidden="true" />
          )}
        </header>

        {phase === "result" && game.result ? (
          <Result result={game.result} turns={game.state.turns} onPlayAgain={game.restart} />
        ) : (
          <>
            <div className={styles.progress}>
              <span>
                Question {game.questionNumber} of {ROUND_LENGTH}
              </span>
              <span className={styles.progressTrack} aria-hidden="true">
                <span className={styles.progressFill} style={{ "--progress": progress } as CSSProperties} />
              </span>
              <span>Score {game.score}</span>
            </div>

            <div className={styles.layout}>
              <HatVoice line={game.hatLine} lineId={game.hatLineId} />

              <div className={styles.play}>
                {phase === "intro" && (
                  <div className={styles.card}>
                    <h3 className={styles.cardTitle}>Ten questions stand between you and your house</h3>
                    <p className={styles.cardText}>
                      Before each one, choose: play it safe for a normal question worth 1 point, or dare a harder
                      one worth 2. The Hat is watching how you play, not only what you know.
                    </p>
                    <button type="button" className={styles.primary} onClick={game.start} data-autofocus>
                      Put on the Hat
                    </button>
                  </div>
                )}

                {phase === "dare" && <DareStep onChoose={game.choose} />}

                {(phase === "loading" || phase === "verdict-loading") && (
                  <div className={`${styles.card} ${styles.waiting}`} role="status" tabIndex={-1} data-autofocus>
                    {phase === "loading" ? "The Hat is thinking" : "The Hat is deciding"}
                    <span className={styles.dots} aria-hidden="true">
                      …
                    </span>
                  </div>
                )}

                {(phase === "question" || answered) && game.question && (
                  <QuestionCard
                    key={game.question.id}
                    question={game.question}
                    dared={game.dared}
                    chosenOptionId={game.chosenOptionId}
                    isLast={game.state.turns.length === ROUND_LENGTH}
                    onAnswer={game.answer}
                    onNext={game.next}
                  />
                )}

                {phase === "error" && (
                  <div className={`${styles.card} ${styles.error}`}>
                    <p className={styles.cardText} role="alert">
                      {ERROR_COPY}
                    </p>
                    <button type="button" className={styles.primary} onClick={game.retry} data-autofocus>
                      Retry
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
