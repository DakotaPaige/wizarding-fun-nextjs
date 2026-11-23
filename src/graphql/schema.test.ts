import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { parse } from "graphql";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { CURATED_SPELLS } from "@/data/curated/spells";
import { ROSTER } from "@/data/curated/roster";
import { loadWizardingData } from "@/data/repository";
import type { WizardingData } from "@/data/types";
import { executeQuery } from "@/graphql/execute";
import { schema } from "@/graphql/schema";

const HERMIONE = ROSTER.GRYFFINDOR[1]!;
const SNAPE = ROSTER.SLYTHERIN[1]!;

function query<TResult, TVars = Record<string, never>>(source: string): TypedDocumentNode<TResult, TVars> {
  return parse(source) as TypedDocumentNode<TResult, TVars>;
}

let data: WizardingData;

beforeAll(async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  data = await loadWizardingData({ fetchImpl: () => Promise.reject(new Error("offline")) });
  warn.mockRestore();
});

const run = <TResult, TVars = Record<string, never>>(source: string, vars?: TVars) =>
  executeQuery(query<TResult, TVars>(source), vars, { data });

describe("read schema", () => {
  it("returns the four houses in order with six members each", async () => {
    const result = await run<{ houses: { name: string; members: { id: string }[] }[] }>(
      "{ houses { name members { id } } }",
    );
    expect(result.houses.map((h) => h.name)).toEqual(["GRYFFINDOR", "SLYTHERIN", "RAVENCLAW", "HUFFLEPUFF"]);
    for (const house of result.houses) expect(house.members).toHaveLength(6);
  });

  it("returns a house's members in roster order", async () => {
    const result = await run<{ house: { members: { name: string }[] } }>(
      "{ house(name: GRYFFINDOR) { members { name } } }",
    );
    expect(result.house.members[1]?.name).toBe("Hermione Granger");
  });

  it("returns a character's wand, birth date and initials", async () => {
    const result = await run<
      { character: { wand: unknown; dateOfBirth: string; initials: string; portrait: unknown } },
      { id: string }
    >(
      "query ($id: ID!) { character(id: $id) { wand { wood core lengthInches } dateOfBirth initials portrait { src } } }",
      { id: HERMIONE },
    );
    expect(result.character.wand).toEqual({ wood: "vine", core: "dragon heartstring", lengthInches: 10.75 });
    expect(result.character.dateOfBirth).toBe("1979-09-19");
    expect(result.character.initials).toBe("HG");
    expect(result.character.portrait).toBeNull();
  });

  it("returns a null wand when the character has none", async () => {
    const result = await run<{ character: { wand: unknown } }, { id: string }>(
      "query ($id: ID!) { character(id: $id) { wand { wood } } }",
      { id: SNAPE },
    );
    expect(result.character.wand).toBeNull();
  });

  it("returns null for unknown characters", async () => {
    const result = await run<{ character: unknown }>('{ character(id: "nope") { id } }');
    expect(result.character).toBeNull();
  });

  it("returns the curated spells in order, applying description overrides", async () => {
    const result = await run<{ spells: { name: string; description: string; effect: string }[] }>(
      "{ spells { name description effect } }",
    );
    expect(result.spells.map((s) => s.name)).toEqual(CURATED_SPELLS.map((s) => s.apiName));
    expect(result.spells[9]?.description).toBe(CURATED_SPELLS[9]?.descriptionOverride);
    expect(result.spells[9]?.effect).toBe("PATRONUS");
  });

  it("has no image field anywhere", () => {
    const names = Object.values(schema.getTypeMap()).flatMap((type) =>
      "getFields" in type && !type.name.startsWith("__") ? Object.keys(type.getFields()) : [],
    );
    expect(names).not.toContain("image");
  });
});
