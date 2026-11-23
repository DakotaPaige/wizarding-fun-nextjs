import type { Wand } from "@/data/types";
import { formatWand } from "./format";
import { woodTone } from "./wand-woods";
import styles from "./wand.module.css";

/** The track runs from 0 to this many inches; longer wands are clamped to the end. */
const TRACK_INCHES = 15;
const TICKS = [0, 5, 10, 15];
/** SVG user units per inch, so the viewBox is 150 wide and a wand's width is its length × 10. */
const UNITS_PER_INCH = 10;
const TRACK_WIDTH = TRACK_INCHES * UNITS_PER_INCH;
const HEIGHT = 22;
/** Wand centre line, handle thickness and tip thickness (units). */
const MID = 9;
const HANDLE = 4.5;
const TIP = 1.5;

/** A tapered wand from the origin to `length`: a thick rounded handle narrowing to a fine tip. */
function wandPath(length: number): string {
  return [
    `M0 ${MID - HANDLE}`,
    `L${length - TIP} ${MID - TIP}`,
    `Q${length} ${MID} ${length - TIP} ${MID + TIP}`,
    `L0 ${MID + HANDLE}`,
    `Q${-HANDLE / 2} ${MID} 0 ${MID - HANDLE}`,
    "Z",
  ].join(" ");
}

/**
 * A character's wand drawn to scale on a 0–15 in track, tinted by its wood, with a soft streak for
 * the core. The visible label stays the text line above it, so this is a labelled image only; with
 * no recorded length there is nothing to draw and it renders nothing.
 */
export function WandIllustration({ wand }: { wand: Wand }) {
  if (wand.lengthInches === null) return null;
  const ratio = Math.min(Math.max(wand.lengthInches / TRACK_INCHES, 0), 1);
  const length = ratio * TRACK_WIDTH;

  return (
    <div className={styles.wand}>
      <svg
        role="img"
        aria-label={formatWand(wand)}
        data-ratio={ratio}
        viewBox={`${-HANDLE / 2} 0 ${TRACK_WIDTH + HANDLE / 2} ${HEIGHT}`}
        className={styles.drawing}
        focusable="false"
      >
        <path data-part="wood" d={wandPath(length)} fill={woodTone(wand.wood)} />
        <line
          data-part="core"
          className={styles.core}
          x1={HANDLE / 2}
          y1={MID}
          x2={Math.max(length - TIP * 2, HANDLE / 2)}
          y2={MID}
        />
        <line className={styles.baseline} x1={0} y1={HEIGHT - 1} x2={TRACK_WIDTH} y2={HEIGHT - 1} />
        {TICKS.map((inches) => (
          <line
            key={inches}
            className={styles.baseline}
            x1={inches * UNITS_PER_INCH}
            y1={HEIGHT - 4}
            x2={inches * UNITS_PER_INCH}
            y2={HEIGHT - 1}
          />
        ))}
      </svg>
      <div className={styles.scale} aria-hidden="true">
        <span>0 in</span>
        <span>5</span>
        <span>10</span>
        <span>15 in</span>
      </div>
    </div>
  );
}
