import { gsap } from "@/animation/gsap";
import type { SpellEffectKey } from "@/data/curated/spells";
import { addToFx } from "./fx";
import { EFFECT_FOCUS, type SpellEffect } from "./types";

export type { SpellEffect, StageRefs } from "./types";
export { EFFECT_FOCUS } from "./types";
export { addToFx } from "./fx";

/**
 * Temporary stand-in for every signature effect: a soft flash of the spell's colour at the
 * effect focus. Each key gets its own module in `./<key>.ts` (spec §7.3) and replaces this.
 */
export const placeholderEffect: SpellEffect = (stage, colour) => {
  const flash = addToFx(stage, {
    left: `${EFFECT_FOCUS.x * 100}%`,
    top: `${EFFECT_FOCUS.y * 100}%`,
    width: "min(60%, 360px)",
    aspectRatio: "1",
    borderRadius: "50%",
    background: `radial-gradient(circle, ${colour} 0%, transparent 65%)`,
  });

  return gsap
    .timeline()
    .set(flash, { xPercent: -50, yPercent: -50, scale: 0.4 })
    .to(flash, { scale: 1.3, duration: 1.1, ease: "power2.out" }, 0)
    .to(flash, { keyframes: { opacity: [0, 0.85, 0], ease: "none" }, duration: 1.1, ease: "power1.out" }, 0);
};

/** Every curated spell's signature effect; the `Record` makes a missing key a type error. */
export const SPELL_EFFECTS: Record<SpellEffectKey, SpellEffect> = {
  lumos: placeholderEffect,
  leviosa: placeholderEffect,
  incendio: placeholderEffect,
  expelliarmus: placeholderEffect,
  stupefy: placeholderEffect,
  protego: placeholderEffect,
  accio: placeholderEffect,
  alohomora: placeholderEffect,
  reparo: placeholderEffect,
  patronus: placeholderEffect,
};
