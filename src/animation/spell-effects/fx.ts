import type { StageRefs } from "./types";

/**
 * Adds an element to the stage's `fx` layer for a cast to animate: absolutely positioned at
 * the layer's top-left and hidden (`opacity: 0`) until a tween reveals it. `style` overrides
 * those defaults. `fx` is emptied before every cast, so nothing here needs cleaning up.
 */
export function addToFx({ fx }: StageRefs, style: Partial<CSSStyleDeclaration>): HTMLDivElement {
  const el = document.createElement("div");
  Object.assign(el.style, { position: "absolute", left: "0", top: "0", opacity: "0", ...style });
  fx.append(el);
  return el;
}
