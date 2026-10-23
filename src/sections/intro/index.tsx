import { SITE } from "@/content/site";
import styles from "../placeholder.module.css";

/** Placeholder: the night-sky intro replaces this. Holds the page's only h1. */
export function IntroSection() {
  return (
    <section id="top" aria-labelledby="intro-title" className={`${styles.section} ${styles.intro}`}>
      <h1 id="intro-title" className={styles.title}>
        {SITE.title}
      </h1>
      <p className={styles.tagline}>{SITE.tagline}</p>
    </section>
  );
}
