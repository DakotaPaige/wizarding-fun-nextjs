import { gsap } from "@/animation/gsap";
import { EFFECT_FOCUS, SPELL_EFFECTS, type StageRefs } from "@/animation/spell-effects";
import type { SpellEffectKey } from "@/data/curated/spells";

export interface CastOptions {
  /** Reduced motion: no flick, no bolt, no signature effect — a 0.3 s fade of the spell's colour. */
  reduced?: boolean;
}

/** The flick's wind-up and snap; the bolt leaves the tip at the end of the snap. */
const WIND_UP = 0.24;
const SNAP = 0.12;
/** How long the bolt takes to reach the effect focus; the signature effect starts on impact. */
const BOLT_TRAVEL = 0.16;
/** The bolt is a fixed-width bar stretched with `scaleX`, so only transforms animate. */
const BOLT_WIDTH = 100;
const BOLT_THICKNESS = 3;

function addToFx(fx: HTMLElement, style: Partial<CSSStyleDeclaration>): HTMLDivElement {
  const el = document.createElement("div");
  Object.assign(el.style, { position: "absolute", left: "0", top: "0", opacity: "0", ...style });
  fx.append(el);
  return el;
}

/** Wind back, snap forward, settle: the tip flares in the spell's colour on the snap. */
export function wandFlick({ wand, tip }: StageRefs, colour: string): gsap.core.Timeline {
  return gsap
    .timeline()
    .set(tip, { color: colour })
    .to(wand, { rotation: -14, duration: WIND_UP, ease: "power2.inOut" })
    .to(wand, { rotation: 7, duration: SNAP, ease: "power4.in" })
    .fromTo(tip, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1.5, duration: SNAP, ease: "power2.in" }, "<")
    .to(wand, { rotation: 0, duration: 0.6, ease: "elastic.out(1, 0.5)" })
    .to(tip, { opacity: 0, scale: 1, duration: 0.7, ease: "power1.out" }, "<0.15");
}

/**
 * A streak of light from the wand tip to the effect focus: the head races out, the tail
 * catches up, and a small burst marks the impact. Positions are measured when the bolt
 * starts, so it leaves wherever the flick has put the tip.
 */
export function bolt({ stage, tip, fx }: StageRefs, colour: string): gsap.core.Timeline {
  const streak = addToFx(fx, {
    width: `${BOLT_WIDTH}px`,
    height: `${BOLT_THICKNESS}px`,
    borderRadius: `${BOLT_THICKNESS}px`,
    background: `linear-gradient(to right, transparent, ${colour} 55%, #fff)`,
    boxShadow: `0 0 8px ${colour}, 0 0 18px ${colour}`,
  });
  const burst = addToFx(fx, {
    width: "56px",
    height: "56px",
    borderRadius: "50%",
    background: `radial-gradient(circle, #fff 0%, ${colour} 30%, transparent 70%)`,
  });

  let path: { x0: number; y0: number; x1: number; y1: number; length: number; angle: number } | null = null;
  const measure = () => {
    if (path) return path;
    const box = stage.getBoundingClientRect();
    const end = tip.getBoundingClientRect();
    const x0 = end.left + end.width / 2 - box.left;
    const y0 = end.top + end.height / 2 - box.top;
    const x1 = EFFECT_FOCUS.x * box.width;
    const y1 = EFFECT_FOCUS.y * box.height;
    path = {
      x0,
      y0,
      x1,
      y1,
      length: Math.hypot(x1 - x0, y1 - y0),
      angle: (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI,
    };
    return path;
  };
  const half = BOLT_THICKNESS / 2;

  return (
    gsap
      .timeline()
      .set(
        streak,
        {
          x: () => measure().x0,
          y: () => measure().y0 - half,
          rotation: () => measure().angle,
          transformOrigin: "0% 50%",
          scaleX: 0,
          opacity: 1,
          immediateRender: false,
        },
        0,
      )
      .to(streak, { scaleX: () => measure().length / BOLT_WIDTH, duration: BOLT_TRAVEL, ease: "power2.in" }, 0)
      // Moving the tail to the target while shrinking by the same eased amount keeps the head still.
      .to(streak, { x: () => measure().x1, y: () => measure().y1 - half, scaleX: 0, duration: 0.22, ease: "power2.out" })
      .set(streak, { opacity: 0 })
      .fromTo(
        burst,
        { x: () => measure().x1, y: () => measure().y1, xPercent: -50, yPercent: -50, scale: 0.2, opacity: 1 },
        { scale: 1.8, opacity: 0, duration: 0.45, ease: "power2.out", immediateRender: false },
        BOLT_TRAVEL,
      )
  );
}

/** Reduced motion's whole cast: the spell's colour fades up on the stage and stays. */
export function colourFade({ fx }: StageRefs, colour: string): gsap.core.Timeline {
  const wash = addToFx(fx, {
    inset: "0",
    background: `radial-gradient(circle at ${EFFECT_FOCUS.x * 100}% ${EFFECT_FOCUS.y * 100}%, ${colour}, transparent 55%)`,
  });
  return gsap.timeline().to(wash, { opacity: 0.45, duration: 0.3, ease: "power1.out" });
}

/**
 * Casts a spell on the stage: kills `previous` (the last cast's timeline), clears `fx` and
 * resets the wand, then plays wand flick → bolt in the spell's colour → signature effect.
 * Returns the new timeline; pass it back as `previous` on the next cast so the last one wins.
 */
export function castSpell(
  stage: StageRefs,
  spell: { colour: string; effect: SpellEffectKey },
  previous: gsap.core.Timeline | null,
  { reduced = false }: CastOptions = {},
): gsap.core.Timeline {
  previous?.kill();
  stage.fx.replaceChildren();
  gsap.set(stage.wand, { rotation: 0 });
  gsap.set(stage.tip, { opacity: 0 });

  if (reduced) return colourFade(stage, spell.colour);

  const release = WIND_UP + SNAP;
  return gsap
    .timeline()
    .add(wandFlick(stage, spell.colour), 0)
    .add(bolt(stage, spell.colour), release)
    .add(SPELL_EFFECTS[spell.effect](stage, spell.colour), release + BOLT_TRAVEL);
}
