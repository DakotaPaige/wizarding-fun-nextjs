import type { PageDataQuery } from "@/graphql/generated/graphql";
import styles from "../placeholder.module.css";

interface CharactersSectionProps {
  houses: PageDataQuery["houses"];
}

/** Placeholder: the Great Hall (house tabs and roster) replaces this. */
export function CharactersSection({ houses }: CharactersSectionProps) {
  return (
    <section id="great-hall" aria-labelledby="great-hall-title" className={styles.section}>
      <h2 id="great-hall-title" className={styles.heading}>
        The Great Hall
      </h2>
      <ul className={styles.list}>
        {houses.map((house) => (
          <li key={house.name}>
            {house.displayName} · {house.members.length} members
          </li>
        ))}
      </ul>
    </section>
  );
}
