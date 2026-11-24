import { cache } from "react";
import type { z } from "zod";
import charactersSnapshot from "@/data/snapshot/characters.json";
import spellsSnapshot from "@/data/snapshot/spells.json";
import { CharacterRecordSchema, SpellRecordSchema } from "@/data/schemas";
import type { WizardingData } from "@/data/types";

/** Validates each record, dropping (and reporting) the invalid ones. */
function parseRecords<S extends z.ZodType>(label: string, schema: S, payload: unknown): z.infer<S>[] {
  if (!Array.isArray(payload)) throw new Error(`Expected an array of ${label}s`);

  const valid: z.infer<S>[] = [];
  const dropped: string[] = [];
  for (const item of payload as unknown[]) {
    const result = schema.safeParse(item);
    if (result.success) {
      valid.push(result.data);
    } else {
      const id = (item as { id?: unknown } | null)?.id;
      dropped.push(typeof id === "string" ? id : "<no id>");
    }
  }
  if (dropped.length > 0) {
    console.warn(`Dropped ${dropped.length} invalid ${label} record(s): ${dropped.join(", ")}`);
  }
  return valid;
}

/** Uncached implementation: the committed snapshot, validated. No I/O. */
export function loadWizardingData(): WizardingData {
  return {
    characters: parseRecords("character", CharacterRecordSchema, charactersSnapshot),
    spells: parseRecords("spell", SpellRecordSchema, spellsSnapshot),
  };
}

export const getWizardingData = cache(loadWizardingData);
