"use client";

import { useId, useRef, type CSSProperties } from "react";
import { gsap, useGSAP } from "@/animation/gsap";
import { withMotion } from "@/animation/motion";
import { HouseEmblem } from "@/components/HouseEmblem";
import { useHouseSelection } from "@/components/house-selection";
import { getHouseInfo } from "@/data/curated/houses";
import type { HouseName } from "@/data/types";
import { computePlayStats } from "@/quiz/sorting";
import type { PlayStats, TurnRecord } from "@/quiz/types";
import { HAT_ATTRIBUTION } from "./HatVoice";
import type { QuizResult } from "./useQuizGame";
import styles from "./quiz.module.css";

interface ResultProps {
  result: QuizResult;
  turns: TurnRecord[];
  onPlayAgain(): void;
}

interface StatRow {
  house: HouseName;
  label: string;
  /** 0–1, drawn as the bar's length. */
  fill: number;
}

const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : 0);

/** The four play-style stats behind the sorting formula, each with the house it feeds. */
function statRows(stats: PlayStats): StatRow[] {
  const risk = ratio(stats.pointsFromStrongTopicDares, stats.totalPoints);
  return [
    { house: "GRYFFINDOR", label: `Dares taken · ${stats.dares} of ${stats.turns}`, fill: ratio(stats.dares, stats.turns) },
    {
      house: "RAVENCLAW",
      label: `Hard questions right · ${stats.hardCorrect} of ${stats.hardAsked}`,
      fill: ratio(stats.hardCorrect, stats.hardAsked),
    },
    {
      house: "HUFFLEPUFF",
      label: `Longest steady streak · ${stats.longestStreak}`,
      fill: ratio(stats.longestStreak, stats.turns),
    },
    { house: "SLYTHERIN", label: `Points from calculated risks · ${Math.round(risk * 100)}%`, fill: risk },
  ];
}

/** Where each sparkle settles around the emblem (px from its centre), alternating the two house colours. */
const SPARKLES = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2 + (i % 2 ? 0.18 : -0.1);
  const radius = 132 + ((i * 37) % 5) * 9;
  return {
    dx: Math.round(Math.cos(angle) * radius * 0.9),
    dy: Math.round(Math.sin(angle) * radius),
    size: 5 + ((i * 3) % 5),
    second: i % 3 === 1,
  };
});

interface RevealTargets {
  emblem: Element;
  sparkles: Element[];
  details: Element[];
  bars: Element[];
}

/**
 * The house reveal (about 1.8 s): the emblem swells in, sparkles burst out from behind it to
 * their resting places, then the verdict and stats rise in and the stat bars grow. Transform and
 * opacity only; every target's resting state is its CSS, so reduced motion simply skips this.
 */
export function buildResultReveal({ emblem, sparkles, details, bars }: RevealTargets): gsap.core.Timeline {
  return gsap
    .timeline({ defaults: { ease: "power2.out" } })
    .fromTo(emblem, { opacity: 0, scale: 0.55, rotation: -8 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.8, ease: "back.out(1.7)" })
    .fromTo(
      sparkles,
      { x: 0, y: 0, scale: 0, opacity: 1 },
      {
        x: (i: number) => SPARKLES[i]!.dx,
        y: (i: number) => SPARKLES[i]!.dy,
        scale: 1,
        duration: 0.9,
        ease: "expo.out",
        stagger: { amount: 0.18, from: "random" },
        clearProps: "transform",
      },
      0.25,
    )
    .fromTo(sparkles, { opacity: 1 }, { opacity: 0.75, duration: 0.6, ease: "sine.inOut" }, 0.9)
    .fromTo(details, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.55, stagger: 0.08, clearProps: "transform" }, 0.35)
    .fromTo(bars, { scaleX: 0 }, { scaleX: (_i: number, el: HTMLElement) => Number(el.dataset.fill), duration: 0.8, stagger: 0.1, ease: "power3.out" }, 0.9);
}

