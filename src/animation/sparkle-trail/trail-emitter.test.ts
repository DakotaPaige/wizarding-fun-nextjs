import { describe, expect, it, vi } from "vitest";
import { createTrailEmitter } from "./trail-emitter";

describe("createTrailEmitter", () => {
  it("spawns along slow movement by carrying the distance between moves", () => {
    const spawn = vi.fn();
    const emitter = createTrailEmitter(spawn, { spacing: 9, maxPerMove: 5 });
    emitter.moveTo(0, 0);
    expect(spawn).toHaveBeenCalledTimes(1);

    for (let x = 3; x <= 30; x += 3) emitter.moveTo(x, 0);
    // 30 px of travel in 3 px steps: one sparkle per 9 px.
    expect(spawn).toHaveBeenCalledTimes(1 + 3);
    expect(spawn).toHaveBeenLastCalledWith(27, 0);
  });

  it("fills a fast move with evenly spaced sparkles, up to the per-move cap", () => {
    const spawn = vi.fn();
    const emitter = createTrailEmitter(spawn, { spacing: 10, maxPerMove: 5 });
    emitter.moveTo(0, 0);
    emitter.moveTo(30, 0);
    expect(spawn.mock.calls.slice(1)).toEqual([
      [10, 0],
      [20, 0],
      [30, 0],
    ]);
    emitter.moveTo(1030, 0);
    expect(spawn).toHaveBeenCalledTimes(1 + 3 + 5);
  });

  it("starts a fresh stroke after lift", () => {
    const spawn = vi.fn();
    const emitter = createTrailEmitter(spawn, { spacing: 9, maxPerMove: 5 });
    emitter.moveTo(0, 0);
    emitter.lift();
    emitter.moveTo(100, 100);
    expect(spawn).toHaveBeenLastCalledWith(100, 100);
    expect(spawn).toHaveBeenCalledTimes(2);
  });
});
