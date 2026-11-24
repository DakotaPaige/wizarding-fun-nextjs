"use client";

import { useRef } from "react";
import { gsap, ScrollTrigger, SplitText, useGSAP } from "@/animation/gsap";
import { withMotion } from "@/animation/motion";
import { ExternalLink } from "@/components/ExternalLink";
import { refreshOnLayoutChange } from "@/animation/refresh-on-layout";
import { MAP_SECTIONS, SITE } from "@/content/site";
import styles from "./footer.module.css";

/**
 * "Mischief managed." writes in letter by letter, once, as the footer scrolls into view.
 * The quiz above changes height between phases, so triggers are refreshed whenever the page
 * height settles; otherwise the write-in would fire at a stale scroll position. Returns a cleanup.
 */
function createWriteIn(heading: HTMLElement, trigger: HTMLElement): () => void {
  const letters = SplitText.create(heading, { type: "chars", aria: "auto" }).chars;
  const write = gsap.fromTo(
    letters,
    { opacity: 0, x: -6 },
    { opacity: 1, x: 0, duration: 0.4, stagger: 0.06, ease: "power2.out", paused: true },
  );
  ScrollTrigger.create({ trigger, start: "top 85%", once: true, onEnter: () => void write.play() });
  return refreshOnLayoutChange(document.body);
}

/** The inked footer (spec §4.5): sign-off, repeated map, credit and disclaimer. */
export function Footer() {
  const root = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const { github, portfolio } = SITE.links;

  useGSAP(
    () => {
      withMotion(
        gsap.matchMedia(),
        () => createWriteIn(heading.current!, root.current!),
        () => {
          // The sign-off is simply there.
        },
      );
    },
    { scope: root },
  );

  return (
    <footer ref={root} className={styles.footer}>
      <div className={styles.inner}>
        <h2 ref={heading} className={styles.heading}>
          Mischief managed.
        </h2>

        <nav aria-label="Footer" className={styles.nav}>
          {MAP_SECTIONS.map(({ id, label }) => (
            <a key={id} href={`#${id}`} className={styles.link}>
              {label}
            </a>
          ))}
          <a href="#top" className={styles.link}>
            Back to the sky ↑
          </a>
        </nav>

        <div className={styles.colophon}>
          <p className={styles.disclaimer}>
            Character and spell data from Potter DB (potterdb.com), drawn from the Harry Potter Wiki (CC BY-SA);
            actor names from HP-API. A fan project — not affiliated with or endorsed by Warner Bros. or J.K. Rowling.
          </p>
          <ul className={styles.credit}>
            <li>Built by {SITE.owner}</li>
            {github && (
              <li>
                <ExternalLink href={github}>GitHub</ExternalLink>
              </li>
            )}
            {portfolio && (
              <li>
                <ExternalLink href={portfolio}>Portfolio</ExternalLink>
              </li>
            )}
          </ul>
        </div>
      </div>
    </footer>
  );
}
