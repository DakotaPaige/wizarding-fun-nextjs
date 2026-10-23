import type { PageDataQuery, SpellEffectKey as WireEffectKey } from "@/graphql/generated/graphql";
import type { SpellEffectKey } from "@/data/curated/spells";
import { Spells } from "./Spells";

interface SpellsSectionProps {
  spells: PageDataQuery["spells"];
}

/** GraphQL enums are upper-case on the wire; the effect registry is keyed in lower case. */
function toEffectKey(key: WireEffectKey): SpellEffectKey {
  return key.toLowerCase() as Lowercase<WireEffectKey>;
}

/** The Classroom: maps the page query's spells onto the client-side spell stage. */
export function SpellsSection({ spells }: SpellsSectionProps) {
  return <Spells spells={spells.map((spell) => ({ ...spell, effect: toEffectKey(spell.effect) }))} />;
}
