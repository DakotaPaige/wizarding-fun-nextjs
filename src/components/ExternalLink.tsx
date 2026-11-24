import type { AnchorHTMLAttributes } from "react";
import styles from "./ExternalLink.module.css";

type ExternalLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "target" | "rel"> & { href: string };

/**
 * A link that leaves the site: opens in a new tab, without handing the new page a reference to
 * this one (`noopener`) or our URL (`noreferrer`), and tells screen-reader users it will.
 */
export function ExternalLink({ children, ...props }: ExternalLinkProps) {
  return (
    <a {...props} target="_blank" rel="noopener noreferrer">
      {children} <span className={styles.hint}>(opens in a new tab)</span>
    </a>
  );
}
