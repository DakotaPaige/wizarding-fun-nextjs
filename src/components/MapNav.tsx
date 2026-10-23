"use client";

import { useEffect, useId, useRef, useState } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/animation/gsap";
import { withMotion } from "@/animation/motion";
import { MAP_SECTIONS, SITE } from "@/content/site";
import styles from "./MapNav.module.css";

/**
 * Slides the header out while scrolling down and back in on any scroll up.
 * It always shows near the top of the page and while `isPinned()` holds (the sheet is open).
 */
function createAutoHide(header: HTMLElement, duration: number, isPinned: () => boolean): ScrollTrigger {
  let hidden = false;
  const setHidden = (next: boolean) => {
    if (next === hidden) return;
    hidden = next;
    gsap.to(header, { yPercent: next ? -100 : 0, duration, ease: "power2.out", overwrite: true });
  };
  return ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate: (self) => {
      const pastHeader = self.scroll() > header.offsetHeight;
      setHidden(self.direction === 1 && pastHeader && !isPinned());
    },
  });
}

/** Site header: brand plus the map links. Below 640 px the links fold into a "Map" sheet. */
export function MapNav() {
  const root = useRef<HTMLElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  // Over the night sky the header drops its backing; most visits start at the top.
  const [overIntro, setOverIntro] = useState(true);
  const openRef = useRef(open);
  const sheetId = useId();

  useEffect(() => {
    openRef.current = open;
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  useGSAP(
    () => {
      const header = root.current;
      if (!header) return;
      const isPinned = () => openRef.current;
      withMotion(
        gsap.matchMedia(),
        () => {
          createAutoHide(header, 0.35, isPinned);
        },
        () => {
          createAutoHide(header, 0, isPinned);
        },
      );

      const intro = document.getElementById("top");
      if (intro) {
        const sync = (self: ScrollTrigger) => setOverIntro(self.isActive);
        ScrollTrigger.create({
          trigger: intro,
          start: "top bottom",
          end: () => `bottom top+=${header.offsetHeight}`,
          onToggle: sync,
          onRefresh: sync,
        });
      }
    },
    { scope: root },
  );

  return (
    <header ref={root} className={styles.header} data-over-intro={overIntro}>
      <a href="#top" className={styles.brand}>
        <svg className={styles.mark} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 1.5c.6 5.6 4.9 9.9 10.5 10.5-5.6.6-9.9 4.9-10.5 10.5C11.4 16.9 7.1 12.6 1.5 12 7.1 11.4 11.4 7.1 12 1.5z" />
        </svg>
        {SITE.title}
      </a>
      <nav aria-label="Map" className={styles.nav}>
        <button
          ref={button}
          type="button"
          className={styles.mapButton}
          aria-expanded={open}
          aria-controls={sheetId}
          onClick={() => setOpen((wasOpen) => !wasOpen)}
        >
          Map
        </button>
        <ul id={sheetId} className={styles.links} data-open={open}>
          {MAP_SECTIONS.map(({ id, label }) => (
            <li key={id}>
              <a href={`#${id}`} className={styles.link} onClick={() => setOpen(false)}>
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
