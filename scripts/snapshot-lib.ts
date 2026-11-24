import { ACTOR_OVERRIDES, FEATURED, WAND_OVERRIDES } from "../src/data/curated/featured";
import { RawCharacterSchema } from "../src/data/hp-api/schemas";
import { toCharacterRecord, toSpellRecord } from "../src/data/potterdb/parse";
import { PotterCharacterSchema, PotterSpellSchema } from "../src/data/potterdb/schemas";
import type { CharacterRecord, SpellRecord, Wand } from "../src/data/types";

export const POTTERDB_BASE_URL = "https://api.potterdb.com";
export const HP_API_URL = "https://hp-api.onrender.com/api/characters";

/** PotterDB allows 15 requests a minute per IP; 4,100 ms keeps just under that. */
const REQUEST_SPACING_MS = 4100;
const MAX_RETRIES = 5;
const BACKOFF_MS = 10_000;

export interface FetchDeps {
  fetchImpl: typeof fetch;
  sleep: (ms: number) => Promise<void>;
}

async function fetchJson(url: string, deps: FetchDeps): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    const response = await deps.fetchImpl(url);
    if (response.ok) return response.json();
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= MAX_RETRIES) {
      throw new Error(`${url} responded ${response.status}`);
    }
    await deps.sleep(BACKOFF_MS * (attempt + 1));
  }
}

/** Collects every item of a paginated PotterDB collection, following `links.next` verbatim. */
export async function fetchAllPages(path: string, deps: FetchDeps): Promise<unknown[]> {
  const items: unknown[] = [];
  let url: string | undefined = `${POTTERDB_BASE_URL}${path}?page[size]=100`;
  let first = true;
  while (url) {
    if (!first) await deps.sleep(REQUEST_SPACING_MS);
    first = false;
    const page = (await fetchJson(url, deps)) as {
      data?: unknown;
      links?: { next?: unknown };
    };
    if (!Array.isArray(page.data)) throw new Error(`${url} did not return a data array`);
    items.push(...page.data);
    url = typeof page.links?.next === "string" ? page.links.next : undefined;
  }
  return items;
}

export interface SnapshotInput {
  potterCharacters: unknown[];
  potterSpells: unknown[];
  hpCharacters: unknown[];
  featured?: Readonly<Record<string, string>>;
  actorOverrides?: Readonly<Record<string, string>>;
  wandOverrides?: Readonly<Record<string, Wand>>;
}

function byId<T extends { id: string }>(a: T, b: T): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function warnInvalid(kind: string, count: number): void {
  if (count > 0) console.warn(`snapshot: dropped ${count} invalid ${kind}`);
}

function hasParsedWand(record: CharacterRecord): boolean {
  const wand = record.wand;
  return wand !== null && wand.wood !== null && wand.core !== null && wand.lengthInches !== null;
}

export function buildSnapshot(input: SnapshotInput): {
  characters: CharacterRecord[];
  spells: SpellRecord[];
} {
  const featured = input.featured ?? FEATURED;
  const overrides = input.actorOverrides ?? ACTOR_OVERRIDES;
  const wandOverrides = input.wandOverrides ?? WAND_OVERRIDES;

  // HP-API records are matched by name; records from a previous snapshot (the fallback source)
  // carry the featured slug as their id, which also survives ACTOR_OVERRIDES.
  const actorsByName = new Map<string, string>();
  const actorsById = new Map<string, string>();
  for (const raw of input.hpCharacters) {
    const parsed = RawCharacterSchema.safeParse(raw);
    const actor = parsed.success ? parsed.data.actor?.trim() : undefined;
    if (!parsed.success || !actor) continue;
    actorsByName.set(parsed.data.name.trim().toLowerCase(), actor);
    actorsById.set(parsed.data.id, actor);
  }

  let invalidCharacters = 0;
  const characters: CharacterRecord[] = [];
  for (const raw of input.potterCharacters) {
    const parsed = PotterCharacterSchema.safeParse(raw);
    if (!parsed.success) {
      invalidCharacters++;
      continue;
    }
    const record = toCharacterRecord(parsed.data, featured);
    if (Object.hasOwn(wandOverrides, record.id)) record.wand = { ...wandOverrides[record.id]! };
    const isFeatured = Object.hasOwn(featured, record.id);
    if (!isFeatured && !record.house && !record.patronus && !hasParsedWand(record)) continue;
    if (isFeatured) {
      const hpName = overrides[record.id] ?? record.name;
      record.actor =
        actorsById.get(record.id) ?? actorsByName.get(hpName.trim().toLowerCase()) ?? null;
    }
    characters.push(record);
  }
  warnInvalid("characters", invalidCharacters);

  let invalidSpells = 0;
  const spells: SpellRecord[] = [];
  for (const raw of input.potterSpells) {
    const parsed = PotterSpellSchema.safeParse(raw);
    if (!parsed.success) {
      invalidSpells++;
      continue;
    }
    const record = toSpellRecord(parsed.data);
    if (record) spells.push(record);
  }
  warnInvalid("spells", invalidSpells);

  return { characters: characters.sort(byId), spells: spells.sort(byId) };
}
