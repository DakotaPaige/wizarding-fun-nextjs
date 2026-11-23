import type { SpellEffectKey } from "@/data/curated/spells";
import { accio } from "./accio";
import { alohomora } from "./alohomora";
import { expelliarmus } from "./expelliarmus";
import { incendio } from "./incendio";
import { leviosa } from "./leviosa";
import { lumos } from "./lumos";
import { patronus } from "./patronus";
import { protego } from "./protego";
import { reparo } from "./reparo";
import { stupefy } from "./stupefy";
import type { SpellEffect } from "./types";

export type { SpellEffect, StageRefs } from "./types";
export { EFFECT_FOCUS } from "./types";
export { addToFx } from "./fx";
export { measureOnce } from "./helpers";

/** Every curated spell's signature effect (spec §7.3); the `Record` makes a missing key a type error. */
export const SPELL_EFFECTS: Record<SpellEffectKey, SpellEffect> = {
  lumos,
  leviosa,
  incendio,
  expelliarmus,
  stupefy,
  protego,
  accio,
  alohomora,
  reparo,
  patronus,
};
