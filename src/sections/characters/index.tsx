import type { PageDataQuery } from "@/graphql/generated/graphql";
import { Characters } from "./Characters";

interface CharactersSectionProps {
  houses: PageDataQuery["houses"];
}

/** The Great Hall: hands the page query's house rosters to the client-side tabs and roster. */
export function CharactersSection({ houses }: CharactersSectionProps) {
  // graphql-js builds results as null-prototype objects, which React won't pass to a Client
  // Component; a structured clone gives the same data as plain objects.
  return <Characters houses={structuredClone(houses)} />;
}
