import type { gsap } from "@/animation/gsap";

/** The stage elements a cast animates. Everything an effect creates goes in `fx`. */
export interface StageRefs {
  /** The stage box; positions are measured relative to it. */
  stage: HTMLElement;
  /** The wand's pivot, resting at `rotation: 0` (its resting angle is set in CSS on a wrapper). */
  wand: HTMLElement;
  /** A glow at the wand's tip; moves with the wand. */
  tip: HTMLElement;
  /** An empty, non-interactive layer over the whole stage, cleared before every cast. */
  fx: HTMLElement;
}

/** A spell's signature effect: builds (does not play) a timeline on the stage in the spell's colour. */
export type SpellEffect = (stage: StageRefs, colour: string) => gsap.core.Timeline;

/** Where bolts land and effects centre, as fractions of the stage box (the wireframes' effect area). */
export const EFFECT_FOCUS = { x: 0.62, y: 0.32 } as const;
