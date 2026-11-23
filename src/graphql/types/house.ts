import { builder, HouseNameEnum } from "@/graphql/builder";
import { CharacterRef } from "@/graphql/types/character";
import { getLookups } from "@/graphql/context";
import { HOUSES, type HouseInfo } from "@/data/curated/houses";
import { ROSTER } from "@/data/curated/roster";
import type { CharacterRecord } from "@/data/types";

const HouseRef = builder.objectRef<HouseInfo>("House");

HouseRef.implement({
  fields: (t) => ({
    name: t.field({ type: HouseNameEnum, resolve: (house) => house.name }),
    displayName: t.exposeString("displayName"),
    traits: t.exposeStringList("traits"),
    members: t.field({
      type: [CharacterRef],
      description: "Curated roster, in display order.",
      resolve: (house, _args, { data }) => {
        const { characterById } = getLookups(data);
        return ROSTER[house.name]
          .map((id) => characterById.get(id))
          .filter((character): character is CharacterRecord => character !== undefined);
      },
    }),
  }),
});

builder.queryFields((t) => ({
  houses: t.field({ type: [HouseRef], resolve: () => [...HOUSES] }),
  house: t.field({
    type: HouseRef,
    nullable: true,
    args: { name: t.arg({ type: HouseNameEnum, required: true }) },
    resolve: (_root, { name }) => HOUSES.find((house) => house.name === name) ?? null,
  }),
}));
