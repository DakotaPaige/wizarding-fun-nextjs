import { gsap } from "@/animation/gsap";
import { addToFx } from "./fx";
import { addSvg, AT_FOCUS, glow, uid } from "./helpers";
import type { SpellEffect } from "./types";

/** An original vase silhouette in a 100 × 120 box: the whole object the shards rebuild. */
const VASE =
  "M38 6H62V14C62 20 56 22 56 28C56 34 84 44 84 74C84 100 68 114 50 114C32 114 16 100 16 74C16 44 44 34 44 28C44 22 38 20 38 14Z";

/** The crack: shards fan out from one point of impact to the edges of the box. */
const IMPACT = { x: 54, y: 70 };
const RIM = [
  [0, 0],
  [62, 0],
  [100, 34],
  [100, 98],
  [52, 120],
  [0, 112],
  [0, 46],
] as const;
const SHARDS = RIM.map((point, index) => {
  const next = RIM[(index + 1) % RIM.length]!;
  const centre = { x: (IMPACT.x + point[0] + next[0]) / 3, y: (IMPACT.y + point[1] + next[1]) / 3 };
  return { points: `${IMPACT.x},${IMPACT.y} ${point.join(",")} ${next.join(",")}`, centre };
});

const SCATTER = 0.3;
const MEND = 0.9;
const WHOLE = SCATTER + MEND + 0.15;
const DURATION = 2.4;

/**
 * Reparo: a vase lies in shards scattered about the focus; they spin back and lock into
 * place, the cracks vanish under a flash of green, and the mended vase fades.
 * Each shard is clipped by the vase outline, and the clip travels with the shard.
 */
export const reparo: SpellEffect = (refs, colour) => {
  const clip = uid("reparo-clip");
  const fill = uid("reparo-fill");
  const shards = SHARDS.map(
    ({ points }) =>
      `<g data-shard><polygon points="${points}" fill="url(#${fill})" stroke="${colour}" stroke-width="0.8" clip-path="url(#${clip})" /></g>`,
  ).join("");
  const object = addSvg(
    refs,
    "0 0 100 120",
    `<defs>
      <clipPath id="${clip}"><path d="${VASE}" /></clipPath>
      <linearGradient id="${fill}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f3fbf3" /><stop offset="1" stop-color="#9fd8a2" />
      </linearGradient>
    </defs>
    ${shards}
    <g data-part="whole" opacity="0">
      <path d="${VASE}" fill="url(#${fill})" />
      <path d="M20 66C38 72 62 72 80 66" stroke="${colour}" stroke-width="2" fill="none" />
    </g>`,
    { ...AT_FOCUS, width: "clamp(90px, 17%, 150px)", aspectRatio: "100 / 120" },
  );
  const pieces = Array.from(object.querySelectorAll<SVGGElement>("[data-shard]"));
  const whole = object.querySelector("[data-part=whole]");
  const flash = addToFx(refs, { ...AT_FOCUS, width: "220px", height: "220px", borderRadius: "50%", background: glow(colour) });
  const random = gsap.utils.random;

  const tl = gsap
    .timeline()
    .set(object, { xPercent: -50, yPercent: -50 }, 0)
    .to(object, { opacity: 1, duration: SCATTER, ease: "power1.out" }, 0);

  pieces.forEach((piece, index) => {
    const { centre } = SHARDS[index]!;
    // Thrown outward from the point of impact, 1.2–2× its distance from it, tumbling.
    const push = random(1.2, 2);
    tl.fromTo(
      piece,
      { x: (centre.x - IMPACT.x) * push + random(-10, 10), y: (centre.y - IMPACT.y) * push + random(-10, 10), rotation: random(-120, 120), svgOrigin: `${centre.x} ${centre.y}` },
      { x: 0, y: 0, rotation: 0, duration: MEND, ease: "expo.inOut" },
      SCATTER + index * 0.025,
    );
  });

  return tl
    .to(whole, { opacity: 1, duration: 0.2 }, WHOLE)
    .fromTo(
      flash,
      { xPercent: -50, yPercent: -50, scale: 0.3, opacity: 0.9 },
      { scale: 1.5, opacity: 0, duration: 0.6, ease: "power2.out", immediateRender: false },
      WHOLE - 0.05,
    )
    .to(object, { keyframes: { scale: [1, 1.06, 1] }, duration: 0.35, ease: "power2.out" }, WHOLE - 0.05)
    .to(object, { opacity: 0, duration: 0.5, ease: "power1.in" }, DURATION - 0.5);
};
