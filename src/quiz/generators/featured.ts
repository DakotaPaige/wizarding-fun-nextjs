import { FEATURED } from "@/data/curated/featured";
import type { CharacterRecord } from "@/data/types";

/** Normal questions are about well-known characters only; hard ones may use any kept character. */
export function featuredOnly(characters: readonly CharacterRecord[]): CharacterRecord[] {
  return characters.filter((c) => Object.hasOwn(FEATURED, c.id));
}
