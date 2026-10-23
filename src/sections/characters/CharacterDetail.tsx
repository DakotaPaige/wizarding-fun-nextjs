"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { gsap, useGSAP } from "@/animation/gsap";
import { prefersFullMotion, prefersReducedMotion } from "@/animation/motion";
import { Art } from "@/components/Art";
import { FallbackCard } from "@/components/FallbackCard";
import { getHouseInfo } from "@/data/curated/houses";
import type { HouseName } from "@/data/types";
import type { GreatHallCharacter } from "./CharacterCard";
import { crossfade, dropSheet, growFromCard, settleSheet, shrinkIntoCard, swapCharacter, type DetailParts } from "./detail-motion";
import { formatDate, formatField, formatWand, UNKNOWN } from "./format";
import { useFocusTrap } from "./useFocusTrap";
import styles from "./detail.module.css";

interface CharacterDetailProps {
  character: GreatHallCharacter;
  /** The roster's house, for the eyebrow and the panel's accent. */
  house: HouseName;
  /** Names for the roster-walking buttons. */
  prevName?: string;
  nextName?: string;
  /** Called once the panel has finished closing; the parent then unmounts it. */
  onClose(): void;
  onPrev(): void;
  onNext(): void;
}

/** Below this width the panel is a bottom sheet (matches the CSS breakpoint). */
const SHEET_QUERY = "(max-width: 639.98px)";
/** A sheet dragged down past this share of its height closes. */
const DRAG_CLOSE_RATIO = 0.3;

/** The roster card for a character: the element the panel grows out of and returns focus to. */
function findCard(id: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("button[data-flip-id]")).find((el) => el.dataset.flipId === id) ??
    null
  );
}

/**
 * While `active`, the rest of the page is inert (unreachable by keyboard, pointer and assistive
 * tech) and does not scroll; both are restored afterwards. A layout effect, so the background is
 * live again before the focus trap (a passive effect) hands focus back to the card.
 */
function useIsolatedBackground(host: RefObject<HTMLElement | null>, active: boolean) {
  useLayoutEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const saved = { overflow: root.style.overflow, paddingRight: root.style.paddingRight };
    const scrollbar = window.innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    // Keep the page from shifting sideways when its scrollbar disappears.
    if (scrollbar > 0) root.style.paddingRight = `${scrollbar}px`;

    const silenced = Array.from(document.body.children).filter(
      (el) => el !== host.current && !el.hasAttribute("inert"),
    );
    silenced.forEach((el) => el.setAttribute("inert", ""));
    return () => {
      root.style.overflow = saved.overflow;
      root.style.paddingRight = saved.paddingRight;
      silenced.forEach((el) => el.removeAttribute("inert"));
    };
  }, [host, active]);
}

/** A field's value, or the muted "Unknown" every missing value shares. */
function Value({ text }: { text: string }) {
  return text === UNKNOWN ? <span className={styles.unknown}>{UNKNOWN}</span> : <>{text}</>;
}

function Field({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <dt className={styles.term}>{term}</dt>
      <dd className={styles.value}>{children}</dd>
    </div>
  );
}

function EyesAndHair({ eyes, hair }: { eyes: string | null; hair: string | null }) {
  if (formatField(eyes) === UNKNOWN && formatField(hair) === UNKNOWN) return <Value text={UNKNOWN} />;
  return (
    <>
      <Value text={formatField(eyes)} /> · <Value text={formatField(hair)} />
    </>
  );
}

/**
 * A character's full record (spec §4.3): a modal dialog that grows out of its roster card with
 * GSAP Flip and shrinks back into it on Esc, × or a click on the backdrop. Below 640 px it is a
 * bottom sheet that also closes when dragged down past 30 % of its height. Previous/next walk the
 * roster without closing. Missing data renders as a muted "Unknown".
 *
 * Focus is trapped while open and returns to the card of whichever character is showing when it
 * closes. Without full motion the Flip becomes a crossfade (reduced motion) or nothing at all.
 */
