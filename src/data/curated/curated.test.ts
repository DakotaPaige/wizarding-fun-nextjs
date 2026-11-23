import { describe, expect, it } from "vitest";
import charactersSnapshot from "@/data/snapshot/characters.json";
import spellsSnapshot from "@/data/snapshot/spells.json";
import { RawCharacterSchema, RawSpellSchema } from "@/data/hp-api/schemas";
import { normaliseCharacter, normaliseSpell } from "@/data/normalise";
import type { HouseName } from "@/data/types";
import { getArt } from "@/data/art-manifest";
import { HOUSES } from "@/data/curated/houses";
import { ROSTER } from "@/data/curated/roster";
import { CURATED_SPELLS } from "@/data/curated/spells";

const characters = charactersSnapshot.map((raw) => normaliseCharacter(RawCharacterSchema.parse(raw)));
const spells = spellsSnapshot.map((raw) => normaliseSpell(RawSpellSchema.parse(raw)));
const charactersById = new Map(characters.map((character) => [character.id, character]));

const EXPECTED_ROSTER: Record<HouseName, string[]> = {
  GRYFFINDOR: [
    "Harry Potter",
    "Hermione Granger",
    "Ron Weasley",
    "Albus Dumbledore",
    "Minerva McGonagall",
    "Neville Longbottom",
  ],
  SLYTHERIN: [
    "Draco Malfoy",
    "Severus Snape",
    "Lord Voldemort",
    "Bellatrix Lestrange",
    "Horace Slughorn",
    "Lucius Malfoy",
  ],
  RAVENCLAW: [
    "Luna Lovegood",
    "Cho Chang",
    "Filius Flitwick",
    "Padma Patil",
    "Moaning Myrtle",
    "Xenophilius Lovegood",
  ],
  HUFFLEPUFF: [
    "Cedric Diggory",
    "Nymphadora Tonks",
    "Pomona Sprout",
    "Newt Scamander",
    "Hannah Abbott",
    "Ernie Macmillan",
  ],
};

describe("CURATED_SPELLS", () => {
  it("only references spells present in the snapshot (case-sensitive)", () => {
    const names = new Set(spells.map((spell) => spell.name));
    for (const spell of CURATED_SPELLS) expect(names.has(spell.apiName), spell.apiName).toBe(true);
  });

  it("has exactly 10 spells with 10 distinct effect keys", () => {
    expect(CURATED_SPELLS).toHaveLength(10);
    expect(new Set(CURATED_SPELLS.map((spell) => spell.effect)).size).toBe(10);
  });
});

describe("HOUSES", () => {
  it("lists the four houses in display order", () => {
    expect(HOUSES.map((house) => house.name)).toEqual([
      "GRYFFINDOR",
      "SLYTHERIN",
      "RAVENCLAW",
      "HUFFLEPUFF",
    ]);
  });
});

describe("ROSTER", () => {
  it("resolves to the expected names in order", () => {
    for (const house of Object.keys(EXPECTED_ROSTER) as HouseName[]) {
      const names = ROSTER[house].map((id) => charactersById.get(id)?.name);
      expect(names).toEqual(EXPECTED_ROSTER[house]);
    }
  });

  it("only contains snapshot characters belonging to the roster house", () => {
    for (const house of Object.keys(ROSTER) as HouseName[]) {
      for (const id of ROSTER[house]) {
        expect(charactersById.get(id)?.house, id).toBe(house);
      }
    }
  });
});

describe("getArt", () => {
  it("returns null for slots missing from the manifest", () => {
    expect(getArt("portrait.nope")).toBeNull();
  });
});
