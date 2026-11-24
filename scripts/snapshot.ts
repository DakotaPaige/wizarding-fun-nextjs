/**
 * Builds src/data/snapshot/{characters,spells}.json from PotterDB (characters, spells) and
 * HP-API (actor names only; falls back to the actors in the existing snapshot if HP-API is down). PotterDB allows 15 requests a minute, so a run takes about four
 * minutes; nothing is written unless every request succeeds. The free HP-API host can take
 * 30-50 s to wake, so it has deliberately no timeout.
 *
 * Usage: pnpm snapshot
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildSnapshot, fetchAllPages, HP_API_URL } from "./snapshot-lib";

const outDir = path.join(process.cwd(), "src/data/snapshot");

/**
 * HP-API is the actor source, but the free host has been suspended before. When it can't be read,
 * fall back to the actors already in the committed snapshot (records carry id, name and actor, which
 * is all the join needs) so a rebuild never loses them.
 */
async function fetchActorSource(): Promise<unknown[]> {
  try {
    const response = await fetch(HP_API_URL);
    if (!response.ok) throw new Error(`${HP_API_URL} responded ${response.status}`);
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error(`${HP_API_URL} did not return an array`);
    return data;
  } catch (error) {
    console.warn(`HP-API unavailable (${String(error)}); reusing actors from the existing snapshot.`);
    const existing: unknown = JSON.parse(await readFile(path.join(outDir, "characters.json"), "utf8"));
    if (!Array.isArray(existing)) throw new Error("existing characters.json is not an array");
    return existing;
  }
}

async function main(): Promise<void> {
  const deps = {
    fetchImpl: fetch,
    sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  };

  console.log("Fetching PotterDB characters (about 55 pages)...");
  const potterCharacters = await fetchAllPages("/v1/characters", deps);
  console.log(`Fetched ${potterCharacters.length} characters. Fetching spells...`);
  await deps.sleep(4100);
  const potterSpells = await fetchAllPages("/v1/spells", deps);
  console.log(`Fetched ${potterSpells.length} spells. Fetching HP-API actors...`);

  const hpCharacters = await fetchActorSource();

  const { characters, spells } = buildSnapshot({ potterCharacters, potterSpells, hpCharacters });

  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "characters.json"), `${JSON.stringify(characters, null, 2)}\n`);
  await writeFile(path.join(outDir, "spells.json"), `${JSON.stringify(spells, null, 2)}\n`);
  console.log(`Wrote ${characters.length} characters and ${spells.length} spells`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