export function CharacterDetail({ character, house, prevName, nextName, onClose, onPrev, onNext }: CharacterDetailProps) {
  const overlay = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const motion = useRef<gsap.core.Animation | null>(null);
  const shownId = useRef<string | null>(null);
  const step = useRef<1 | -1>(1);
  const drag = useRef<{ pointerId: number; startY: number; dy: number } | null>(null);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const info = getHouseInfo(house);
  const headingId = `character-detail-${character.id}-name`;

  const parts = (): DetailParts => ({
    backdrop: backdrop.current!,
    panel: panel.current!,
    surface: surface.current!,
    content: content.current!,
  });

  // Open, then follow previous/next. Runs before the background is isolated (declared first), so
  // the card is measured exactly where it sits.
  const { contextSafe } = useGSAP(
    () => {
      const previousId = shownId.current;
      shownId.current = character.id;
      const card = findCard(character.id);
      if (previousId === null) {
        if (prefersFullMotion() && card) motion.current = growFromCard(card, parts());
        else if (prefersReducedMotion()) motion.current = crossfade(overlay.current!, "in");
        return;
      }
      if (previousId === character.id) return;
      motion.current?.progress(1);
      motion.current = swapCharacter(
        content.current!,
        step.current,
        { from: findCard(previousId), to: card },
        prefersFullMotion(),
      );
    },
    { dependencies: [character.id], scope: overlay },
  );

  useIsolatedBackground(overlay, !closing);
  useFocusTrap(panel, !closing, { returnFocus: () => findCard(character.id) });

  /** Runs event-time animation work inside the GSAP context, so it is reverted with the panel. */
  const inContext = (work: () => void) => contextSafe(work)();

  function close(via: "flip" | "drag") {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    inContext(() => {
      motion.current?.kill();
      const card = findCard(character.id);
      let exit: gsap.core.Animation | null = null;
      if (prefersFullMotion()) {
        if (via === "drag") exit = dropSheet(card, parts());
        else if (card) exit = shrinkIntoCard(card, parts());
      } else if (prefersReducedMotion()) {
        exit = crossfade(overlay.current!, "out");
      }
      if (!exit) {
        onClose();
        return;
      }
      exit.eventCallback("onComplete", onClose);
      motion.current = exit;
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    close("flip");
  }

  function walk(direction: 1 | -1) {
    step.current = direction;
    if (direction === 1) onNext();
    else onPrev();
  }

  // ---- Bottom sheet: drag the grip down to close ----
  function onGripDown(event: PointerEvent<HTMLDivElement>) {
    if (closingRef.current || event.button !== 0 || !window.matchMedia(SHEET_QUERY).matches) return;
    // Taps on buttons in the grip (close) stay taps.
    if ((event.target as Element).closest("button, a")) return;
    motion.current?.progress(1);
    drag.current = { pointerId: event.pointerId, startY: event.clientY, dy: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onGripMove(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    current.dy = Math.max(0, event.clientY - current.startY);
    inContext(() => gsap.set(panel.current, { y: current.dy }));
  }

  function onGripUp(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.type === "pointerup" && current.dy > panel.current!.offsetHeight * DRAG_CLOSE_RATIO) close("drag");
    else if (current.dy > 0) inContext(() => (motion.current = settleSheet(panel.current!)));
  }

  const fallback = <FallbackCard name={character.name} initials={character.initials} house={character.house ?? house} />;

  return createPortal(
    <div
      ref={overlay}
      className={styles.overlay}
      style={{ "--house-accent": info.accent } as CSSProperties}
      inert={closing}
    >
      <div ref={backdrop} className={styles.backdrop} aria-hidden="true" onClick={() => close("flip")} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className={styles.panel}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div ref={surface} className={styles.surface} data-flip-id={character.id} aria-hidden="true" />
        <div ref={content} className={styles.content}>
          <button type="button" className={styles.close} aria-label="Close" onClick={() => close("flip")}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>

          <div
            className={styles.grip}
            onPointerDown={onGripDown}
            onPointerMove={onGripMove}
            onPointerUp={onGripUp}
            onPointerCancel={onGripUp}
          >
            <span className={styles.grabber} aria-hidden="true" />
            <div className={styles.portrait} aria-hidden="true">
              {character.portrait ? (
                <Art slot={`portrait.${character.id}`} sizes="(min-width: 640px) 340px, 96px" fallback={fallback} />
              ) : (
                fallback
              )}
            </div>
            <div className={styles.identity}>
              <p className={styles.eyebrow}>{info.displayName}</p>
              <h2 id={headingId} className={styles.name}>
                {character.name}
              </h2>
              {character.alternateNames.length > 0 && (
                <ul className={styles.aliases} aria-label="Also known as">
                  {character.alternateNames.map((alias) => (
                    <li key={alias} className={styles.alias}>
                      {alias}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <dl className={styles.facts}>
            <Field term="Ancestry">
              <Value text={formatField(character.ancestry)} />
            </Field>
            <Field term="Patronus">
              <Value text={formatField(character.patronus)} />
            </Field>
            <Field term="Played by">
              <Value text={formatField(character.actor)} />
            </Field>
            <Field term="Born">
              <Value text={formatDate(character.dateOfBirth)} />
            </Field>
            <Field term="Eyes · hair">
              <EyesAndHair eyes={character.eyeColour} hair={character.hairColour} />
            </Field>
            <Field term="Status">{character.alive ? "Alive" : "Deceased"}</Field>
          </dl>

          <dl className={styles.wand}>
            <Field term="Wand">
              <Value text={formatWand(character.wand)} />
            </Field>
            {/* Task 19 (stretch): the illustrated wand, drawn to length on a 0–15 in scale, goes here. */}
          </dl>

          <nav className={styles.walk} aria-label="Roster">
            <button
              type="button"
              className={styles.walkButton}
              aria-label={prevName ? `Previous: ${prevName}` : "Previous"}
              onClick={() => walk(-1)}
            >
              <span aria-hidden="true">←</span>
              {prevName ?? "Previous"}
            </button>
            <button
              type="button"
              className={styles.walkButton}
              aria-label={nextName ? `Next: ${nextName}` : "Next"}
              onClick={() => walk(1)}
            >
              {nextName ?? "Next"}
              <span aria-hidden="true">→</span>
            </button>
          </nav>
        </div>
      </div>
    </div>,
    document.body,
  );
}
