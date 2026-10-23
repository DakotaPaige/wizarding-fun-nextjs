import type { PageDataQuery } from "@/graphql/generated/graphql";
import styles from "../placeholder.module.css";

interface SpellsSectionProps {
  spells: PageDataQuery["spells"];
}

/** Placeholder: the Classroom (spell stage) replaces this. */
export function SpellsSection({ spells }: SpellsSectionProps) {
  return (
    <section id="classroom" aria-labelledby="classroom-title" className={styles.section}>
      <h2 id="classroom-title" className={styles.heading}>
        The Classroom
      </h2>
      <ul className={styles.list}>
        {spells.map((spell) => (
          <li key={spell.id}>{spell.name}</li>
        ))}
      </ul>
    </section>
  );
}
