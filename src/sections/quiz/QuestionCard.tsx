import { Art } from "@/components/Art";
import type { ArtSlot } from "@/data/art-manifest";
import type { Question, Topic } from "@/quiz/types";
import styles from "./quiz.module.css";

const TOPIC_LABEL: Record<Topic, string> = {
  wand: "Wand",
  patronus: "Patronus",
  spell: "Spell",
  actor: "Actor",
  house: "House",
  portrait: "Portrait",
};

interface QuestionCardProps {
  question: Question;
  dared: boolean;
  /** Set once the player has answered; the options lock and the outcome shows. */
  chosenOptionId: string | null;
  isLast: boolean;
  onAnswer(optionId: string): void;
  onNext(): void;
}

function feedbackFor(question: Question, chosenOptionId: string, dared: boolean): string {
  if (chosenOptionId === question.correctOptionId) return dared ? "Correct! +2 points." : "Correct! +1 point.";
  const answer = question.options.find((o) => o.id === question.correctOptionId)?.label;
  return `Not quite. The answer was ${answer}.`;
}

/**
 * One question with four options. Once answered, the correct option and the player's own are
 * labelled with text (not only colour) and the outcome is announced in a polite live region.
 */
export function QuestionCard({ question, dared, chosenOptionId, isLast, onAnswer, onNext }: QuestionCardProps) {
  const answered = chosenOptionId !== null;
  return (
    <div className={styles.card}>
      <p className={styles.kicker}>
        {TOPIC_LABEL[question.topic]} question · {dared ? "Daring · 2 pts" : "Safe · 1 pt"}
      </p>
      <h3 className={styles.prompt} tabIndex={-1} data-autofocus={answered ? undefined : true}>
        {question.prompt}
      </h3>
      {question.artSlot && (
        <div className={styles.questionArt}>
          <Art slot={question.artSlot as ArtSlot} fallback={null} sizes="240px" />
        </div>
      )}

      <ul className={styles.options} aria-label="Answers">
        {question.options.map((option) => {
          const correct = answered && option.id === question.correctOptionId;
          const chosen = answered && option.id === chosenOptionId;
          const tag = correct ? "Correct" : chosen ? "Your answer" : null;
          return (
            <li key={option.id}>
              <button
                type="button"
                className={styles.option}
                data-outcome={correct ? "correct" : chosen ? "wrong" : undefined}
                disabled={answered}
                onClick={() => onAnswer(option.id)}
              >
                <span>{option.label}</span>
                {tag && (
                  <span className={styles.optionTag}>
                    <span className={styles.srOnly}>, </span>
                    {tag}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className={styles.answerFooter}>
        <p className={styles.feedback} aria-live="polite">
          {answered ? feedbackFor(question, chosenOptionId, dared) : ""}
        </p>
        {answered && (
          <button type="button" className={styles.primary} onClick={onNext} data-autofocus>
            {isLast ? "Hear the Hat's verdict" : "Next question"} <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </div>
  );
}
