import { z } from "zod";

/** HP-API leaves many fields as "", null or absent; all of those parse to a string/null here. */
const patchyString = z.string().nullish();

const RawWandSchema = z.object({
  wood: patchyString,
  core: patchyString,
  length: z.number().nullish(),
});

export const RawCharacterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  alternate_names: z.array(z.string()).nullish(),
  house: patchyString,
  dateOfBirth: patchyString,
  ancestry: patchyString,
  eyeColour: patchyString,
  hairColour: patchyString,
  wand: RawWandSchema.nullish(),
  patronus: patchyString,
  actor: patchyString,
  alive: z.boolean().nullish(),
});

export const RawSpellSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: patchyString,
});

export type RawCharacter = z.infer<typeof RawCharacterSchema>;
export type RawSpell = z.infer<typeof RawSpellSchema>;
