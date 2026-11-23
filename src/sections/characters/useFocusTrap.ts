import { useEffect, useRef, type RefObject } from "react";

const TABBABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function tabbablesIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(TABBABLE)).filter((el) => !el.closest("[inert], [hidden]"));
}

interface FocusTrapOptions {
  /**
   * Where focus goes when the trap is released. Defaults to whatever was focused when it
   * engaged; return `null` to fall back to that element.
   */
  returnFocus?(): HTMLElement | null;
}

/**
 * Keeps keyboard focus inside `ref` while `active`: focus moves to its first tabbable element
 * on engage, Tab and Shift+Tab wrap at the ends, and focus that escapes (a click outside, a
 * programmatic jump) is pulled back. On release, focus returns to `returnFocus()` or to the
 * element that was focused before.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean, options: FocusTrapOptions = {}) {
  // Read at release time, so the caller can point it at whatever is current by then.
  const returnFocus = useRef(options.returnFocus);
  useEffect(() => {
    returnFocus.current = options.returnFocus;
  });

  useEffect(() => {
    const container = ref.current;
    if (!active || !container) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusFirst = () => (tabbablesIn(container)[0] ?? container).focus();
    if (!container.contains(document.activeElement)) focusFirst();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const tabbables = tabbablesIn(container!);
      if (tabbables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = tabbables[0]!;
      const last = tabbables[tabbables.length - 1]!;
      const current = document.activeElement;
      if (!container!.contains(current)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function onFocusIn(event: FocusEvent) {
      if (!container!.contains(event.target as Node)) focusFirst();
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      const target = returnFocus.current?.() ?? previous;
      target?.focus({ preventScroll: true });
    };
  }, [ref, active]);
}
