import { Art } from "@/components/Art";
import { FallbackCard } from "@/components/FallbackCard";
import type { PageDataQuery } from "@/graphql/generated/graphql";
import styles from "./characters.module.css";

export type GreatHallCharacter = PageDataQuery["houses"][number]["members"][number];

interface CharacterCardProps {
  character: GreatHallCharacter;
  onOpen(character: GreatHallCharacter): void;
}

/**
 * One roster card: the portrait (from the art manifest, else the shield-and-initials fallback),
 * the name and the actor. The whole card is the button that opens the character; its
 * `data-flip-id` lets the detail panel grow out of it.
 */
export function CharacterCard({ character, onOpen }: CharacterCardProps) {
  const fallback = <FallbackCard name={character.name} initials={character.initials} house={character.house} />;
  return (
    <button
      type="button"
      className={styles.card}
      data-flip-id={character.id}
      onClick={() => onOpen(character)}
    >
      {/* The name below labels the button, so the portrait stays out of the accessible name. */}
      <span className={styles.portrait} aria-hidden="true">
        {character.portrait ? (
          <Art slot={`portrait.${character.id}`} sizes="(min-width: 640px) 200px, 45vw" fallback={fallback} />
        ) : (
          fallback
        )}
      </span>
      <span className={styles.cardText}>
        <span className={styles.cardName}>{character.name}</span>
        {character.actor && <span className={styles.cardActor}>{character.actor}</span>}
      </span>
    </button>
  );
}
