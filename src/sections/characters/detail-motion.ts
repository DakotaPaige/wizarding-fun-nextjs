import { Flip, gsap } from "@/animation/gsap";

/** The animated layers of the detail panel. */
export interface DetailParts {
  /** The dimming layer behind the panel. */
  backdrop: Element;
  /** The panel itself (the dialog); a bottom sheet slides this. */
  panel: HTMLElement;
  /** The panel's background, keyed by `data-flip-id`: it grows out of the card and back. */
  surface: Element;
  /** Everything readable in the panel; fades in once the surface has room. */
  content: Element;
}

const FLIP = { duration: 0.6, ease: "power3.inOut", scale: true } as const;
const FADE = 0.3;

/**
 * Full motion, open: the panel surface grows out of the card through `Flip.from` (matched by
 * `data-flip-id`), the card hides behind it and the content rises in as the surface lands.
 */
export function growFromCard(card: HTMLElement, { backdrop, surface, content }: DetailParts): gsap.core.Timeline {
  const cardState = Flip.getState(card);
  return gsap
    .timeline()
    .set(card, { opacity: 0 }, 0)
    .fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "power1.out" }, 0)
    .add(Flip.from(cardState, { targets: surface, ...FLIP }), 0)
    .fromTo(
      content,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.35, ease: "power2.out", clearProps: "opacity,transform" },
      0.4,
    );
}

/**
 * Full motion, close: the content fades, then the same `Flip.from` played backwards lands the
 * surface on the card, which fades back in under it as the surface lets go.
 */
export function shrinkIntoCard(card: HTMLElement, { backdrop, surface, content }: DetailParts): gsap.core.Timeline {
  const flip = Flip.from(Flip.getState(card), { targets: surface, ...FLIP });
  // Flip.from renders its start (the card's box) at once; hold it at its end until played back.
  flip.progress(1).pause();
  const landing = 0.05 + FLIP.duration;
  return gsap
    .timeline()
    .to(content, { opacity: 0, duration: 0.15, ease: "power1.in" }, 0)
    .add(flip.tweenFromTo(FLIP.duration, 0), 0.05)
    .to(backdrop, { opacity: 0, duration: 0.45, ease: "power1.in" }, 0.15)
    .to(surface, { opacity: 0, duration: 0.15, ease: "none" }, landing - 0.15)
    .to(card, { opacity: 1, duration: 0.2, ease: "none", clearProps: "opacity" }, landing - 0.2);
}

/** A bottom sheet dragged past its threshold: it slides on down from where the finger left it. */
export function dropSheet(card: HTMLElement | null, { backdrop, panel }: DetailParts): gsap.core.Timeline {
  const tl = gsap
    .timeline()
    .to(panel, { y: panel.offsetHeight, duration: 0.3, ease: "power2.in" }, 0)
    .to(backdrop, { opacity: 0, duration: 0.3, ease: "power1.in" }, 0);
  if (card) tl.to(card, { opacity: 1, duration: 0.2, clearProps: "opacity" }, 0.1);
  return tl;
}

/** A sheet released short of the threshold settles back into place. */
export function settleSheet(panel: HTMLElement): gsap.core.Tween {
  return gsap.to(panel, { y: 0, duration: 0.25, ease: "power2.out", clearProps: "transform" });
}

/** Reduced motion, open or close: Flip becomes a crossfade of the whole overlay. */
export function crossfade(overlay: Element, direction: "in" | "out"): gsap.core.Tween {
  return direction === "in"
    ? gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: FADE, ease: "none", clearProps: "opacity" })
    : gsap.to(overlay, { opacity: 0, duration: FADE, ease: "none" });
}

/**
 * Previous/next: the new character's content slides in from the side it came from (a plain
 * fade without full motion), and the card hidden behind the panel moves to the new character.
 */
export function swapCharacter(
  content: Element,
  step: 1 | -1,
  cards: { from: HTMLElement | null; to: HTMLElement | null },
  fullMotion: boolean,
): gsap.core.Timeline {
  const tl = gsap.timeline();
  if (fullMotion) {
    tl.fromTo(
      content,
      { opacity: 0, x: 24 * step },
      { opacity: 1, x: 0, duration: 0.35, ease: "power2.out", clearProps: "opacity,transform" },
    );
    if (cards.from) tl.set(cards.from, { clearProps: "opacity" }, 0);
    if (cards.to) tl.set(cards.to, { opacity: 0 }, 0);
  } else {
    tl.fromTo(content, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "none", clearProps: "opacity" });
  }
  return tl;
}
