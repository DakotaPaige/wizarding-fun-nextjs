"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { gsap, useGSAP } from "@/animation/gsap";
import { prefersFullMotion, prefersReducedMotion } from "@/animation/motion";
import { HouseEmblem } from "@/components/HouseEmblem";
import { GREAT_HALL_ID, houseTabId as tabId, useHouseSelection } from "@/components/house-selection";
import { getHouseInfo } from "@/data/curated/houses";
import type { HouseName } from "@/data/types";
import type { PageDataQuery } from "@/graphql/generated/graphql";
import { CharacterCard, type GreatHallCharacter } from "./CharacterCard";
import { CharacterDetail } from "./CharacterDetail";
import { paletteVars, tweenPalette } from "./palette";
import { swapRoster } from "./roster-swap";
import styles from "./characters.module.css";

export type { GreatHallCharacter };
export type GreatHallHouse = PageDataQuery["houses"][number];

interface CharactersProps {
  houses: GreatHallHouse[];
}

const PANEL_ID = `${GREAT_HALL_ID}-panel`;

/** Where each tab key moves the selection, wrapping at the ends (ARIA tabs pattern). */
function targetIndex(key: string, index: number, count: number): number | null {
  switch (key) {
    case "ArrowRight":
      return (index + 1) % count;
    case "ArrowLeft":
      return (index - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/**
 * The Great Hall (spec §4.3): four house tabs over a house banner and its roster. The tabs
 * read and write the shared house selection, so the quiz result can pick a house too.
 *
 * React state alone decides what is selected and which cards the panel holds; animation never
 * does. A switch re-renders the panel with the new house at once. In a full-motion browser the
 * previous roster is kept as a hidden, inert layer for its sweep-out and dropped when the swap
 * completes; a switch mid-swap kills the one in flight, keeps any layers still leaving (so they
 * sweep on from where they are) and deals in the newest house. Without full motion there is no
 * outgoing layer: the roster and palette swap instantly (a short fade under reduced motion).
 *
 * A card opens that character's detail panel; previous/next walk the current house's roster
 * (wrapping at the ends) without closing it.
 */
export function Characters({ houses }: CharactersProps) {
  const root = useRef<HTMLElement>(null);
  const banner = useRef<HTMLDivElement>(null);
  const tabs = useRef(new Map<HouseName, HTMLButtonElement>());
  const swap = useRef<gsap.core.Timeline | null>(null);
  const { house, selectHouse } = useHouseSelection();
  const animatedHouse = useRef(house);
  // Set once for the first paint; after that GSAP owns the inline palette on the section.
  const [initialPalette] = useState(() => paletteVars(getHouseInfo(house)) as CSSProperties);

  // Track the selection during render so the outgoing layer appears in the same commit as the
  // new roster ("storing information from previous renders").
  const [shownHouse, setShownHouse] = useState(house);
  const [leaving, setLeaving] = useState<HouseName[]>([]);
  if (house !== shownHouse) {
    setShownHouse(house);
    setLeaving(prefersFullMotion() ? [...leaving.filter((h) => h !== house), shownHouse] : []);
  }

  useGSAP(
    () => {
      if (house === animatedHouse.current) return;
      animatedHouse.current = house;
      const section = root.current!;
      const incoming = gsap.utils.toArray<Element>('[data-roster="current"] > li', section);
      const outgoing = gsap.utils.toArray<Element>('[data-roster="leaving"] > li', section);
      const info = getHouseInfo(house);

      if (prefersFullMotion()) {
        swap.current = swapRoster(outgoing, incoming, swap.current);
        swap.current.eventCallback("onComplete", () => setLeaving([]));
        tweenPalette(section, info);
        if (banner.current) {
          gsap.fromTo(
            banner.current.children,
            { opacity: 0, y: 10 },
            { opacity: 1, y: 0, duration: 0.45, ease: "power2.out", stagger: 0.06, clearProps: "opacity,transform" },
          );
        }
        return;
      }

      swap.current?.kill();
      swap.current = null;
      gsap.set(section, { ...paletteVars(info), overwrite: true });
      if (prefersReducedMotion()) {
        gsap.fromTo(incoming, { opacity: 0 }, { opacity: 1, duration: 0.2, clearProps: "opacity" });
      }
    },
    { dependencies: [house], scope: root },
  );

  const current = houses.find((h) => h.name === house);

  const [openId, setOpenId] = useState<string | null>(null);
  const roster = current?.members ?? [];
  const openIndex = roster.findIndex((m) => m.id === openId);
  const neighbour = (step: 1 | -1) => roster[(openIndex + step + roster.length) % roster.length]!;
  const openCharacter = (character: GreatHallCharacter) => setOpenId(character.id);

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = targetIndex(event.key, index, houses.length);
    if (next === null) return;
    event.preventDefault();
    const nextHouse = houses[next]!.name;
    selectHouse(nextHouse);
    tabs.current.get(nextHouse)?.focus();
  }

  return (
    <section
      ref={root}
      id={GREAT_HALL_ID}
      aria-labelledby={`${GREAT_HALL_ID}-title`}
      className={styles.section}
      style={initialPalette}
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Chapter II · The Great Hall</p>
          <h2 id={`${GREAT_HALL_ID}-title`} className={styles.title}>
            Meet the houses
          </h2>
        </header>

        <div role="tablist" aria-label="Houses" className={styles.tablist}>
          {houses.map((h, index) => {
            const selected = h.name === house;
            return (
              <button
                key={h.name}
                ref={(el) => {
                  if (el) tabs.current.set(h.name, el);
                  else tabs.current.delete(h.name);
                }}
                type="button"
                role="tab"
                id={tabId(h.name)}
                aria-selected={selected}
                aria-controls={PANEL_ID}
                tabIndex={selected ? 0 : -1}
                className={styles.tab}
                style={{ "--tab-accent": getHouseInfo(h.name).accent } as CSSProperties}
                onClick={() => selectHouse(h.name)}
                onKeyDown={(event) => onTabKeyDown(event, index)}
              >
                <span className={styles.tabEmblem}>
                  <HouseEmblem house={h.name} size={40} />
                </span>
                {h.displayName}
              </button>
            );
          })}
        </div>

        {current && (
          <div role="tabpanel" id={PANEL_ID} aria-labelledby={tabId(house)} className={styles.panel}>
            <div className={styles.banner}>
              <div ref={banner} key={house} className={styles.bannerText}>
                <h3 className={styles.bannerTitle}>{current.displayName}</h3>
                <p className={styles.traits}>{current.traits.join(" · ")}</p>
              </div>
              <span key={`emblem-${house}`} className={styles.bannerEmblem}>
                <HouseEmblem house={house} size={96} />
              </span>
            </div>

            {/* One layer per house, in a fixed order so React keeps each layer's DOM (and its
                in-flight styles) when it turns from current to leaving or back. */}
            <div className={styles.rosterArea}>
              {houses.map((h) => {
                const isCurrent = h.name === house;
                if (!isCurrent && !leaving.includes(h.name)) return null;
                return (
                  <ul
                    key={h.name}
                    className={isCurrent ? styles.roster : `${styles.roster} ${styles.leaving}`}
                    data-roster={isCurrent ? "current" : "leaving"}
                    aria-label={isCurrent ? `${h.displayName} characters` : undefined}
                    aria-hidden={isCurrent ? undefined : true}
                    inert={!isCurrent}
                  >
                    {h.members.map((member) => (
                      <li key={member.id} className={styles.rosterItem}>
                        <CharacterCard character={member} onOpen={openCharacter} />
                      </li>
                    ))}
                  </ul>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {openIndex >= 0 && (
        <CharacterDetail
          character={roster[openIndex]!}
          house={house}
          prevName={neighbour(-1).name}
          nextName={neighbour(1).name}
          onClose={() => setOpenId(null)}
          onPrev={() => setOpenId(neighbour(-1).id)}
          onNext={() => setOpenId(neighbour(1).id)}
        />
      )}
    </section>
  );
}
