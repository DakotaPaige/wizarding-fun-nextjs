import { gsap } from "@/animation/gsap";
import { addToFx } from "./fx";
import { AT_FOCUS, measureOnce, tint } from "./helpers";
import { EFFECT_FOCUS, type SpellEffect } from "./types";

const SHUDDER = 0.42;
/** The beat the stunned stage hangs still before it thaws. */
const FREEZE = 0.55;
const THAW = 0.5;

/**
 * Stupefy: a red flash and a shockwave from the focus, the whole stage shudders, then hangs
 * frozen under a red cast for a beat before it thaws. The shudder moves the stage itself, so
 * its transform is cleared at the end — and if a new cast interrupts it.
 */
export const stupefy: SpellEffect = (refs, colour) => {
  const { stage } = refs;
  const measure = measureOnce(refs);
  const flash = addToFx(refs, {
    inset: "0",
    background: `radial-gradient(circle at ${EFFECT_FOCUS.x * 100}% ${EFFECT_FOCUS.y * 100}%, #ffe1e1 0, ${colour} 14%, ${tint(colour, 55)} 45%, ${tint(colour, 30)} 100%)`,
  });
  const ring = addToFx(refs, {
    ...AT_FOCUS,
    width: "140px",
    height: "140px",
    borderRadius: "50%",
    border: `3px solid ${colour}`,
    boxShadow: `0 0 18px ${colour}, inset 0 0 18px ${colour}`,
  });
  const reset = () => gsap.set(stage, { clearProps: "transform" });
  const jolt = (fraction: number) => () => measure().unit * 0.03 * fraction;

  return (
    gsap
      .timeline({ onInterrupt: reset })
      .to(flash, { keyframes: [{ opacity: 0.85, duration: 0.06 }, { opacity: 0.32, duration: SHUDDER - 0.06, ease: "power2.out" }] }, 0)
      .fromTo(
        ring,
        { xPercent: -50, yPercent: -50, scale: 0.1, opacity: 1 },
        { scale: 3.2, opacity: 0, duration: 0.6, ease: "power2.out", immediateRender: false },
        0,
      )
      .to(
        stage,
        {
          keyframes: [
            { x: jolt(-1), rotation: -0.6 },
            { x: jolt(0.85), rotation: 0.5 },
            { x: jolt(-0.6), rotation: -0.35 },
            { x: jolt(0.4), rotation: 0.2 },
            { x: jolt(-0.2), rotation: -0.1 },
            { x: 0, rotation: 0 },
          ],
          duration: SHUDDER,
          ease: "none",
        },
        0,
      )
      // Frozen: nothing moves until the red cast lifts.
      .to(flash, { opacity: 0, duration: THAW, ease: "power1.in" }, SHUDDER + FREEZE)
      .add(reset)
  );
};
