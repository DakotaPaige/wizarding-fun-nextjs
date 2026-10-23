import { gsap } from "@/animation/gsap";
import { createParticlePool } from "./particle-pool";

export interface SparkleTrailOptions {
  poolSize: number;
  /**
   * Whether the wand tip should be drawn at the mouse position — i.e. the system cursor is
   * hidden. Checked on each mouse move. Defaults to always.
   */
  showWandTip?: () => boolean;
}

export interface SparkleTrail {
  start(): void;
  stop(): void;
  destroy(): void;
}

const GOLD = "245, 196, 81";
const WHITE = "255, 248, 230";
/** One sparkle per this many px of pointer travel, capped per event so fast flicks stay cheap. */
const SPAWN_SPACING = 9;
const MAX_SPAWN_PER_EVENT = 5;
const SPRITE_SIZE = 32;
const MAX_DPR = 2;

/** Pre-renders a soft glow once so each frame is plain `drawImage` calls, with no gradients. */
function createGlowSprite(rgb: string): HTMLCanvasElement {
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = SPRITE_SIZE;
  const ctx = sprite.getContext("2d")!;
  const r = SPRITE_SIZE / 2;
  const glow = ctx.createRadialGradient(r, r, 0, r, r, r);
  glow.addColorStop(0, `rgba(${rgb}, 1)`);
  glow.addColorStop(0.18, `rgba(${rgb}, 0.85)`);
  glow.addColorStop(0.45, `rgba(${rgb}, 0.22)`);
  glow.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  return sprite;
}

/**
 * Draws a fading trail of sparkles behind the mouse or a finger, plus a glowing wand tip
 * that stands in for the hidden cursor. Input is read from the canvas's parent (the canvas
 * itself ignores the pointer). Frames run on `gsap.ticker` only while started, the tab is
 * visible and the canvas is on screen, and are skipped entirely when there's nothing to draw.
 */
export function createSparkleTrail(
  canvas: HTMLCanvasElement,
  { poolSize, showWandTip = () => true }: SparkleTrailOptions,
): SparkleTrail {
  const ctx = canvas.getContext("2d");
  const surface = canvas.parentElement;
  if (!ctx || !surface) return { start() {}, stop() {}, destroy() {} };

  const pool = createParticlePool(poolSize);
  // Indexed by `Particle.tint`.
  const sprites = [createGlowSprite(GOLD), createGlowSprite(WHITE)] as const;
  const tip = { x: 0, y: 0, visible: false, last: { x: 0, y: 0, set: false } };
  let rect = canvas.getBoundingClientRect();
  let rectStale = false;
  let dirty = true;
  let started = false;
  let onScreen = true;
  let ticking = false;
  let time = 0;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rectStale = true;
    dirty = true;
  };

  const toLocal = (clientX: number, clientY: number) => {
    if (rectStale) {
      rect = canvas.getBoundingClientRect();
      rectStale = false;
    }
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  /** Scatters sparkles along the segment since the last input so fast moves leave no gaps. */
  const trailTo = (x: number, y: number) => {
    const { last } = tip;
    if (!last.set) {
      pool.spawn(x, y);
    } else {
      const distance = Math.hypot(x - last.x, y - last.y);
      const count = Math.min(MAX_SPAWN_PER_EVENT, Math.floor(distance / SPAWN_SPACING));
      for (let i = 1; i <= count; i++) {
        const t = i / count;
        pool.spawn(last.x + (x - last.x) * t, last.y + (y - last.y) * t);
      }
    }
    last.x = x;
    last.y = y;
    last.set = true;
    dirty = true;
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    const { x, y } = toLocal(event.clientX, event.clientY);
    tip.x = x;
    tip.y = y;
    tip.visible = showWandTip();
    trailTo(x, y);
  };
  const onPointerLeave = () => {
    tip.visible = false;
    tip.last.set = false;
    dirty = true;
  };
  const onTouch = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (!touch) return;
    if (event.type === "touchstart") tip.last.set = false;
    const { x, y } = toLocal(touch.clientX, touch.clientY);
    trailTo(x, y);
  };
  const onTouchEnd = () => {
    tip.last.set = false;
  };
  const markRectStale = () => {
    rectStale = true;
  };

  const drawWandTip = () => {
    const { x, y } = tip;
    // A short wand shaft angled down-right from the tip, the way a wand is held.
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(20, 14, 10, 0.9)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + 2, y + 2);
    ctx.lineTo(x + 26, y + 26);
    ctx.stroke();
    ctx.strokeStyle = "#b58a55";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalCompositeOperation = "lighter";
    const pulse = 0.85 + Math.sin(time * 6) * 0.15;
    const size = 22 * pulse;
    ctx.drawImage(sprites[0], x - size / 2, y - size / 2, size, size);
    ctx.drawImage(sprites[1], x - 4, y - 4, 8, 8);
  };

  const render = (_time: number, deltaMs: number) => {
    const dt = Math.min(deltaMs, 50) / 1000;
    time += dt;
    pool.step(dt);
    const idle = pool.active === 0 && !tip.visible;
    if (idle && !dirty) return;
    dirty = !idle;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "lighter";
    pool.forEach((p) => {
      const fade = 1 - p.age / p.life;
      const flicker = 0.75 + 0.25 * Math.sin(time * 18 + p.phase);
      const size = p.size * 6 * (0.5 + fade * 0.5);
      ctx.globalAlpha = fade * fade * flicker;
      ctx.drawImage(sprites[p.tint], p.x - size / 2, p.y - size / 2, size, size);
    });
    ctx.globalAlpha = 1;
    if (tip.visible) drawWandTip();
  };

  const sync = () => {
    const shouldTick = started && onScreen && document.visibilityState === "visible";
    if (shouldTick === ticking) return;
    ticking = shouldTick;
    if (shouldTick) gsap.ticker.add(render);
    else gsap.ticker.remove(render);
  };

  const observer = new IntersectionObserver((entries) => {
    onScreen = entries.at(-1)?.isIntersecting ?? onScreen;
    sync();
  });
  const resizeObserver = new ResizeObserver(resize);

  surface.addEventListener("pointermove", onPointerMove, { passive: true });
  surface.addEventListener("pointerleave", onPointerLeave, { passive: true });
  surface.addEventListener("touchstart", onTouch, { passive: true });
  surface.addEventListener("touchmove", onTouch, { passive: true });
  surface.addEventListener("touchend", onTouchEnd, { passive: true });
  window.addEventListener("scroll", markRectStale, { passive: true });
  document.addEventListener("visibilitychange", sync);
  resizeObserver.observe(canvas);
  observer.observe(canvas);
  resize();

  return {
    start() {
      started = true;
      sync();
    },
    stop() {
      started = false;
      sync();
    },
    destroy() {
      started = false;
      sync();
      observer.disconnect();
      resizeObserver.disconnect();
      surface.removeEventListener("pointermove", onPointerMove);
      surface.removeEventListener("pointerleave", onPointerLeave);
      surface.removeEventListener("touchstart", onTouch);
      surface.removeEventListener("touchmove", onTouch);
      surface.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("scroll", markRectStale);
      document.removeEventListener("visibilitychange", sync);
    },
  };
}
