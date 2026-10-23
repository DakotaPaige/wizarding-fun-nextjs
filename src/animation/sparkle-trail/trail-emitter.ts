export interface TrailEmitter {
  /** Follows the pointer to (x, y), spawning sparkles along the way. */
  moveTo(x: number, y: number): void;
  /** Ends the stroke (pointer left, finger lifted): the next move starts fresh. */
  lift(): void;
}

/**
 * Turns pointer positions into evenly spaced sparkles: one per `spacing` px of travel.
 * Distance shorter than one spacing carries over to the next move, so slow movement
 * still leaves a trail; a long jump is capped at `maxPerMove` sparkles spread along it.
 */
export function createTrailEmitter(
  spawn: (x: number, y: number) => void,
  { spacing, maxPerMove }: { spacing: number; maxPerMove: number },
): TrailEmitter {
  let last: { x: number; y: number } | null = null;

  return {
    moveTo(x, y) {
      if (!last) {
        spawn(x, y);
        last = { x, y };
        return;
      }
      const dx = x - last.x;
      const dy = y - last.y;
      const distance = Math.hypot(dx, dy);
      const steps = Math.floor(distance / spacing);
      if (steps === 0) return;
      // Only the whole spacings are consumed; the remainder waits for the next move.
      const reach = (steps * spacing) / distance;
      const count = Math.min(maxPerMove, steps);
      const { x: fromX, y: fromY } = last;
      for (let i = 1; i <= count; i++) {
        const t = (reach * i) / count;
        spawn(fromX + dx * t, fromY + dy * t);
      }
      last = { x: fromX + dx * reach, y: fromY + dy * reach };
    },
    lift() {
      last = null;
    },
  };
}
