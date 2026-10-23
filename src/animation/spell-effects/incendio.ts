import { gsap } from "@/animation/gsap";
import { addToFx } from "./fx";
import { glow, measureOnce, sparkBurst, type StageBox } from "./helpers";
import type { SpellEffect } from "./types";

const FLASH_SIZE = 90;

/** From the wand tip towards the effect focus, in degrees. */
const towardsFocus = ({ tip, focus }: StageBox) => (Math.atan2(focus.y - tip.y, focus.x - tip.x) * 180) / Math.PI;

/**
 * Incendio: the tip flares and pours out a jet of flame towards the focus — hot blobs that
 * swell, billow upward and burn out, blending into one fire — and a scatter of embers drifting higher.
 */
export const incendio: SpellEffect = (refs, colour) => {
  const measure = measureOnce(refs);
  const flash = addToFx(refs, {
    width: `${FLASH_SIZE}px`,
    height: `${FLASH_SIZE}px`,
    borderRadius: "50%",
    background: glow(colour, "#fff6d6"),
  });
  const fromTip = (box: StageBox) => box.tip;

  return gsap
    .timeline()
    .fromTo(
      flash,
      { x: () => measure().tip.x - FLASH_SIZE / 2, y: () => measure().tip.y - FLASH_SIZE / 2, scale: 0.3, opacity: 1 },
      { scale: 2.2, opacity: 0, duration: 0.45, ease: "power2.out", immediateRender: false },
      0,
    )
    .add(
      sparkBurst(refs, measure, {
        colour,
        core: "#ffe7a3",
        count: 34,
        origin: fromTip,
        angle: towardsFocus,
        spread: 40,
        distance: [0.22, 0.55],
        rise: 0.16,
        size: [22, 52],
        duration: [0.55, 0.95],
        stagger: 0.5,
        scale: [0.35, 1.6],
      }),
      0,
    )
    .add(
      sparkBurst(refs, measure, {
        colour: "#ff4d1f",
        core: colour,
        count: 14,
        origin: fromTip,
        angle: towardsFocus,
        spread: 28,
        distance: [0.15, 0.4],
        rise: 0.1,
        size: [16, 30],
        duration: [0.5, 0.8],
        stagger: 0.5,
        scale: [0.4, 1.3],
      }),
      0.05,
    )
    .add(
      sparkBurst(refs, measure, {
        colour,
        core: "#fff3c4",
        count: 12,
        origin: fromTip,
        angle: towardsFocus,
        spread: 70,
        distance: [0.45, 0.8],
        rise: 0.3,
        size: [4, 7],
        duration: [1, 1.4],
        stagger: 0.4,
        scale: [1, 0.4],
      }),
      0.1,
    );
};
