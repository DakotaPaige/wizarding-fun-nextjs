"use client";

import { useRef, useState, type CSSProperties } from "react";
import { castSpell } from "@/animation/cast";
import { gsap, ScrollTrigger, SplitText, useGSAP } from "@/animation/gsap";
import { prefersReducedMotion, withMotion } from "@/animation/motion";
import { Art } from "@/components/Art";
import type { SpellEffectKey } from "@/data/curated/spells";
import styles from "./spells.module.css";

export interface ClassroomSpell {
  id: string;
  name: string;
  description: string;
  colour: string;
  effect: SpellEffectKey;
}

interface SpellsProps {
  spells: ClassroomSpell[];
}

/**
 * The section pins only when it fits the viewport whole (keep in step with the CSS). Exactly
 * one of these matches in a browser, and neither in jsdom, so tests stay static.
 */
const PINNED = "(min-width: 640px) and (min-height: 720px)";
const UNPINNED = `not all and ${PINNED}`;

/**
 * The stage text writes itself in: the name letter by letter, then the description word by
 * word, timed to land with the bolt. Splits the `aria-hidden` visual copies only; the full
 * text sits beside them for screen readers. Call inside a GSAP context, which reverts the splits.
 */
function buildWriteIn(name: HTMLElement, description: HTMLElement): gsap.core.Timeline {
  const letters = SplitText.create(name, { type: "chars", aria: "none" }).chars;
  const words = SplitText.create(description, { type: "words", aria: "none" }).words;
  return gsap
    .timeline({ delay: 0.3, defaults: { ease: "power2.out" } })
    .fromTo(letters, { opacity: 0, x: -6 }, { opacity: 1, x: 0, duration: 0.35, stagger: 0.035 })
    .fromTo(words, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.4, stagger: { amount: 0.6 } }, "-=0.2");
}

/** An original wand: a banded handle and a tapering shaft, tip at the right-hand end. */
function WandShape() {
  return (
    <svg className={styles.wandSvg} viewBox="0 0 320 20" focusable="false">
      <path d="M7 3h83v14H7a7 7 0 0 1 0-14z" fill="#4a3424" />
      <rect x="20" y="3" width="4" height="14" fill="#2e2017" />
      <rect x="32" y="3" width="3" height="14" fill="#2e2017" />
      <rect x="78" y="3" width="5" height="14" fill="#2e2017" />
      <polygon points="90,4 317,8.6 317,11.4 90,16" fill="#7a5638" />
      <polyline points="94,7.2 300,9.3" stroke="rgba(255,255,255,0.2)" strokeWidth="1" fill="none" />
      <circle cx="317" cy="10" r="1.6" fill="#d9c7a8" />
    </svg>
  );
}

/**
 * The Classroom (spec §4.2): ten spells as toggle buttons beside a stage. Casting flicks the
 * wand, fires a bolt in the spell's colour and plays the spell's signature effect while its
 * name and description write in. The first spell casts itself once the whole stage is in
 * view; the section pins on screens big enough to show it whole. A new cast always replaces
 * the one in flight.
 */
export function Spells({ spells }: SpellsProps) {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const wand = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const fx = useRef<HTMLDivElement>(null);
  const nameText = useRef<HTMLSpanElement>(null);
  const descriptionText = useRef<HTMLSpanElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const hasCast = useRef(false);
  const [selected, setSelected] = useState(0);
  const [casts, setCasts] = useState(0);
  const current = spells[selected];

  /** Set once the stage mounts; buttons call it, and so does the auto-cast on arrival. */
  const cast = useRef<(index: number) => void>(null);

  useGSAP(
    (_context, contextSafe) => {
      // Last click wins: each cast kills the one before it, and the latest selection renders.
      // Context-safe, so a cast in flight is reverted with the component.
      const castAt = contextSafe!((index: number) => {
        const spell = spells[index];
        if (!spell) return;
        hasCast.current = true;
        setSelected(index);
        setCasts((count) => count + 1);
        timeline.current = castSpell(
          { stage: stage.current!, wand: wand.current!, tip: tip.current!, fx: fx.current! },
          { colour: spell.colour, effect: spell.effect },
          timeline.current,
          { reduced: prefersReducedMotion() },
        );
      });
      cast.current = castAt;

      gsap.matchMedia().add({ pinned: PINNED, unpinned: UNPINNED }, (context) => {
        const section = root.current;
        if (!section) return;
        if (context.conditions?.pinned) {
          ScrollTrigger.create({ trigger: section, start: "top top", end: "+=100%", pin: true });
        }
        ScrollTrigger.create({
          // Once the whole stage (caption included) is on screen, so the first cast is seen.
          trigger: stage.current,
          start: "bottom bottom",
          once: true,
          // Crossing a breakpoint rebuilds this trigger; only a first arrival auto-casts.
          onEnter: () => {
            if (!hasCast.current) castAt(0);
          },
        });
      });
      return () => {
        cast.current = null;
      };
    },
    { dependencies: [spells], scope: root, revertOnUpdate: true },
  );

  useGSAP(
    () => {
      if (casts === 0) return;
      withMotion(
        gsap.matchMedia(),
        () => {
          buildWriteIn(nameText.current!, descriptionText.current!);
        },
        () => {
          // The text simply swaps.
        },
      );
    },
    { dependencies: [casts], scope: root, revertOnUpdate: true },
  );

  if (!current) return null;

  return (
    <section ref={root} id="classroom" aria-labelledby="classroom-title" className={styles.section}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Chapter I · The Classroom</p>
          <h2 id="classroom-title" className={styles.title}>
            Ten spells worth knowing
          </h2>
        </header>

        <div className={styles.layout}>
          <ul className={styles.list} aria-label="Spells">
            {spells.map((spell, index) => (
              <li key={spell.id} className={styles.item}>
                <button
                  type="button"
                  className={styles.spell}
                  aria-pressed={index === selected}
                  style={{ "--spell": spell.colour } as CSSProperties}
                  onClick={() => cast.current?.(index)}
                >
                  <span className={styles.swatch} aria-hidden="true" />
                  {spell.name}
                </button>
              </li>
            ))}
          </ul>

          <div ref={stage} className={styles.stage}>
            <div className={styles.wandRest} aria-hidden="true">
              <div ref={wand} className={styles.wand}>
                <Art slot="spell.wand" sizes="(min-width: 640px) 320px, 40vw" fallback={<WandShape />} />
                <span ref={tip} className={styles.tip} />
              </div>
            </div>
            <div ref={fx} className={styles.fx} aria-hidden="true" />

            {/* Keyed per spell so React swaps whole elements and never edits text SplitText has split. */}
            <div className={styles.caption} aria-live="polite">
              <h3 key={`name-${current.id}`} className={styles.spellName}>
                <span className={styles.srOnly}>{current.name}</span>
                <span ref={nameText} aria-hidden="true">
                  {current.name}
                </span>
              </h3>
              <p key={`description-${current.id}`} className={styles.description}>
                <span className={styles.srOnly}>{current.description}</span>
                <span ref={descriptionText} aria-hidden="true">
                  {current.description}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
