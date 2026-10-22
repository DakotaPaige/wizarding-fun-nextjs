import { cache } from "react";
import type { z } from "zod";
import { fetchHpApi, type HpApiEndpoint } from "@/data/hp-api/client";
import { RawCharacterSchema, RawSpellSchema } from "@/data/hp-api/schemas";
import { normaliseCharacter, normaliseSpell } from "@/data/normalise";
import charactersSnapshot from "@/data/snapshot/characters.json";
import spellsSnapshot from "@/data/snapshot/spells.json";
import type { WizardingData } from "@/data/types";

export interface RepositoryDeps {
  fetchImpl?: typeof fetch;
}

/** Validates each raw record, dropping (and reporting) the invalid ones. */
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

function fromPayloads(characters: unknown, spells: unknown, source: WizardingData["source"]): WizardingData {
  return {
    characters: parseRecords("character", RawCharacterSchema, characters).map(normaliseCharacter),
    spells: parseRecords("spell", RawSpellSchema, spells).map(normaliseSpell),
    source,
  };
}

function fetchBoth(fetchImpl: typeof fetch | undefined) {
  const get = (endpoint: HpApiEndpoint) => fetchHpApi(endpoint, fetchImpl);
  return Promise.all([get("characters"), get("spells")]);
}

/** Uncached implementation: live HP-API data, or the committed snapshot on any failure. */
export async function loadWizardingData({ fetchImpl }: RepositoryDeps = {}): Promise<WizardingData> {
  try {
    const [characters, spells] = await fetchBoth(fetchImpl);
    return fromPayloads(characters, spells, "live");
  } catch (error) {
    console.warn("HP-API unavailable, using committed snapshot:", error);
    return fromPayloads(charactersSnapshot, spellsSnapshot, "snapshot");
  }
}

export const getWizardingData = cache(loadWizardingData);
