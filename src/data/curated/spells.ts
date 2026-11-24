export type SpellEffectKey =
  | "lumos"
  | "leviosa"
  | "incendio"
  | "expelliarmus"
  | "stupefy"
  | "protego"
  | "accio"
  | "alohomora"
  | "reparo"
  | "patronus";

export interface CuratedSpell {
  /** The spell's PotterDB slug, which is its id in the snapshot. */
  slug: string;
  colour: string;
  effect: SpellEffectKey;
  descriptionOverride?: string;
}

/** The spells featured on the Spells board, in display order. */
export const CURATED_SPELLS: readonly CuratedSpell[] = [
  { slug: "wand-lighting-charm", colour: "#FFF1C1", effect: "lumos" },
  { slug: "levitation-charm", colour: "#C9B8FF", effect: "leviosa" },
  { slug: "fire-making-spell", colour: "#FF8A3D", effect: "incendio" },
  { slug: "disarming-charm", colour: "#FF5C5C", effect: "expelliarmus" },
  { slug: "stunning-spell", colour: "#E5484D", effect: "stupefy" },
  { slug: "shield-charm", colour: "#6CB6FF", effect: "protego" },
  { slug: "summoning-charm", colour: "#4FD1C5", effect: "accio" },
  { slug: "unlocking-charm", colour: "#F5C451", effect: "alohomora" },
  { slug: "mending-charm", colour: "#7EE081", effect: "reparo" },
  {
    slug: "patronus-charm",
    colour: "#DDE6F0",
    effect: "patronus",
    descriptionOverride:
      "The Patronus Charm conjures a guardian of hope and happiness that drives away Dementors.",
  },
];
