import type { PotterCharacter, PotterSpell } from "@/data/potterdb/schemas";
import type { CharacterRecord, HouseName, SpellRecord, Wand } from "@/data/types";

const HOUSES: readonly HouseName[] = ["GRYFFINDOR", "SLYTHERIN", "RAVENCLAW", "HUFFLEPUFF"];

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const FRACTIONS: Record<string, number> = { "¼": 0.25, "½": 0.5, "¾": 0.75 };

function textOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function stripTrailingParentheticals(text: string): string {
  return text.replace(/(\s*\([^()]*\))+\s*$/, "").trim();
}

function knownPart(part: string | undefined): string | null {
  const text = textOrNull(part);
  return text && !/^(unknown|wood|length|core|and core)\b/i.test(text) ? text : null;
}

function parseLength(part: string | undefined): number | null {
  const text = knownPart(part);
  const match = text?.match(/^(\d+(?:\.\d+)?)?\s*([¼½¾])?\s*['"′″]?$/);
  if (!match || (match[1] === undefined && match[2] === undefined)) return null;
  return Number(match[1] ?? 0) + (match[2] ? FRACTIONS[match[2]]! : 0);
}

/** The core is the third part only; PotterDB appends notes ("core", ", quite rigid") or wand lists. */
function parseCore(part: string | undefined): string | null {
  const text = knownPart(part)?.replace(/\s+core$/i, "");
  if (!text || /\d|^(and unknown|previously)\b/i.test(text)) return null;
  return text.toLowerCase();
}

/** Parses "11', Holly, phoenix feather". Unknown parts become null; all unknown gives null. */
export function parseWand(text: string): Wand | null {
  const parts = stripTrailingParentheticals(text).split(",");
  if (parts.length < 3) return null;
  const [length, wood, core] = parts;
  const wand: Wand = {
    wood: knownPart(wood)?.toLowerCase() ?? null,
    core: parseCore(core),
    lengthInches: parseLength(length),
  };
  return wand.wood === null && wand.core === null && wand.lengthInches === null ? null : wand;
}

/** PotterDB `born` starts "D Month YYYY, place". Returns ISO yyyy-mm-dd, or null if it doesn't. */
export function parseBorn(text: string | null): string | null {
  const match = text?.trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b/);
  if (!match) return null;
  const [, day, monthName, year] = match;
  const month = MONTHS.indexOf(monthName!.toLowerCase()) + 1;
  if (month === 0) return null;
  return `${year}-${String(month).padStart(2, "0")}-${day!.padStart(2, "0")}`;
}

/** Featured display name, else the PotterDB name with any parenthetical removed. */
export function displayName(
  slug: string,
  apiName: string,
  featured: Readonly<Record<string, string>>,
): string {
  if (Object.hasOwn(featured, slug)) return featured[slug]!;
  return apiName.replace(/\s*\([^()]*\)/g, "").trim() || apiName;
}

function normaliseHouse(value: string | null | undefined): HouseName | null {
  const upper = textOrNull(value)?.toUpperCase();
  return HOUSES.find((house) => house === upper) ?? null;
}

function firstPermanentWand(wands: readonly string[]): Wand | null {
  for (const entry of wands) {
    if (/\(temporarily\)/i.test(entry)) continue;
    const wand = parseWand(entry);
    if (wand) return wand;
  }
  return null;
}

export function toCharacterRecord(
  item: PotterCharacter,
  featured: Readonly<Record<string, string>>,
): CharacterRecord {
  const a = item.attributes;
  return {
    id: a.slug,
    name: displayName(a.slug, a.name, featured),
    alternateNames: a.alias_names ?? [],
    house: normaliseHouse(a.house),
    ancestry: textOrNull(a.blood_status),
    patronus: textOrNull(a.patronus)?.toLowerCase() ?? null,
    actor: null,
    dateOfBirth: parseBorn(a.born ?? null),
    alive: a.died == null,
    eyeColour: textOrNull(a.eye_color),
    hairColour: textOrNull(a.hair_color),
    wand: firstPermanentWand(a.wands ?? []),
  };
}

/** Spells without an effect are dropped (null). */
export function toSpellRecord(item: PotterSpell): SpellRecord | null {
  const a = item.attributes;
  const description = textOrNull(a.effect);
  if (!description) return null;
  const incantation = textOrNull(a.incantation?.replace(/\s*\([^()]*\)\s*$/, ""));
  return { id: a.slug, name: incantation ?? a.name, description };
}
