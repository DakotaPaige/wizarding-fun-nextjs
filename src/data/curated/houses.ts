import type { HouseName } from "@/data/types";

export interface HouseInfo {
  name: HouseName;
  displayName: string;
  traits: string[];
  accent: string;
  accent2: string;
  palette: string;
}

/** The four houses in display order. */
export const HOUSES: readonly HouseInfo[] = [
  {
    name: "GRYFFINDOR",
    displayName: "Gryffindor",
    traits: ["Bravery", "daring", "nerve", "chivalry"],
    accent: "#C8423A",
    accent2: "#D4A24C",
    palette: "scarlet & gold",
  },
  {
    name: "SLYTHERIN",
    displayName: "Slytherin",
    traits: ["Ambition", "cunning", "leadership", "resourcefulness"],
    accent: "#2E8B57",
    accent2: "#B8BEC6",
    palette: "green & silver",
  },
  {
    name: "RAVENCLAW",
    displayName: "Ravenclaw",
    traits: ["Intelligence", "wit", "learning", "creativity"],
    accent: "#4A78C2",
    accent2: "#B08D57",
    palette: "blue & bronze",
  },
  {
    name: "HUFFLEPUFF",
    displayName: "Hufflepuff",
    traits: ["Hard work", "patience", "loyalty", "fairness"],
    accent: "#E0B341",
    accent2: "#6B5A3A",
    palette: "yellow & black",
  },
];

const HOUSES_BY_NAME = new Map(HOUSES.map((house) => [house.name, house]));

/** Curated info (accents, traits) for a house. Every `HouseName` has an entry. */
export function getHouseInfo(name: HouseName): HouseInfo {
  const info = HOUSES_BY_NAME.get(name);
  if (!info) throw new Error(`No curated info for house ${name}`);
  return info;
}
