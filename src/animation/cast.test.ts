import { afterEach, describe, expect, it, vi } from "vitest";
import { castSpell } from "@/animation/cast";
import { gsap } from "@/animation/gsap";
import type { StageRefs } from "@/animation/spell-effects";

function makeStage(): StageRefs {
  const stage = document.createElement("div");
  const wand = document.createElement("div");
  const tip = document.createElement("span");
  const fx = document.createElement("div");
  wand.append(tip);
  stage.append(wand, fx);
  document.body.append(stage);
  return { stage, wand, tip, fx };
}

const LUMOS = { colour: "#FFF1C1", effect: "lumos" } as const;

describe("castSpell", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("kills the previous cast and empties fx before playing the next", () => {
    const stage = makeStage();
    const leftover = document.createElement("div");
    stage.fx.append(leftover);
    const previous = gsap.timeline();
    const kill = vi.spyOn(previous, "kill");

    const next = castSpell(stage, LUMOS, previous);

    expect(kill).toHaveBeenCalledOnce();
    expect(stage.fx.contains(leftover)).toBe(false);
    expect(next).not.toBe(previous);
    next.kill();
  });

  it("returns the full sequence with three arguments: the wand flicks, then bolt and effect play", () => {
    const stage = makeStage();
    const tl = castSpell(stage, LUMOS, null);

    expect(tl).toBeInstanceOf(gsap.core.Timeline);
    expect(tl.getTweensOf(stage.wand).length).toBeGreaterThan(0);
    // Longer than the flick's wind-up and snap (0.36 s): the bolt and the effect follow it.
    expect(tl.duration()).toBeGreaterThan(0.5);
    tl.kill();
  });

  it("with reduced motion, skips the flick and bolt and plays a 0.3 s colour fade", () => {
    const stage = makeStage();
    const tl = castSpell(stage, LUMOS, null, { reduced: true });

    expect(tl.duration()).toBeCloseTo(0.3);
    expect(tl.getTweensOf(stage.wand)).toHaveLength(0);
    expect(stage.fx.children).toHaveLength(1);
    tl.kill();
  });
});
