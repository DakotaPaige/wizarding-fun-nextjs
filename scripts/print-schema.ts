/** Writes the SDL of the GraphQL schema to schema.graphql (input for codegen). Usage: pnpm schema:print */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { printSchema } from "graphql";
import { schema } from "../src/graphql/schema";

async function main(): Promise<void> {
  await writeFile(path.join(process.cwd(), "schema.graphql"), `${printSchema(schema)}\n`);
  console.log("Wrote schema.graphql");
}

void main();
