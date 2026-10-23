import { gsap } from "@/animation/gsap";
import { getArt } from "@/data/art-manifest";
import { addToFx } from "./fx";
import { glow, tint, uid } from "./helpers";
import { EFFECT_FOCUS, type SpellEffect } from "./types";

/**
 * Our own outline stag in mid-gallop, facing right: forelegs reaching, hind legs driving,
 * antlers swept back. Drawn for this site — not traced from any film or brand artwork.
 */
const STAG = (colour: string, gradient: string) => `
  <defs>
    <linearGradient id="${gradient}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.55" />
      <stop offset="1" stop-color="${colour}" stop-opacity="0.12" />
    </linearGradient>
  </defs>
  <g fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M138 92L132 105L140 115L145 113L139 105L144 93" stroke-opacity="0.5" />
    <path d="M74 91L80 106L75 121L80 122L86 106L84 91" stroke-opacity="0.5" />
    <path fill="url(#${gradient})" d="M190 40L186 46L172 50L160 58L152 76L146 86L152 92L170 100L184 102L186 106
      L182 108L168 106L150 100L140 93L126 92L100 92L86 90L82 96L72 108L56 118L44 124L40 121L42 118L54 110
      L64 100L66 92L58 80L50 66L42 60L46 56L60 54L90 52L120 52L136 46L146 36L154 24L160 18L156 8L166 14
      L170 20L182 30Z" />
    <path d="M158 18C150 4 142 -6 128 -14M150 4L154 -12M143 -4L144 -20M136 -10L126 -24" />
    <path d="M163 17C162 2 168 -10 176 -20M164 4L176 -2M167 -7L180 -10" />
    <circle cx="176" cy="28" r="1.4" fill="#fff" stroke="none" />
  </g>
`;

const DURATION = 3;
const GALLOP = 2.6;
const STRIDE = 0.26;
const MOTES = 18;

/**
 * Expecto Patronum, the finale: a silvery stag gallops across the stage in a soft wash of
 * light, bounding stride by stride and shedding motes that drift up behind it. Uses the
 * `spell.patronusStag` art when the manifest has it, our outline stag otherwise.
 */
export const patronus: SpellEffect = (refs, colour) => {
  const { stage } = refs;
  const wash = addToFx(refs, {
    inset: "0",
    background: `radial-gradient(ellipse 80% 60% at 50% ${EFFECT_FOCUS.y * 100 + 10}%, ${tint(colour, 35)}, transparent 70%)`,
  });
  const runner = addToFx(refs, {
    top: `${EFFECT_FOCUS.y * 100 - 6}%`,
    width: "clamp(150px, 36%, 320px)",
    aspectRatio: "160 / 156",
    filter: `drop-shadow(0 0 8px ${colour}) drop-shadow(0 0 22px ${tint(colour, 60)})`,
  });
  const art = getArt("spell.patronusStag");
  if (art) {
    const image = document.createElement("img");
    Object.assign(image, { src: art.src, alt: "", width: art.width, height: art.height });
    Object.assign(image.style, { width: "100%", height: "100%", objectFit: "contain" });
    runner.append(image);
  } else {
    runner.innerHTML = `<svg data-stag viewBox="34 -28 160 156" width="100%" height="100%" overflow="visible" focusable="false">${STAG(colour, uid("patronus"))}</svg>`;
  }
  const body = runner.firstElementChild!;

  // Where the runner is at a moment of the gallop: from fully off the left to fully off the right.
  const across = (time: number) => {
    const width = stage.getBoundingClientRect().width;
    const own = runner.getBoundingClientRect().width;
    return -own + (time / GALLOP) * (width + own);
  };

  const tl = gsap
    .timeline()
    .to(wash, { keyframes: { opacity: [0, 0.9, 0.9, 0] }, duration: DURATION, ease: "none" }, 0)
    .fromTo(runner, { x: () => across(0), opacity: 0 }, { x: () => across(GALLOP), duration: GALLOP, ease: "none", immediateRender: false }, 0.2)
    .to(runner, { opacity: 1, duration: 0.3 }, 0.2)
    .to(runner, { opacity: 0, duration: 0.3 }, 0.2 + GALLOP - 0.3)
    // Each stride: a bound up with the chest lifting, a landing with the head dipping.
    .fromTo(
      body,
      { yPercent: 0, rotation: 0 },
      { yPercent: -9, rotation: -5, transformOrigin: "50% 70%", duration: STRIDE, ease: "sine.out", yoyo: true, repeat: Math.floor(GALLOP / STRIDE) - 1 },
      0.2,
    );

  for (let i = 0; i < MOTES; i += 1) {
    const size = gsap.utils.random(5, 11);
    const born = 0.35 + (i / MOTES) * (GALLOP - 0.75);
    const mote = addToFx(refs, { width: `${size}px`, height: `${size}px`, borderRadius: "50%", background: glow(colour) });
    // Shed from the stag's flank, then drifting back and up.
    const flank = () => {
      const own = runner.getBoundingClientRect();
      const box = stage.getBoundingClientRect();
      return {
        x: across(born - 0.2) + own.width * gsap.utils.random(0.25, 0.6),
        y: own.top - box.top + own.height * gsap.utils.random(0.45, 0.8),
      };
    };
    let start: { x: number; y: number } | null = null;
    const from = () => (start ??= flank());
    tl.fromTo(
      mote,
      { x: () => from().x, y: () => from().y, opacity: 0.9, scale: 1 },
      {
        x: () => from().x - gsap.utils.random(20, 60),
        y: () => from().y - gsap.utils.random(20, 70),
        opacity: 0,
        scale: 0.3,
        duration: 0.7,
        ease: "power1.out",
        immediateRender: false,
      },
      born,
    );
  }
  return tl;
};
