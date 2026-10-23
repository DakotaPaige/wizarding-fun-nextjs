import { describe, expect, it } from "vitest";
import { createParticlePool, MAX_LIFETIME } from "./particle-pool";

describe("createParticlePool", () => {
  it("never holds more live particles than its size", () => {
    const pool = createParticlePool(120);
    for (let i = 0; i < 1000; i++) {
      pool.spawn(i, i);
      expect(pool.active).toBeLessThanOrEqual(120);
    }
    expect(pool.active).toBe(120);

    let visited = 0;
    pool.forEach(() => visited++);
    expect(visited).toBe(120);
  });

  it("retires particles once their lifetime has passed", () => {
    const pool = createParticlePool(16);
    for (let i = 0; i < 10; i++) pool.spawn(50, 50);
    expect(pool.active).toBe(10);

    pool.step(0.01);
    expect(pool.active).toBe(10);

    pool.step(MAX_LIFETIME);
    expect(pool.active).toBe(0);
    let visited = 0;
    pool.forEach(() => visited++);
    expect(visited).toBe(0);
  });

  it("reuses retired slots for new sparkles", () => {
    const pool = createParticlePool(4);
    for (let i = 0; i < 4; i++) pool.spawn(0, 0);
    pool.step(MAX_LIFETIME);
    pool.spawn(10, 20);
    expect(pool.active).toBe(1);
    pool.forEach((particle) => {
      expect(particle.x).toBe(10);
      expect(particle.y).toBe(20);
    });
  });
});
