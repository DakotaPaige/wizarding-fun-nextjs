"use client";

import { useId, useRef } from "react";
import { gsap, SplitText, useGSAP } from "@/animation/gsap";
import { withMotion } from "@/animation/motion";
import { Art } from "@/components/Art";
import { getArt } from "@/data/art-manifest";
import styles from "./quiz.module.css";

export const HAT_ATTRIBUTION = "— The Sorting Hat";

/** Seconds per character, shortened for long lines so none takes much over 3 s. */
const CHAR_STEP = 0.03;
const MAX_TYPE_SECONDS = 3.2;

/**
 * The Hat's line types itself in: each character snaps on at its own step (a stepped tween on
 * opacity, so the line's layout never shifts). Splits the `aria-hidden` visual copy only; the
 * full line sits beside it for screen readers. Call inside a GSAP context, which reverts the split.
 */
export function typeHatLine(visual: HTMLElement): gsap.core.Tween {
  const chars = SplitText.create(visual, { type: "words,chars", aria: "none" }).chars;
  const step = Math.min(CHAR_STEP, MAX_TYPE_SECONDS / Math.max(1, chars.length));
  return gsap.fromTo(chars, { opacity: 0 }, { opacity: 1, duration: step, ease: "steps(1)", stagger: step });
}

interface HatVoiceProps {
  line: string;
}

/**
 * The Sorting Hat as a voice: its latest line as a quote with the attribution. Hat art shows
 * only when the `quiz.hat` slot is registered. New lines are announced politely.
 */
export function HatVoice({ line }: HatVoiceProps) {
  const root = useRef<HTMLElement>(null);
  const visual = useRef<HTMLSpanElement>(null);
  const attribution = useId();

  useGSAP(
    () => {
      withMotion(
        gsap.matchMedia(),
        () => {
          if (visual.current) typeHatLine(visual.current);
        },
        () => {
          // Reduced motion: the whole line is simply there.
        },
      );
    },
    { dependencies: [line], scope: root, revertOnUpdate: true },
  );

  return (
    <figure ref={root} className={styles.hat} aria-labelledby={attribution}>
      <blockquote className={styles.hatQuote}>
        {/* Keyed per line so React swaps whole elements and never edits text SplitText has split. */}
        <span aria-live="polite">
          <span key={`sr-${line}`} className={styles.srOnly}>
            {line}
          </span>
        </span>
        <span key={`visual-${line}`} ref={visual} aria-hidden="true">
          “{line}”
        </span>
      </blockquote>
      <figcaption id={attribution} className={styles.attribution}>
        {HAT_ATTRIBUTION}
      </figcaption>
      {getArt("quiz.hat") && (
        <div className={styles.hatArt}>
          <Art slot="quiz.hat" fallback={null} sizes="(min-width: 900px) 360px, 80vw" />
        </div>
      )}
    </figure>
  );
}
