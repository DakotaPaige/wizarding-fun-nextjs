import { z } from "zod";
import type { CharacterRecord, SpellRecord } from "@/data/types";

const HouseSchema = z.enum(["GRYFFINDOR", "SLYTHERIN", "RAVENCLAW", "HUFFLEPUFF"]);

const WandSchema = z.object({
  wood: z.string().nullable(),
  core: z.string().nullable(),
  lengthInches: z.number().nullable(),
});

/** The shape of a committed snapshot character; mirrors `CharacterRecord`. */
export const CharacterRecordSchema: z.ZodType<CharacterRecord> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  alternateNames: z.array(z.string()),
  house: HouseSchema.nullable(),
  ancestry: z.string().nullable(),
  patronus: z.string().nullable(),
  actor: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  alive: z.boolean(),
  eyeColour: z.string().nullable(),
  hairColour: z.string().nullable(),
  wand: WandSchema.nullable(),
});

/** The shape of a committed snapshot spell; mirrors `SpellRecord`. */
export const SpellRecordSchema: z.ZodType<SpellRecord> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
});
