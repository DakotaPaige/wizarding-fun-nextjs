import type { HouseName } from "@/data/types";
import { getHouseInfo } from "@/data/curated/houses";

/** The shield outline shared by the emblem and the fallback portrait card. */
export const SHIELD_PATH = "M4 3h32v19c0 11-8 18-16 21C12 40 4 33 4 22z";
const VIEWBOX_WIDTH = 40;
const VIEWBOX_HEIGHT = 46;

interface HouseEmblemProps {
  house: HouseName;
  /** Rendered width in px; height follows the shield's aspect ratio. */
  size: number;
}

/**
 * The site's original house emblem (no official crests): a shield outlined in the
 * house accent with the house initial. Decorative, so it's hidden from assistive tech;
 * whatever it sits beside must carry the house name.
 */
export function HouseEmblem({ house, size }: HouseEmblemProps) {
  const { accent, displayName } = getHouseInfo(house);
  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      width={size}
      height={(size * VIEWBOX_HEIGHT) / VIEWBOX_WIDTH}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={SHIELD_PATH}
        fill={accent}
        fillOpacity={0.16}
        stroke={accent}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <text
        x={VIEWBOX_WIDTH / 2}
        y={22}
        textAnchor="middle"
        dominantBaseline="central"
        fill={accent}
        fontSize={18}
        fontWeight={700}
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        {displayName.charAt(0)}
      </text>
    </svg>
  );
}
