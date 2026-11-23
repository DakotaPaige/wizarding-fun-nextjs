import { ScrollTrigger } from "./gsap";

const SETTLE_MS = 150;

/**
 * Recomputes every ScrollTrigger's start/end once `target` changes height and settles.
 * ScrollTrigger only refreshes on window resize, so a section that grows or shrinks
 * (the quiz between phases) would otherwise leave triggers below it at stale positions.
 *
 * A refresh writes the scroll position, which cancels any smooth scroll in flight (e.g.
 * "Meet your housemates" switches house, resizing the page as it scrolls), so a pending
 * refresh also waits for scrolling to go quiet. Returns a cleanup.
 */
export function refreshOnLayoutChange(target: Element, refresh: () => void = () => ScrollTrigger.refresh()): () => void {
  if (typeof ResizeObserver === "undefined") return () => {};
  let height = target.getBoundingClientRect().height;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = () => {
    timer = undefined;
    refresh();
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(run, SETTLE_MS);
  };
  const observer = new ResizeObserver(() => {
    const next = target.getBoundingClientRect().height;
    if (next === height) return;
    height = next;
    schedule();
  });
  const onScroll = () => {
    if (timer !== undefined) schedule();
  };
  observer.observe(target);
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    observer.disconnect();
    window.removeEventListener("scroll", onScroll);
    clearTimeout(timer);
  };
}
