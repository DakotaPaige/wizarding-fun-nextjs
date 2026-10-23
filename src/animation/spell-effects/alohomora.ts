import { gsap } from "@/animation/gsap";
import { addSvg, AT_FOCUS, measureOnce, sparkBurst, uid } from "./helpers";
import type { SpellEffect } from "./types";

/** An original padlock: a steel shackle over a brass body with a keyhole. */
const PADLOCK = (colour: string, gradient: string) => `
  <defs>
    <linearGradient id="${gradient}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe39a" />
      <stop offset="1" stop-color="#b8862b" />
    </linearGradient>
  </defs>
  <path data-part="shackle" d="M17 38V22a13 13 0 0 1 26 0v16" fill="none" stroke="#c9ced6" stroke-width="6" stroke-linecap="round" />
  <rect x="6" y="34" width="48" height="40" rx="7" fill="url(#${gradient})" stroke="#8a6420" stroke-width="1.5" />
  <circle data-part="keyhole-glow" cx="30" cy="51" r="11" fill="${colour}" opacity="0" />
  <path d="M30 45a5 5 0 0 1 2.5 9.3V62h-5v-7.7A5 5 0 0 1 30 45z" fill="#3a2a12" />
`;

/** When the lock gives: after it's been tried. */
const CLICK = 0.85;
const DURATION = 2.1;

/**
 * Alohomora: a padlock appears at the focus, rattles as the charm works the keyhole, then
 * clicks — the shackle springs up and swings open in a burst of gold.
 */
export const alohomora: SpellEffect = (refs, colour) => {
  const measure = measureOnce(refs);
  const lock = addSvg(refs, "0 0 60 80", PADLOCK(colour, uid("alohomora")), {
    ...AT_FOCUS,
    width: "clamp(72px, 13%, 116px)",
    aspectRatio: "60 / 80",
    filter: `drop-shadow(0 0 10px rgb(0 0 0 / 0.5))`,
  });
  const shackle = lock.querySelector("[data-part=shackle]");
  const keyholeGlow = lock.querySelector("[data-part=keyhole-glow]");

  return (
    gsap
      .timeline()
      .fromTo(
        lock,
        { xPercent: -50, yPercent: -50, scale: 0.6, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.35, ease: "back.out(2)" },
        0,
      )
      .to(keyholeGlow, { opacity: 0.9, duration: 0.5, ease: "power1.in" }, 0.3)
      .to(lock, { keyframes: { rotation: [0, -7, 6, -4, 3, 0] }, transformOrigin: "50% 20%", duration: 0.4, ease: "none" }, 0.4)
      // Click: the shackle jumps free, then swings open on its long leg.
      .to(shackle, { y: -9, duration: 0.1, ease: "power4.out" }, CLICK)
      .to(shackle, { rotation: 32, svgOrigin: "43 38", duration: 0.5, ease: "back.out(3)" }, CLICK + 0.1)
      .to(lock, { keyframes: { scale: [1, 1.08, 1] }, duration: 0.3, ease: "power2.out" }, CLICK)
      .to(keyholeGlow, { opacity: 0, duration: 0.4 }, CLICK + 0.1)
      .add(
        sparkBurst(refs, measure, {
          colour,
          core: "#fff6d6",
          count: 14,
          origin: (box) => ({ x: box.focus.x, y: box.focus.y - box.unit * 0.05 }),
          angle: () => -90,
          spread: 200,
          distance: [0.12, 0.26],
          size: [5, 11],
          duration: [0.5, 0.9],
        }),
        CLICK,
      )
      .to(lock, { opacity: 0, y: -8, duration: 0.4, ease: "power1.in" }, DURATION - 0.4)
  );
};
