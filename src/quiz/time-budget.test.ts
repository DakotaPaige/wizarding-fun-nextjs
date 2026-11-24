import { describe, expect, it } from "vitest";
import { aiTimeoutFor, AI_TIMEOUT_MS, MIN_AI_TIMEOUT_MS, REQUEST_DEADLINE_MS } from "./time-budget";

describe("aiTimeoutFor", () => {
  it("keeps the full 6 s while the request is young", () => {
    expect(AI_TIMEOUT_MS).toBe(6000);
    expect(REQUEST_DEADLINE_MS).toBe(8500);
    expect(aiTimeoutFor(0)).toBe(6000);
    expect(aiTimeoutFor(2500)).toBe(6000);
  });

  it("shrinks to what is left of the 8.5 s deadline", () => {
    expect(aiTimeoutFor(2501)).toBe(5999);
    // A slow data load that used a full 4 s of the budget.
    expect(aiTimeoutFor(4000)).toBe(4500);
    expect(aiTimeoutFor(7000)).toBe(MIN_AI_TIMEOUT_MS);
  });

  it("skips the AI when less than 1.5 s would remain", () => {
    expect(MIN_AI_TIMEOUT_MS).toBe(1500);
    expect(aiTimeoutFor(7001)).toBeNull();
    expect(aiTimeoutFor(9000)).toBeNull();
  });

  it("treats a clock that went backwards as no time spent, and junk as no time left", () => {
    expect(aiTimeoutFor(-50)).toBe(6000);
    expect(aiTimeoutFor(Number.NaN)).toBeNull();
  });

  it("keeps the worst case (elapsed + AI timeout) under the deadline", () => {
    for (let elapsed = 0; elapsed <= 9000; elapsed += 250) {
      const t = aiTimeoutFor(elapsed);
      if (t !== null) expect(elapsed + t).toBeLessThanOrEqual(REQUEST_DEADLINE_MS);
    }
  });
});
