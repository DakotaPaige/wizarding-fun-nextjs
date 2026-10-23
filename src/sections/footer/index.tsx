import { SITE } from "@/content/site";
import styles from "../placeholder.module.css";

/** Placeholder: the inked footer with the repeated map nav replaces this. */
export function FooterSection() {
  return (
    <footer className={styles.footer}>
      <h2 className={styles.heading}>Mischief managed.</h2>
      <p>
        Character and spell data from HP-API (hp-api.onrender.com). A fan project — not affiliated with or endorsed by
        Warner Bros. or J.K. Rowling.
      </p>
      <p>Made by {SITE.owner}.</p>
    </footer>
  );
}
