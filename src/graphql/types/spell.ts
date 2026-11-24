import { builder, SpellEffectKeyEnum } from "@/graphql/builder";
import { getLookups } from "@/graphql/context";
import { CURATED_SPELLS, type SpellEffectKey } from "@/data/curated/spells";

interface SpellModel {
  id: string;
  name: string;
  description: string;
  colour: string;
  effect: SpellEffectKey;
}

const SpellRef = builder.objectRef<SpellModel>("Spell");

SpellRef.implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    description: t.exposeString("description", { description: "Config override if present, else API text." }),
    colour: t.exposeString("colour", { description: "Hex colour for the bolt and glow." }),
    effect: t.field({ type: SpellEffectKeyEnum, resolve: (spell) => spell.effect }),
  }),
});

builder.queryField("spells", (t) =>
  t.field({
    type: [SpellRef],
    description: "The curated spells, in display order. Spells missing from the data are omitted.",
    resolve: (_root, _args, { data }) => {
      const { spellById } = getLookups(data);
      return CURATED_SPELLS.flatMap((curated) => {
        const record = spellById.get(curated.slug);
        if (!record) return [];
        return [
          {
            id: record.id,
            name: record.name,
            description: curated.descriptionOverride ?? record.description,
            colour: curated.colour,
            effect: curated.effect,
          },
        ];
      });
    },
  }),
);
