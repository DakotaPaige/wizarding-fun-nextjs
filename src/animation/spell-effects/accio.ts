import { gsap } from "@/animation/gsap";
import { addToFx } from "./fx";
import { addSvg, glow, measureOnce, type Point, type StageBox } from "./helpers";
import type { SpellEffect } from "./types";

/** Small original objects to summon, each drawn in a 40 × 40 box. */
const OBJECTS = [
  // a book
  `<rect x="7" y="9" width="26" height="22" rx="2" fill="#7a4a32" /><rect x="10" y="12" width="21" height="16" fill="#efe3c8" /><rect x="7" y="9" width="5" height="22" fill="#5a3322" />`,
  // a key
  `<circle cx="12" cy="20" r="7" fill="none" stroke="#e8c45a" stroke-width="3.5" /><path d="M19 20h16M30 20v6M35 20v5" stroke="#e8c45a" stroke-width="3.5" stroke-linecap="round" />`,
  // a goblet
  `<path d="M10 7h20c0 10-4 15-10 15S10 17 10 7z" fill="#c9ced6" /><path d="M20 22v9M13 34h14" stroke="#c9ced6" stroke-width="3.5" stroke-linecap="round" />`,
  // a scroll
  `<rect x="9" y="10" width="22" height="20" fill="#efe3c8" /><rect x="6" y="7" width="28" height="5" rx="2.5" fill="#c8a978" /><rect x="6" y="28" width="28" height="5" rx="2.5" fill="#c8a978" /><path d="M13 17h14M13 22h10" stroke="#8a7458" stroke-width="1.5" />`,
  // a potion bottle
  `<path d="M16 6h8v8l7 9v10a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3V23l7-9z" fill="#4fd1c5" opacity="0.85" /><rect x="15" y="3" width="10" height="5" rx="1.5" fill="#8a5a3c" />`,
  // a ball
  `<circle cx="20" cy="20" r="12" fill="#c0392b" /><path d="M10 15c6 4 14 4 20 0" stroke="#f1d6a0" stroke-width="2" fill="none" />`,
];

/** Where each object starts, as fractions of the stage — just outside an edge. */
const STARTS: readonly Point[] = [
  { x: -0.08, y: 0.12 },
  { x: 0.4, y: -0.14 },
  { x: 0.92, y: -0.12 },
  { x: 1.1, y: 0.42 },
  { x: 1.08, y: 0.86 },
  { x: -0.1, y: 0.48 },
];

const FLIGHT = 1;
const STAGGER = 0.14;
const ARRIVE = FLIGHT + STAGGER * (OBJECTS.length - 1);
const GLOW_SIZE = 80;

/**
 * Accio: objects fly in from every edge of the stage, spinning, and are pulled faster and
 * smaller into the wand tip, which glows brighter as each one arrives.
 */
export const accio: SpellEffect = (refs, colour) => {
  const measure = measureOnce(refs);
  const tipGlow = addToFx(refs, {
    width: `${GLOW_SIZE}px`,
    height: `${GLOW_SIZE}px`,
    borderRadius: "50%",
    background: glow(colour),
  });
  const tl = gsap.timeline().fromTo(
    tipGlow,
    { x: () => measure().tip.x - GLOW_SIZE / 2, y: () => measure().tip.y - GLOW_SIZE / 2, scale: 0.4, opacity: 0 },
    { keyframes: { opacity: [0, 0.6, 0.9, 1, 0], scale: [0.4, 0.8, 1.1, 1.5, 2] }, duration: ARRIVE + 0.35, ease: "power1.in", immediateRender: false },
    0.4,
  );

  OBJECTS.forEach((markup, index) => {
    const object = addSvg(refs, "0 0 40 40", markup, {
      width: "clamp(34px, 7%, 56px)",
      aspectRatio: "1",
      filter: `drop-shadow(0 0 6px ${colour})`,
    });
    const start = STARTS[index]!;
    const from = (box: StageBox) => ({ x: start.x * box.width, y: start.y * box.height });
    const at = index * STAGGER;
    const spin = gsap.utils.random(-540, 540);

    tl.fromTo(
      object,
      { xPercent: -50, yPercent: -50, x: () => from(measure()).x, y: () => from(measure()).y, rotation: spin, scale: 1 },
      { x: () => measure().tip.x, y: () => measure().tip.y, rotation: 0, scale: 0.3, duration: FLIGHT, ease: "power2.in", immediateRender: false },
      at,
    )
      .to(object, { opacity: 1, duration: 0.2 }, at)
      .to(object, { opacity: 0, duration: 0.12 }, at + FLIGHT - 0.12);
  });

  return tl;
};
