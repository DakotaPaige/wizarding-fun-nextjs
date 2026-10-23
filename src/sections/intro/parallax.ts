import { gsap } from "@/animation/gsap";

export type ParallaxSource = "pointer" | "tilt" | "drag";

export interface ParallaxLayer {
  el: HTMLElement;
  /** 0 = pinned to the horizon, 1 = moves the full range. */
  depth: number;
}

export interface Parallax {
  setSource(source: ParallaxSource): void;
  destroy(): void;
}

/** How far (px) a depth-1 layer travels from centre. Layers overscan by this much in CSS. */
export const PARALLAX_RANGE = 60;
/** Degrees of tilt away from the starting pose that reach the edge of the range. */
const TILT_RANGE = 22;

const clamp = (value: number) => Math.max(-1, Math.min(1, value));

type DeviceOrientationWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<string>;
};

/**
 * Asks for motion-sensor access where the browser requires it (iOS Safari). It must be
 * called from a user gesture. Resolves `false` — quietly, never throwing — when the
 * sensor API is missing or the user declines, so callers can fall back to dragging.
 */
export async function requestTiltPermission(): Promise<boolean> {
  if (typeof DeviceOrientationEvent === "undefined") return false;
  const { requestPermission } = DeviceOrientationEvent as DeviceOrientationWithPermission;
  if (typeof requestPermission !== "function") return true;
  try {
    return (await requestPermission()) === "granted";
  } catch {
    return false;
  }
}

/**
 * Moves each layer opposite the input, scaled by its depth, so nearer layers shift more.
 * Input comes from one source at a time: the mouse, device tilt, or a touch drag across
 * `surface`. In tilt mode, dragging keeps working until the first real sensor reading
 * arrives, so a device that grants permission but never reports still responds.
 */
export function createParallax(
  layers: ParallaxLayer[],
  { surface = document.body }: { surface?: HTMLElement } = {},
): Parallax {
  const movers = layers.map(({ el, depth }) => ({
    depth,
    x: gsap.quickTo(el, "x", { duration: 0.9, ease: "power3.out" }),
    y: gsap.quickTo(el, "y", { duration: 0.9, ease: "power3.out" }),
  }));

  /** `nx`/`ny` in [-1, 1]: where the viewer is "looking" from the centre. */
  const aim = (nx: number, ny: number) => {
    for (const mover of movers) {
      mover.x(-nx * mover.depth * PARALLAX_RANGE);
      mover.y(-ny * mover.depth * PARALLAX_RANGE);
    }
  };

  let current: ParallaxSource | null = null;
  let detachers: (() => void)[] = [];

  const listen = <K extends keyof WindowEventMap>(
    target: Window | HTMLElement,
    type: K,
    handler: (event: WindowEventMap[K]) => void,
  ) => {
    const options = { passive: true };
    target.addEventListener(type, handler as EventListener, options);
    const detach = () => target.removeEventListener(type, handler as EventListener);
    detachers.push(detach);
    return detach;
  };

  const detachAll = () => {
    for (const detach of detachers) detach();
    detachers = [];
  };

  function attachPointer() {
    listen(window, "pointermove", (event) => {
      if (event.pointerType === "touch") return;
      aim((event.clientX / window.innerWidth) * 2 - 1, (event.clientY / window.innerHeight) * 2 - 1);
    });
    // Leaving the window settles the scene back to centre.
    listen(document.documentElement, "pointerleave", () => aim(0, 0));
  }

  function attachDrag() {
    const detachments: (() => void)[] = [];
    let startX = 0;
    let startY = 0;
    detachments.push(
      listen(surface, "touchstart", (event) => {
        const touch = event.touches[0];
        if (!touch) return;
        startX = touch.clientX;
        startY = touch.clientY;
      }),
      listen(surface, "touchmove", (event) => {
        const touch = event.touches[0];
        if (!touch) return;
        aim(
          clamp(((touch.clientX - startX) / window.innerWidth) * 2),
          clamp(((touch.clientY - startY) / window.innerHeight) * 2),
        );
      }),
      listen(surface, "touchend", () => aim(0, 0)),
      listen(surface, "touchcancel", () => aim(0, 0)),
    );
    return () => detachments.forEach((detach) => detach());
  }

  function attachTilt() {
    let detachDrag: (() => void) | null = attachDrag();
    let base: { beta: number; gamma: number } | null = null;
    listen(window, "deviceorientation", ({ beta, gamma }) => {
      if (beta === null || gamma === null) return;
      if (!base) {
        base = { beta, gamma };
        detachDrag?.();
        detachDrag = null;
      }
      const forward = (beta - base.beta) / TILT_RANGE;
      const sideways = (gamma - base.gamma) / TILT_RANGE;
      // The sensor axes are fixed to the device; swap them when the screen is rotated.
      const angle = screen.orientation?.angle ?? 0;
      if (angle === 90) aim(clamp(forward), clamp(-sideways));
      else if (angle === 270) aim(clamp(-forward), clamp(sideways));
      else aim(clamp(sideways), clamp(forward));
    });
  }

  return {
    setSource(source) {
      if (source === current) return;
      detachAll();
      current = source;
      aim(0, 0);
      if (source === "pointer") attachPointer();
      else if (source === "drag") attachDrag();
      else attachTilt();
    },
    destroy() {
      detachAll();
      current = null;
    },
  };
}
