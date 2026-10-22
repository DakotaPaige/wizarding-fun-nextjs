/**
 * Fetches the raw HP-API payloads and writes them to src/data/snapshot/.
 * The free-tier host can take 30-50 s to wake, so there is deliberately no timeout.
 *
 * Usage: pnpm snapshot
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { HP_API_BASE_URL } from "../src/data/hp-api/client";

const outDir = path.join(process.cwd(), "src/data/snapshot");

async function snapshot(endpoint: "characters" | "spells"): Promise<void> {
  const url = `${HP_API_BASE_URL}/api/${endpoint}`;
  console.log(`Fetching ${url} ...`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} responded ${response.status}`);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error(`${url} did not return an array`);
  await writeFile(path.join(outDir, `${endpoint}.json`), `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Wrote ${data.length} ${endpoint}`);
}

async function main(): Promise<void> {
  await mkdir(outDir, { recursive: true });
  await snapshot("characters");
  await snapshot("spells");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
