import { gsap } from "@/animation/gsap";
import type { HouseInfo } from "@/data/curated/houses";

/** Custom properties the Great Hall's background glow, banner and tabs are painted from. */
export function paletteVars(house: HouseInfo) {
  return { "--house-accent": house.accent, "--house-accent-2": house.accent2 };
}

/**
 * Blends the section into a house's palette by tweening its accent custom properties (GSAP
 * interpolates the colours). A newer blend overwrites one still in flight.
 */
export function tweenPalette(root: HTMLElement, house: HouseInfo): gsap.core.Tween {
  return gsap.to(root, {
    ...paletteVars(house),
    duration: 0.8,
    ease: "power2.inOut",
    overwrite: "auto",
  });
}
