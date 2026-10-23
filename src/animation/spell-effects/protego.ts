import { gsap } from "@/animation/gsap";
import { addToFx } from "./fx";
import { addSvg, AT_FOCUS, tint, uid } from "./helpers";
import type { SpellEffect } from "./types";

const SIZE = "clamp(150px, 34%, 300px)";
const RIPPLES = 3;
const DURATION = 2.1;

/** The shield: a bubble that's clear in the middle and bright at the rim, with a glint. */
const DOME = (colour: string, gradient: string) => `
  <defs>
    <radialGradient id="${gradient}">
      <stop offset="0.5" stop-color="${colour}" stop-opacity="0" />
      <stop offset="0.9" stop-color="${colour}" stop-opacity="0.32" />
      <stop offset="1" stop-color="#fff" stop-opacity="0.85" />
    </radialGradient>
  </defs>
  <circle cx="50" cy="50" r="48" fill="url(#${gradient})" />
  <circle cx="50" cy="50" r="48" fill="none" stroke="${colour}" stroke-width="1.2" />
  <g data-part="glint">
    <path d="M18 34A36 36 0 0 1 50 14" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity="0.85" />
    <path d="M82 66A36 36 0 0 1 64 84" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity="0.5" />
  </g>
`;

/**
 * Protego: a shield bubble springs up at the focus and shimmers — its glint sweeps round and
 * its light flickers — while rings ripple outward from it.
 */
export const protego: SpellEffect = (refs, colour) => {
  const dome = addSvg(refs, "0 0 100 100", DOME(colour, uid("protego")), {
    ...AT_FOCUS,
    width: SIZE,
    aspectRatio: "1",
    filter: `drop-shadow(0 0 14px ${tint(colour, 70)})`,
  });
  const glint = dome.querySelector("[data-part=glint]");
  const ripples = Array.from({ length: RIPPLES }, () =>
    addToFx(refs, {
      ...AT_FOCUS,
      width: SIZE,
      aspectRatio: "1",
      borderRadius: "50%",
      border: `2px solid ${colour}`,
      boxShadow: `0 0 12px ${tint(colour, 60)}`,
    }),
  );

  return gsap
    .timeline()
    .fromTo(
      dome,
      { xPercent: -50, yPercent: -50, scale: 0.2, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.55, ease: "back.out(1.7)" },
      0,
    )
    .to(glint, { rotation: 160, svgOrigin: "50 50", duration: DURATION, ease: "power1.inOut" }, 0)
    .to(dome, { keyframes: { opacity: [1, 0.75, 1, 0.8, 1] }, duration: 1, ease: "none" }, 0.55)
    .fromTo(
      ripples,
      { xPercent: -50, yPercent: -50, scale: 0.9, opacity: 0.9 },
      { scale: 2.3, opacity: 0, duration: 1, ease: "power2.out", stagger: 0.28, immediateRender: false },
      0.3,
    )
    .to(dome, { scale: 1.08, opacity: 0, duration: 0.5, ease: "power2.in" }, DURATION - 0.5);
};
