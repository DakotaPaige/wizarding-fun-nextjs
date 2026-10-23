import { gsap, SplitText } from "@/animation/gsap";

export interface IntroTimelineRefs {
  sky: Element;
  /** Individual stars, or the stars artwork as a single element. */
  stars: Element[];
  moon: Element;
  castle: Element;
  clouds: Element[];
  title: {
    /** The visible `h1`; split into letters for the reveal. */
    heading: HTMLElement;
    /** An `aria-hidden` gold copy laid over the heading; its letters flash as each one lands. */
    glint: HTMLElement;
  };
  tagline: Element;
  cue: Element;
}

/**
 * The intro's entrance (spec §4.1), about 3.5 s: sky fades up → stars twinkle on in a random
 * stagger → moon glows → castle rises → clouds drift in → the title shimmers in letter by
 * letter → tagline → scroll cue. Every target starts hidden in CSS (`data-enter`), so this
 * only tweens towards the resting state. Call inside a GSAP context: the SplitText
 * instances it creates are reverted with that context.
 */
export function buildIntroTimeline(refs: IntroTimelineRefs): gsap.core.Timeline {
  const { sky, stars, moon, castle, clouds, title, tagline, cue } = refs;
  const letters = SplitText.create(title.heading, { type: "chars", aria: "auto" }).chars;
  const glints = SplitText.create(title.glint, { type: "chars", aria: "none" }).chars;

  const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

  tl.fromTo(sky, { opacity: 0 }, { opacity: 1, duration: 1.1, ease: "power1.out" }, 0)
    .fromTo(
      stars,
      { opacity: 0, scale: 0.2 },
      { opacity: 1, scale: 1, duration: 0.45, stagger: { amount: 0.8, from: "random" } },
      0.35,
    )
    .fromTo(moon, { opacity: 0, scale: 0.82 }, { opacity: 1, scale: 1, duration: 1.1 }, 0.85)
    .fromTo(castle, { opacity: 0, yPercent: 22 }, { opacity: 1, yPercent: 0, duration: 1.1, ease: "power3.out" }, 1.15)
    .fromTo(
      clouds,
      { opacity: 0, x: (i: number) => (i % 2 === 0 ? -140 : 140) },
      { opacity: 1, x: 0, duration: 1.3, stagger: 0.15, ease: "power3.out" },
      1.5,
    )
    .set([title.heading, title.glint], { opacity: 1 }, 2)
    .fromTo(
      letters,
      { opacity: 0, yPercent: 45, rotationX: -75, transformPerspective: 600 },
      { opacity: 1, yPercent: 0, rotationX: 0, duration: 0.7, stagger: { amount: 0.45 }, ease: "back.out(1.6)" },
      2,
    )
    .set(glints, { opacity: 0 }, 0)
    .to(glints, { keyframes: { opacity: [0, 1, 0], ease: "none" }, duration: 0.9, stagger: { amount: 0.45 } }, 2.05)
    .fromTo(tagline, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7 }, 2.75)
    .fromTo(cue, { opacity: 0 }, { opacity: 1, duration: 0.5 }, 3);

  return tl;
}
