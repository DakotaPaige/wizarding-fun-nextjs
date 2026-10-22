export interface ArtAsset {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export type ArtSlot =
  | "intro.sky"
  | "intro.stars"
  | "intro.moon"
  | "intro.castle"
  | "intro.clouds"
  | "spell.wand"
  | "spell.patronusStag"
  | "quiz.hat"
  | `portrait.${string}`;

/**
 * The only source of imagery in the site. Empty by design: no copyrighted art is shipped,
 * so every slot falls back to its generated/CSS placeholder until an asset is registered here.
 */
export const ART: Partial<Record<ArtSlot, ArtAsset>> = {};

export function getArt(slot: ArtSlot): ArtAsset | null {
  return ART[slot] ?? null;
}
