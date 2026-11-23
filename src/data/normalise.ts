import type { RawCharacter, RawSpell } from "@/data/hp-api/schemas";
import type { CharacterRecord, HouseName, SpellRecord, Wand } from "@/data/types";

const HOUSES: readonly HouseName[] = ["GRYFFINDOR", "SLYTHERIN", "RAVENCLAW", "HUFFLEPUFF"];

function textOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normaliseHouse(value: string | null | undefined): HouseName | null {
  const upper = textOrNull(value)?.toUpperCase();
  return HOUSES.find((house) => house === upper) ?? null;
}

/** HP-API dates are "d-m-yyyy" (day and month sometimes unpadded). Returns ISO yyyy-mm-dd. */
function normaliseDate(value: string | null | undefined): string | null {
  const match = textOrNull(value)?.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month!.padStart(2, "0")}-${day!.padStart(2, "0")}`;
}

function normaliseWand(wand: RawCharacter["wand"]): Wand | null {
  if (!wand) return null;
  const normalised: Wand = {
    wood: textOrNull(wand.wood),
    core: textOrNull(wand.core),
    lengthInches: wand.length ?? null,
  };
  const isEmpty =
    normalised.wood === null && normalised.core === null && normalised.lengthInches === null;
  return isEmpty ? null : normalised;
}

export function normaliseCharacter(raw: RawCharacter): CharacterRecord {
  return {
    id: raw.id,
    name: raw.name,
    alternateNames: raw.alternate_names ?? [],
    house: normaliseHouse(raw.house),
    ancestry: textOrNull(raw.ancestry),
    patronus: textOrNull(raw.patronus),
    actor: textOrNull(raw.actor),
    dateOfBirth: normaliseDate(raw.dateOfBirth),
    alive: raw.alive ?? true,
    eyeColour: textOrNull(raw.eyeColour),
    hairColour: textOrNull(raw.hairColour),
    wand: normaliseWand(raw.wand),
  };
}

export function normaliseSpell(raw: RawSpell): SpellRecord {
  return { id: raw.id, name: raw.name, description: textOrNull(raw.description) ?? "" };
}
