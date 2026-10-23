import SchemaBuilder from "@pothos/core";
import type { GraphQLContext } from "@/graphql/context";
import type { HouseName } from "@/data/types";
import type { SpellEffectKey } from "@/data/curated/spells";

export const HOUSE_NAMES = ["GRYFFINDOR", "SLYTHERIN", "RAVENCLAW", "HUFFLEPUFF"] as const satisfies readonly HouseName[];

/**
 * Spell effect keys are lower-case in TypeScript and upper-case in GraphQL
 * (`patronus` <-> `PATRONUS`); this is the single place that mapping lives.
 */
export const SPELL_EFFECT_KEYS = [
  "lumos",
  "leviosa",
  "incendio",
  "expelliarmus",
  "stupefy",
  "protego",
  "accio",
  "alohomora",
  "reparo",
  "patronus",
] as const satisfies readonly SpellEffectKey[];

export const builder = new SchemaBuilder<{
  Context: GraphQLContext;
  DefaultFieldNullability: false;
  Scalars: { ID: { Input: string; Output: string } };
}>({ defaultFieldNullability: false });

export const HouseNameEnum = builder.enumType("HouseName", { values: HOUSE_NAMES });

export const SpellEffectKeyEnum = builder.enumType("SpellEffectKey", {
  values: Object.fromEntries(
    SPELL_EFFECT_KEYS.map((key) => [key.toUpperCase(), { value: key }]),
  ) as Record<Uppercase<SpellEffectKey>, { value: SpellEffectKey }>,
});

builder.queryType({});
builder.mutationType({});
