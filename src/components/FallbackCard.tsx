import type { CSSProperties } from "react";
import type { HouseName } from "@/data/types";
import { getHouseInfo } from "@/data/curated/houses";
import { SHIELD_PATH } from "@/components/HouseEmblem";
import styles from "./FallbackCard.module.css";

interface FallbackCardProps {
  name: string;
  initials: string;
  house: HouseName | null;
}

/** Stand-in portrait for characters without art: a shield silhouette with their initials. */
export function FallbackCard({ name, initials, house }: FallbackCardProps) {
  const accent = house ? getHouseInfo(house).accent : "var(--gold)";
  return (
    <div role="img" aria-label={name} className={styles.card} style={{ "--card-accent": accent } as CSSProperties}>
      <svg className={styles.shield} viewBox="0 0 40 46" aria-hidden="true" focusable="false">
        <path d={SHIELD_PATH} />
      </svg>
      <span className={styles.initials} aria-hidden="true">
        {initials}
      </span>
    </div>
  );
}
