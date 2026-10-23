import { builder, HouseNameEnum } from "@/graphql/builder";
import { getLookups } from "@/graphql/context";
import { getArt, type ArtAsset } from "@/data/art-manifest";
import type { CharacterRecord, Wand } from "@/data/types";

export const CharacterRef = builder.objectRef<CharacterRecord>("Character");
const WandRef = builder.objectRef<Wand>("Wand");
const ArtRef = builder.objectRef<ArtAsset>("Art");

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

WandRef.implement({
  fields: (t) => ({
    wood: t.exposeString("wood", { nullable: true }),
    core: t.exposeString("core", { nullable: true }),
    lengthInches: t.exposeFloat("lengthInches", { nullable: true }),
  }),
});

ArtRef.implement({
  fields: (t) => ({
    src: t.exposeString("src"),
    alt: t.exposeString("alt"),
    width: t.exposeInt("width"),
    height: t.exposeInt("height"),
  }),
});

CharacterRef.implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    initials: t.string({ resolve: (character) => initialsOf(character.name) }),
    alternateNames: t.exposeStringList("alternateNames"),
    house: t.field({ type: HouseNameEnum, nullable: true, resolve: (character) => character.house }),
    ancestry: t.exposeString("ancestry", { nullable: true }),
    patronus: t.exposeString("patronus", { nullable: true }),
    actor: t.exposeString("actor", { nullable: true }),
    dateOfBirth: t.exposeString("dateOfBirth", { nullable: true }),
    alive: t.exposeBoolean("alive"),
    eyeColour: t.exposeString("eyeColour", { nullable: true }),
    hairColour: t.exposeString("hairColour", { nullable: true }),
    wand: t.field({ type: WandRef, nullable: true, resolve: (character) => character.wand }),
    portrait: t.field({
      type: ArtRef,
      nullable: true,
      resolve: (character) => getArt(`portrait.${character.id}`),
    }),
  }),
});

builder.queryField("character", (t) =>
  t.field({
    type: CharacterRef,
    nullable: true,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }, { data }) => getLookups(data).characterById.get(id) ?? null,
  }),
);
