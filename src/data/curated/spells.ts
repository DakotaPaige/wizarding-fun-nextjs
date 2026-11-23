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
  /** Spell name exactly as it appears in the HP-API data. */
  apiName: string;
  colour: string;
  effect: SpellEffectKey;
  descriptionOverride?: string;
}

/** The spells featured on the Spells board, in display order. */
export const CURATED_SPELLS: readonly CuratedSpell[] = [
  { apiName: "Lumos", colour: "#FFF1C1", effect: "lumos" },
  { apiName: "Wingardium Leviosa", colour: "#C9B8FF", effect: "leviosa" },
  { apiName: "Incendio", colour: "#FF8A3D", effect: "incendio" },
  { apiName: "Expelliarmus", colour: "#FF5C5C", effect: "expelliarmus" },
  { apiName: "Stupefy", colour: "#E5484D", effect: "stupefy" },
  { apiName: "Protego", colour: "#6CB6FF", effect: "protego" },
  { apiName: "Accio", colour: "#4FD1C5", effect: "accio" },
  { apiName: "Alohomora", colour: "#F5C451", effect: "alohomora" },
  { apiName: "Reparo", colour: "#7EE081", effect: "reparo" },
  {
    apiName: "Expecto patronum",
    colour: "#DDE6F0",
    effect: "patronus",
    descriptionOverride:
      "The Patronus Charm conjures a guardian of hope and happiness that drives away Dementors.",
  },
];
