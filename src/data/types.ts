export type HouseName = "GRYFFINDOR" | "SLYTHERIN" | "RAVENCLAW" | "HUFFLEPUFF";

export interface Wand {
  wood: string | null;
  core: string | null;
  lengthInches: number | null;
}

export interface CharacterRecord {
  id: string;
  name: string;
  alternateNames: string[];
  house: HouseName | null;
  ancestry: string | null;
  patronus: string | null;
  actor: string | null;
  /** ISO date (yyyy-mm-dd) when known. */
  dateOfBirth: string | null;
  alive: boolean;
  eyeColour: string | null;
  hairColour: string | null;
  wand: Wand | null;
}

export interface SpellRecord {
  id: string;
  name: string;
  description: string;
}

export interface WizardingData {
  characters: CharacterRecord[];
  spells: SpellRecord[];
  source: "live" | "snapshot";
}
