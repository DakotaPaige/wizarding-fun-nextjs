import styles from "./quiz.module.css";

interface DareStepProps {
  onChoose(dared: boolean): void;
}

/** Before every question: a normal question for 1 point, or a harder one for 2. */
export function DareStep({ onChoose }: DareStepProps) {
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle} tabIndex={-1} data-autofocus>
        How brave are you feeling?
      </h3>
      <div className={styles.dareChoices}>
        <button type="button" className={styles.dare} onClick={() => onChoose(false)}>
          <span className={styles.dareName}>Play it safe</span>
          <span className={styles.dareDetail}>Normal question · 1 point</span>
        </button>
        <button type="button" className={`${styles.dare} ${styles.dareBold}`} onClick={() => onChoose(true)}>
          <span className={styles.dareName}>Dare</span>
          <span className={styles.dareDetail}>Harder question · 2 points</span>
        </button>
      </div>
    </div>
  );
}
