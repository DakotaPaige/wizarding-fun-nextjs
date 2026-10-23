import { gsap } from "@/animation/gsap";
import { addSvg, AT_FOCUS, measureOnce, sparkBurst } from "./helpers";
import type { SpellEffect } from "./types";

/** An original feather: a curved vane either side of a quill shaft, with a few barb notches. */
const FEATHER = (colour: string) => `
  <path d="M20 4C31 20 35 50 28 80C26 90 23 98 20 104C17 98 14 90 12 80C5 50 9 20 20 4Z"
    fill="#f6f3ff" stroke="${colour}" stroke-width="1.2" />
  <path d="M20 6V116" stroke="#cfc4f2" stroke-width="1.6" stroke-linecap="round" />
  <path d="M20 30L30 22M20 46L32 37M20 62L31 54M20 38L10 30M20 56L8 47M20 74L11 67"
    stroke="${colour}" stroke-width="1" stroke-linecap="round" />
`;

const RISE = 1.3;
const BOB = 0.45;

/**
 * Wingardium Leviosa: a feather floats up from below the focus, swaying as it rises, then
 * bobs gently in the air before fading, with a few lilac motes lifting around it.
 */
export const leviosa: SpellEffect = (refs, colour) => {
  const measure = measureOnce(refs);
  const feather = addSvg(refs, "0 0 40 120", FEATHER(colour), {
    ...AT_FOCUS,
    width: "clamp(40px, 8%, 70px)",
    aspectRatio: "40 / 120",
    filter: `drop-shadow(0 0 10px ${colour})`,
  });

  return (
    gsap
      .timeline()
      .fromTo(
        feather,
        { xPercent: -50, yPercent: -50, y: () => measure().unit * 0.42, rotation: -28, opacity: 0 },
        { opacity: 1, duration: 0.3, immediateRender: false },
        0,
      )
      .to(feather, { y: 0, duration: RISE, ease: "sine.inOut" }, 0)
      .to(feather, { keyframes: { rotation: [-28, 16, -10, 6], xPercent: [-50, -5, -80, -50] }, duration: RISE, ease: "sine.inOut" }, 0)
      // Afloat: three slow bobs with a gentle rock.
      .to(feather, { y: () => -measure().unit * 0.045, rotation: -4, duration: BOB, ease: "sine.inOut", yoyo: true, repeat: 2 }, RISE)
      .add(
        sparkBurst(refs, measure, {
          colour,
          count: 9,
          origin: (box) => ({ x: box.focus.x, y: box.focus.y + box.unit * 0.12 }),
          angle: () => -90,
          spread: 120,
          distance: [0.08, 0.22],
          rise: 0.1,
          size: [5, 10],
          duration: [1, 1.5],
          stagger: 0.9,
          scale: [0.6, 1],
        }),
        0.4,
      )
      .to(feather, { opacity: 0, duration: 0.45, ease: "power1.in" }, RISE + BOB * 3 - 0.2)
  );
};
