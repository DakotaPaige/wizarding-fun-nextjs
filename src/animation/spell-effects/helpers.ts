import { gsap } from "@/animation/gsap";
import { addToFx } from "./fx";
import { EFFECT_FOCUS, type StageRefs } from "./types";

export interface Point {
  x: number;
  y: number;
}

/** The stage's size and key points in pixels, relative to its top-left corner. */
export interface StageBox {
  width: number;
  height: number;
  /** The stage's shorter side: distances scale by it so effects read at any stage size. */
  unit: number;
  focus: Point;
  tip: Point;
}

/**
 * Returns a measurer that reads the stage the first time it is called and then remembers it.
 * Call it from function-based tween values, so it runs when the tween starts — after the
 * flick has moved the wand — rather than when the timeline is built.
 */
export function measureOnce({ stage, tip }: StageRefs): () => StageBox {
  let box: StageBox | null = null;
  return () => {
    if (box) return box;
    const s = stage.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    box = {
      width: s.width,
      height: s.height,
      unit: Math.min(s.width, s.height),
      focus: { x: EFFECT_FOCUS.x * s.width, y: EFFECT_FOCUS.y * s.height },
      tip: { x: t.left + t.width / 2 - s.left, y: t.top + t.height / 2 - s.top },
    };
    return box;
  };
}

/** `left`/`top` that put an element's top-left on the effect focus; centre it with `xPercent/yPercent: -50`. */
export const AT_FOCUS = { left: `${EFFECT_FOCUS.x * 100}%`, top: `${EFFECT_FOCUS.y * 100}%` } as const;

/** A soft round glow: a bright core, then the spell's colour, fading to nothing. */
export function glow(colour: string, core = "#fff"): string {
  return `radial-gradient(circle, ${core} 0 12%, ${colour} 36%, transparent 70%)`;
}

/** `colour` at `percent`% strength, for translucent fills. */
export function tint(colour: string, percent: number): string {
  return `color-mix(in srgb, ${colour} ${percent}%, transparent)`;
}

let ids = 0;
/** A document-unique id for SVG `<defs>` (gradients, clip paths), since casts can overlap in the DOM. */
export function uid(prefix: string): string {
  ids += 1;
  return `${prefix}-${ids}`;
}

/**
 * Adds an SVG drawing to `fx`, wrapped in a div that `style` sizes and places. The SVG fills
 * the wrapper (give it an `aspectRatio` matching `viewBox`) and may draw outside it.
 */
export function addSvg(refs: StageRefs, viewBox: string, markup: string, style: Partial<CSSStyleDeclaration>) {
  const wrapper = addToFx(refs, style);
  wrapper.innerHTML = `<svg viewBox="${viewBox}" width="100%" height="100%" overflow="visible" focusable="false">${markup}</svg>`;
  return wrapper;
}

export interface BurstOptions {
  colour: string;
  /** Bright centre of each particle. */
  core?: string;
  count: number;
  /** Where the particles start (pixels in the stage box), measured when the burst starts. */
  origin: (box: StageBox) => Point;
  /** Direction of travel in degrees (0 = right, -90 = up), measured when the burst starts. */
  angle: (box: StageBox) => number;
  /** Total width of the cone particles fly out in, in degrees. */
  spread: number;
  /** Travel distance range, in stage units. */
  distance: [number, number];
  /** Extra upward drift added to every particle, in stage units (flames and sparks rise). */
  rise?: number;
  /** Particle diameter range in pixels. */
  size: [number, number];
  duration: [number, number];
  /** Particles start at random times in `[0, stagger]` seconds. */
  stagger?: number;
  /** Start and end scale of each particle. */
  scale?: [number, number];
}

/** A cone of glowing particles that fly out, slow down, shrink and fade. */
export function sparkBurst(refs: StageRefs, measure: () => StageBox, options: BurstOptions): gsap.core.Timeline {
  const { colour, core, count, origin, angle, spread, distance, rise = 0, size, duration, stagger = 0 } = options;
  const [scaleFrom, scaleTo] = options.scale ?? [1, 0.2];
  const random = gsap.utils.random;
  const tl = gsap.timeline();

  for (let i = 0; i < count; i += 1) {
    const diameter = random(size[0], size[1]);
    const offset = random(-spread / 2, spread / 2);
    const reach = random(distance[0], distance[1]);
    const time = random(duration[0], duration[1]);
    const at = random(0, stagger);
    const dot = addToFx(refs, {
      width: `${diameter}px`,
      height: `${diameter}px`,
      borderRadius: "50%",
      background: glow(colour, core),
      // Overlapping particles add up to a brighter glow, as light does.
      mixBlendMode: "screen",
    });
    const start = () => origin(measure());
    const heading = () => ((angle(measure()) + offset) * Math.PI) / 180;

    tl.fromTo(
      dot,
      { x: () => start().x - diameter / 2, y: () => start().y - diameter / 2, scale: scaleFrom, opacity: 1 },
      {
        x: () => start().x - diameter / 2 + Math.cos(heading()) * reach * measure().unit,
        y: () => start().y - diameter / 2 + (Math.sin(heading()) * reach - rise) * measure().unit,
        scale: scaleTo,
        duration: time,
        ease: "power3.out",
        immediateRender: false,
      },
      at,
    ).to(dot, { opacity: 0, duration: time, ease: "power2.in" }, at);
  }
  return tl;
}
