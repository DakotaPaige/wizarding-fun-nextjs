import { z } from "zod";

/** PotterDB leaves many attributes null or absent; unknown keys (image, wiki, links) are stripped. */
const patchyString = z.string().nullish();

export const PotterCharacterSchema = z.object({
  id: z.string().min(1),
  type: z.string(),
  attributes: z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    alias_names: z.array(z.string()).nullish(),
    blood_status: patchyString,
    born: patchyString,
    died: patchyString,
    eye_color: patchyString,
    hair_color: patchyString,
    house: patchyString,
    patronus: patchyString,
    wands: z.array(z.string()).nullish(),
  }),
});

export const PotterSpellSchema = z.object({
  id: z.string().min(1),
  type: z.string(),
  attributes: z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    incantation: patchyString,
    effect: patchyString,
  }),
});

export type PotterCharacter = z.infer<typeof PotterCharacterSchema>;
export type PotterSpell = z.infer<typeof PotterSpellSchema>;
