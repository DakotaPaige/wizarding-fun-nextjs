import { describe, expect, it } from "vitest";
import { z } from "zod";
import { FEATURED } from "@/data/curated/featured";
import { ROSTER } from "@/data/curated/roster";
import { CURATED_SPELLS } from "@/data/curated/spells";
import characters from "@/data/snapshot/characters.json";
import spells from "@/data/snapshot/spells.json";

const records = characters as Array<{
  id: string;
  name: string;
  patronus: string | null;
  [key: string]: unknown;
}>;

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

  it("has no parenthetical in any name", () => {
    expect(records.filter((record) => record.name.includes("(")).map((r) => r.id)).toEqual([]);
  });

  it("has at least 40 corporeal patronuses", () => {
    const corporeal = records.filter(
      (record) => record.patronus !== null && !record.patronus.includes("non-corporeal"),
    );
    expect(corporeal.length).toBeGreaterThanOrEqual(40);
  });

  it("stores no URLs", () => {
    const urls = strings([characters, spells]).filter((text) => /https?:\/\//i.test(text));
    expect(urls).toEqual([]);
  });

  it("has slug ids and descriptions for every spell", () => {
    const Spell = z.object({ id: z.string().min(1), name: z.string().min(1), description: z.string().min(1) });
    expect(z.array(Spell).min(50).safeParse(spells).success).toBe(true);
  });
});
