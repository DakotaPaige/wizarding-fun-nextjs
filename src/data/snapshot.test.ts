import { describe, expect, it } from "vitest";
import { z } from "zod";
import { FEATURED, WAND_OVERRIDES } from "@/data/curated/featured";
import { ROSTER } from "@/data/curated/roster";
import { CURATED_SPELLS } from "@/data/curated/spells";
import { SpellRecordSchema } from "@/data/schemas";
import characters from "@/data/snapshot/characters.json";
import spells from "@/data/snapshot/spells.json";

const records = characters as Array<{
  id: string;
  name: string;
  alternateNames: string[];
  patronus: string | null;
  wand: unknown;
  [key: string]: unknown;
}>;
const spellRecords = spells as Array<{ id: string; name: string; description: string }>;

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("committed snapshot", () => {
  const ids = new Set(records.map((record) => record.id));

  it("contains every featured character, named as featured", () => {
    for (const [slug, name] of Object.entries(FEATURED)) {
      expect(ids.has(slug), `featured slug missing from snapshot: ${slug}`).toBe(true);
      expect(records.find((record) => record.id === slug)?.name).toBe(name);
    }
  });

  it("contains every roster member under the house they are listed in", () => {
    for (const [house, slugs] of Object.entries(ROSTER)) {
      for (const slug of slugs) {
        const record = records.find((r) => r.id === slug);
        expect(record, `roster slug missing from snapshot: ${slug}`).toBeDefined();
        expect(record?.house, `roster slug in the wrong house: ${slug}`).toBe(house);
      }
    }
  });

  it("contains every curated spell slug", () => {
    const spellIds = new Set((spells as Array<{ id: string }>).map((spell) => spell.id));
    for (const { slug } of CURATED_SPELLS) {
      expect(spellIds.has(slug), `curated spell slug missing from snapshot: ${slug}`).toBe(true);
    }
  });

  it("has no parenthetical in any character or spell name", () => {
    expect(records.filter((record) => record.name.includes("(")).map((r) => r.id)).toEqual([]);
    expect(spellRecords.filter((spell) => spell.name.includes("(")).map((s) => s.id)).toEqual([]);
  });

  it("names every spell by a clean incantation or its name, never a placeholder", () => {
    const bad = spellRecords.filter((spell) => /[(:]/.test(spell.name) || /^(unknown|none)$/i.test(spell.name));
    expect(bad.map((s) => `${s.id}: ${s.name}`)).toEqual([]);
  });

  it("has at least 35 patronuses, each a single creature a quiz prompt can name", () => {
    // PotterDB lists 38 once guesses, lists and placeholders are dropped.
    const patronuses = records.flatMap((record) => (record.patronus === null ? [] : [record.patronus]));
    expect(patronuses.length).toBeGreaterThanOrEqual(35);
    const rejected = patronuses.filter(
      (p) =>
        !/^[a-z][a-z' -]*$/.test(p) ||
        p.includes("corporeal") ||
        / or /.test(p) ||
        /^(none|unknown|either|something)\b/.test(p) ||
        p === "bird",
    );
    expect(rejected).toEqual([]);
  });

  it("keeps aliases short: no notes, no repeat of the name, at most five", () => {
    const bad = records.filter(
      (record) =>
        record.alternateNames.length > 5 ||
        record.alternateNames.some(
          (alias) => alias.includes("(") || alias.toLowerCase() === record.name.toLowerCase(),
        ),
    );
    expect(bad.map((r) => `${r.id}: ${r.alternateNames.join(" | ")}`)).toEqual([]);
  });

  it("applies the wand overrides, giving Ron his own willow wand", () => {
    expect(WAND_OVERRIDES["ronald-weasley"]).toEqual({ wood: "willow", core: "unicorn hair", lengthInches: 14 });
    for (const [slug, wand] of Object.entries(WAND_OVERRIDES)) {
      expect(records.find((record) => record.id === slug)?.wand, slug).toEqual(wand);
    }
  });

  it("describes every curated spell in the present tense", () => {
    for (const curated of CURATED_SPELLS) {
      const shown =
        curated.descriptionOverride ?? spellRecords.find((spell) => spell.id === curated.slug)?.description ?? "";
      expect(shown, curated.slug).not.toMatch(/^\w+ed /i);
    }
  });

  it("stores no URLs", () => {
    const urls = strings([characters, spells]).filter((text) => /https?:\/\//i.test(text));
    expect(urls).toEqual([]);
  });

  it("has slug ids and descriptions for every spell", () => {
    const Spell = SpellRecordSchema.refine((spell) => spell.description.trim().length > 0);
    expect(z.array(Spell).min(50).safeParse(spells).success).toBe(true);
  });
});
