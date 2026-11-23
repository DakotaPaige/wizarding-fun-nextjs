import { gsap } from "@/animation/gsap";

/** How far into the sweep the first new card starts dealing in (s). */
const DEAL_OFFSET = 0.22;

/**
 * The Great Hall's house switch: the old roster sweeps off to the left in a stagger while the
 * new one deals in like cards — dropping, turning and settling one after another. Kills
 * `previous` first, so the last switch always wins; outgoing cards caught mid-flight carry on
 * from wherever they are. Transforms and opacity only.
 */
export function swapRoster(
  outEls: Element[],
  inEls: Element[],
  previous: gsap.core.Timeline | null,
): gsap.core.Timeline {
  previous?.kill();
  const timeline = gsap.timeline();

  if (outEls.length > 0) {
    timeline.to(outEls, {
      opacity: 0,
      xPercent: -45,
      yPercent: -6,
      rotation: -9,
      duration: 0.38,
      ease: "power2.in",
      stagger: 0.035,
    });
  }

  timeline.fromTo(
    inEls,
    { opacity: 0, yPercent: 22, xPercent: 12, rotation: 7, scale: 0.92 },
    {
      opacity: 1,
      yPercent: 0,
      xPercent: 0,
      rotation: 0,
      scale: 1,
      duration: 0.55,
      ease: "back.out(1.5)",
      stagger: 0.06,
      // Settled cards hand back clean styles (Task 16's Flip measures them).
      clearProps: "opacity,transform",
      immediateRender: true,
    },
    outEls.length > 0 ? DEAL_OFFSET : 0,
  );

  return timeline;
}