/**
 * The Hat's decision (spec §4.4): the house emblem with a sparkle burst in house colours, the
 * verdict, the four stats behind it and the way on to the house's own table in the Great Hall.
 */
export function Result({ result, turns, onPlayAgain }: ResultProps) {
  const root = useRef<HTMLDivElement>(null);
  const { selectHouse } = useHouseSelection();
  const info = getHouseInfo(result.house);
  const stats = computePlayStats(turns);
  const statsTitle = useId();
  const attribution = useId();

  useGSAP(
    () => {
      withMotion(
        gsap.matchMedia(),
        () => {
          const q = gsap.utils.selector(root);
          buildResultReveal({
            emblem: q("[data-reveal='emblem']")[0]!,
            sparkles: q("[data-reveal='sparkle']"),
            details: q("[data-reveal='detail']"),
            bars: q("[data-reveal='bar']"),
          });
        },
        () => {
          // Reduced motion: everything is already at rest.
        },
      );
    },
    { scope: root },
  );

  return (
    <div
      ref={root}
      className={styles.result}
      style={{ "--result-accent": info.accent, "--result-accent-2": info.accent2 } as CSSProperties}
    >
      <div className={styles.reveal}>
        <div className={styles.burst} aria-hidden="true">
          {SPARKLES.map((sparkle, i) => (
            <span
              key={i}
              className={styles.sparkle}
              data-reveal="sparkle"
              style={
                {
                  "--dx": `${sparkle.dx}px`,
                  "--dy": `${sparkle.dy}px`,
                  "--size": `${sparkle.size}px`,
                  color: sparkle.second ? info.accent2 : info.accent,
                } as CSSProperties
              }
            />
          ))}
        </div>
        <div className={styles.revealEmblem} data-reveal="emblem">
          <HouseEmblem house={result.house} size={240} />
        </div>
      </div>

      <div className={styles.verdict}>
        <div className={styles.verdictHead} data-reveal="detail">
          <p className={styles.eyebrow}>The Hat has decided</p>
          <h3 className={styles.houseName} tabIndex={-1} data-autofocus>
            {info.displayName}!
          </h3>
        </div>

        <figure className={styles.verdictQuote} aria-labelledby={attribution} data-reveal="detail">
          <blockquote>
            <p>“{result.verdict}”</p>
          </blockquote>
          <figcaption id={attribution} className={styles.attribution}>
            {HAT_ATTRIBUTION}
          </figcaption>
        </figure>

        <div className={styles.stats} data-reveal="detail">
          <h4 id={statsTitle} className={styles.statsTitle}>
            How you played
          </h4>
          <ul className={styles.statList} aria-labelledby={statsTitle}>
            {statRows(stats).map((row) => {
              const yours = row.house === result.house;
              const rowInfo = getHouseInfo(row.house);
              return (
                <li key={row.house} className={styles.statRow}>
                  <span className={styles.statLabel}>{row.label}</span>
                  <span className={styles.statBar} aria-hidden="true">
                    <span
                      className={styles.statFill}
                      data-reveal="bar"
                      data-fill={row.fill}
                      style={{ "--fill": row.fill, background: rowInfo.accent } as CSSProperties}
                    />
                  </span>
                  <span className={styles.statHouse} data-yours={yours || undefined}>
                    {rowInfo.displayName}
                    {yours && (
                      <>
                        <span aria-hidden="true"> ★</span>
                        <span className={styles.srOnly}>(your house)</span>
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className={styles.finalScore}>Final score: {stats.totalPoints}</p>
        </div>

        <div className={styles.actions} data-reveal="detail">
          <button type="button" className={styles.primary} onClick={() => selectHouse(result.house, { scroll: true })}>
            Meet your housemates
          </button>
          <button type="button" className={styles.secondary} onClick={onPlayAgain}>
            Play again
          </button>
        </div>
      </div>
    </div>
  );
}
