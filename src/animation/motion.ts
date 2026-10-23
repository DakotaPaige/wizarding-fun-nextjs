import type { gsap } from "gsap";

export const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const FULL_MOTION = "(prefers-reduced-motion: no-preference)";

/**
 * Registers the full and reduced variants of an animation on a matchMedia context.
 * Exactly one runs at a time; GSAP reverts the other when the preference flips.
 */
export function withMotion(ctx: gsap.MatchMedia, full: () => void, reduced: () => void): void {
  ctx.add(FULL_MOTION, full);
  ctx.add(REDUCED_MOTION, reduced);
}

/** Synchronous check for code outside a matchMedia context (e.g. scroll behaviour). */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia(REDUCED_MOTION).matches;
}
