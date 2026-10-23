import { gsap } from "@/animation/gsap";
import { addToFx } from "./fx";
import { addSvg, AT_FOCUS, glow, measureOnce, sparkBurst } from "./helpers";
import type { SpellEffect } from "./types";

/** The opponent's wand: darker wood than ours, pointing back at the caster (tip on the left). */
const OPPONENT_WAND = `
  <polygon points="3,7.2 108,4.5 108,11.5 3,8.8" fill="#5b3b2a" />
  <path d="M108 4h44a5 5 0 0 1 0 8h-44z" fill="#2f2119" />
  <rect x="116" y="4" width="3" height="8" fill="#6d4a33" />
  <rect x="140" y="4" width="2.5" height="8" fill="#6d4a33" />
  <circle cx="3" cy="8" r="1.4" fill="#d9c7a8" />
`;

const SPIN_START = 0.22;
const FLIGHT = 1.05;

/**
 * Expelliarmus: the bolt strikes an opponent's wand at the focus; it jolts, then spins away
 * in an arc off the right of the stage, shedding red sparks where it was hit.
 */
export const expelliarmus: SpellEffect = (refs, colour) => {
  const measure = measureOnce(refs);
  const wand = addSvg(refs, "0 0 160 16", OPPONENT_WAND, {
    ...AT_FOCUS,
    width: "clamp(120px, 26%, 220px)",
    aspectRatio: "160 / 16",
    filter: `drop-shadow(0 0 6px ${colour})`,
  });
  const impact = addToFx(refs, {
    ...AT_FOCUS,
    width: "120px",
    height: "120px",
    borderRadius: "50%",
    background: glow(colour),
  });

  return (
    gsap
      .timeline()
      .fromTo(wand, { xPercent: -50, yPercent: -50, rotation: -8, opacity: 0 }, { opacity: 1, duration: 0.08 }, 0)
      .fromTo(
        impact,
        { xPercent: -50, yPercent: -50, scale: 0.2, opacity: 1 },
        { scale: 1.6, opacity: 0, duration: 0.5, ease: "power2.out", immediateRender: false },
        0,
      )
      // Knocked back by the hit, then flung.
      .to(wand, { x: 12, rotation: 14, duration: SPIN_START, ease: "power2.out" }, 0)
      .to(wand, { x: () => measure().width * 0.75, rotation: 14 + 900, duration: FLIGHT, ease: "power1.in" }, SPIN_START)
      // An arc: up, then dropping as it leaves.
      .to(wand, { y: () => -measure().unit * 0.28, duration: FLIGHT * 0.55, ease: "sine.out" }, SPIN_START)
      .to(wand, { y: () => -measure().unit * 0.12, duration: FLIGHT * 0.45, ease: "sine.in" }, ">")
      .add(
        sparkBurst(refs, measure, {
          colour,
          count: 14,
          origin: (box) => box.focus,
          angle: () => -60,
          spread: 220,
          distance: [0.1, 0.26],
          rise: -0.05,
          size: [5, 10],
          duration: [0.5, 0.9],
        }),
        0,
      )
      .set(wand, { opacity: 0 }, SPIN_START + FLIGHT)
  );
};
