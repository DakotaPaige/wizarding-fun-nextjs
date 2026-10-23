import { describe, expect, it, vi } from "vitest";
import { gsap } from "@/animation/gsap";
import { getHouseInfo } from "@/data/curated/houses";
import { tweenPalette } from "./palette";
import { swapRoster } from "./roster-swap";

const cards = (count: number) => Array.from({ length: count }, () => document.createElement("li"));

describe("swapRoster", () => {
  it("kills the previous swap and returns a timeline that sweeps the old cards out and deals the new ones in", () => {
    const previous = gsap.timeline();
    const kill = vi.spyOn(previous, "kill");
    const outgoing = cards(6);
    const incoming = cards(6);

    const timeline = swapRoster(outgoing, incoming, previous);

    expect(kill).toHaveBeenCalledTimes(1);
    expect(timeline).toBeInstanceOf(gsap.core.Timeline);
    const targets = timeline.getChildren().flatMap((tween) => (tween as gsap.core.Tween).targets());
    expect(targets).toEqual(expect.arrayContaining([...outgoing, ...incoming]));
    // Dealt cards start hidden before the first paint.
    expect(gsap.getProperty(incoming[5]!, "opacity")).toBe(0);
    timeline.progress(1);
    expect(gsap.getProperty(outgoing[0]!, "opacity")).toBe(0);
    expect(gsap.getProperty(incoming[5]!, "opacity")).toBe(1);
  });

  it("deals in on its own when nothing is leaving", () => {
    const incoming = cards(3);
    const timeline = swapRoster([], incoming, null);
    expect(timeline.duration()).toBeGreaterThan(0);
  });
});

describe("tweenPalette", () => {
  it("tweens both house accent properties on the root", () => {
    const root = document.createElement("section");
    root.style.setProperty("--house-accent", "#C8423A");
    root.style.setProperty("--house-accent-2", "#D4A24C");

    const tween = tweenPalette(root, getHouseInfo("RAVENCLAW"));
    tween.progress(1);

    expect(tween.targets()).toEqual([root]);
    expect(root.style.getPropertyValue("--house-accent")).toMatch(/74,\s*120,\s*194|#4a78c2/i);
    expect(root.style.getPropertyValue("--house-accent-2")).toMatch(/176,\s*141,\s*87|#b08d57/i);
  });
});
