/** Longest a sparkle can live, in seconds. */
export const MAX_LIFETIME = 1.1;
const MIN_LIFETIME = 0.55;
/** Sparkles drift downward like falling glitter (px/s²) and lose speed to air drag (per second). */
const GRAVITY = 42;
const DRAG = 1.8;

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds since spawn. */
  age: number;
  /** Seconds until retirement; 0 marks a free slot. */
  life: number;
  /** Radius in CSS pixels. */
  size: number;
  /** 0 = gold, 1 = white. */
  tint: 0 | 1;
  /** Random phase so neighbouring sparkles flicker out of step. */
  phase: number;
}

export interface ParticlePool {
  spawn(x: number, y: number): void;
  /** Advances every live particle by `dt` seconds and retires the expired ones. */
  step(dt: number): void;
  /** Visits live particles only. The particle objects are reused: don't keep references. */
  forEach(cb: (particle: Readonly<Particle>) => void): void;
  readonly active: number;
}

/**
 * A fixed-size pool: every particle is allocated up front and recycled, so the render loop
 * never allocates. When the pool is full, the next spawn overwrites the oldest slot.
 */
export function createParticlePool(size: number, random: () => number = Math.random): ParticlePool {
  const particles: Particle[] = Array.from({ length: size }, () => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    age: 0,
    life: 0,
    size: 0,
    tint: 0,
    phase: 0,
  }));
  let next = 0;
  let active = 0;

  return {
    spawn(x, y) {
      const p = particles[next]!;
      next = (next + 1) % size;
      if (p.life === 0) active++;
      const angle = random() * Math.PI * 2;
      const speed = 12 + random() * 48;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 18;
      p.age = 0;
      p.life = MIN_LIFETIME + random() * (MAX_LIFETIME - MIN_LIFETIME);
      p.size = 1 + random() * 2.5;
      p.tint = random() < 0.7 ? 0 : 1;
      p.phase = random() * Math.PI * 2;
    },

    step(dt) {
      if (active === 0) return;
      const damping = Math.max(0, 1 - DRAG * dt);
      for (const p of particles) {
        if (p.life === 0) continue;
        p.age += dt;
        if (p.age >= p.life) {
          p.life = 0;
          active--;
          continue;
        }
        p.vy += GRAVITY * dt;
        p.vx *= damping;
        p.vy *= damping;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    },

    forEach(cb) {
      if (active === 0) return;
      for (const p of particles) if (p.life !== 0) cb(p);
    },

    get active() {
      return active;
    },
  };
}
