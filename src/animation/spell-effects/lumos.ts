import { gsap } from "@/animation/gsap";
import { addToFx } from "./fx";
import { glow, measureOnce, tint } from "./helpers";
import type { SpellEffect } from "./types";

const DURATION = 2.9;
const DARK = "rgb(5 6 11 / 0.9)";
/** The pool of light's radius: generous on phones, capped on wide stages. */
const RADIUS = "clamp(110px, 17vw, 170px)";
const EMBER = 44;

/**
 * Lumos: the wand tip ignites and the stage falls dark around a pool of its light, which
 * follows the pointer while the spell lasts. The dark is a layer three stages wide with the
 * light at its centre, so translating it to the pointer never uncovers an edge. The flame on
 * the tip is drawn above the dark and kept on the tip as the wand settles.
 */
export const lumos: SpellEffect = (refs, colour) => {
  const { stage, tip } = refs;
  const measure = measureOnce(refs);
  const dark = addToFx(refs, {
    left: "-100%",
    top: "-100%",
    width: "300%",
    height: "300%",
    background: `radial-gradient(circle at 50% 50%, ${tint(colour, 45)} 0, ${tint(colour, 14)} calc(${RADIUS} * 0.55), ${DARK} ${RADIUS})`,
  });
  const ember = addToFx(refs, {
    width: `${EMBER}px`,
    height: `${EMBER}px`,
    borderRadius: "50%",
    background: glow(colour),
  });
  const keepOnTip = () => {
    const box = stage.getBoundingClientRect();
    const end = tip.getBoundingClientRect();
    gsap.set(ember, {
      x: end.left + end.width / 2 - box.left - EMBER / 2,
      y: end.top + end.height / 2 - box.top - EMBER / 2,
    });
  };

  // The pointer listener lives exactly as long as the timeline plays: added on start,
  // removed on complete, on rewind and when a new cast interrupts this one.
  let follow: ((event: PointerEvent) => void) | null = null;
  let moves: gsap.QuickToFunc[] = [];
  const startFollowing = () => {
    if (follow) return;
    const moveX = gsap.quickTo(dark, "x", { duration: 0.45, ease: "power3.out" });
    const moveY = gsap.quickTo(dark, "y", { duration: 0.45, ease: "power3.out" });
    moves = [moveX, moveY];
    follow = (event) => {
      const box = stage.getBoundingClientRect();
      const clamp = gsap.utils.clamp;
      moveX(clamp(0, box.width, event.clientX - box.left) - box.width / 2);
      moveY(clamp(0, box.height, event.clientY - box.top) - box.height / 2);
    };
    stage.addEventListener("pointermove", follow);
  };
  const stopFollowing = () => {
    if (!follow) return;
    stage.removeEventListener("pointermove", follow);
    follow = null;
    moves.forEach((move) => move.tween.kill());
    moves = [];
  };

  return (
    gsap
      .timeline({
        onStart: startFollowing,
        onUpdate: keepOnTip,
        onComplete: stopFollowing,
        onReverseComplete: stopFollowing,
        onInterrupt: stopFollowing,
      })
      // The light starts on the wand tip.
      .fromTo(
        dark,
        {
          x: () => measure().tip.x - measure().width / 2,
          y: () => measure().tip.y - measure().height / 2,
          scale: 0.6,
          opacity: 0,
        },
        { scale: 1, opacity: 1, duration: 0.7, ease: "power3.out", immediateRender: false },
        0,
      )
      .to(ember, { keyframes: { opacity: [1, 1, 1, 0], scale: [1.8, 1.2, 1.35, 1.2, 0.8] }, duration: DURATION, ease: "none" }, 0)
      .to(dark, { opacity: 0, duration: 0.6, ease: "power2.in" }, DURATION - 0.6)
  );
};
