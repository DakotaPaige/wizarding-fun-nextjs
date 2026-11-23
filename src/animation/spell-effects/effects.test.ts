import { afterEach, describe, expect, it, vi } from "vitest";
import { castSpell } from "@/animation/cast";
import { gsap } from "@/animation/gsap";
import { CURATED_SPELLS, type SpellEffectKey } from "@/data/curated/spells";
import { SPELL_EFFECTS, type StageRefs } from "./index";

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

const KEYS = Object.keys(SPELL_EFFECTS) as SpellEffectKey[];
const colourOf = (key: SpellEffectKey) => CURATED_SPELLS.find((spell) => spell.effect === key)!.colour;

describe("signature spell effects", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("gives every spell its own effect", () => {
    expect(new Set(Object.values(SPELL_EFFECTS)).size).toBe(KEYS.length);
  });

  it.each(KEYS)("%s builds a 0.3–3 s timeline that leaves nothing visible behind", (key) => {
    const stage = makeStage();
    const tl = SPELL_EFFECTS[key](stage, colourOf(key));

    expect(tl).toBeInstanceOf(gsap.core.Timeline);
    expect(tl.duration()).toBeGreaterThanOrEqual(0.3);
    expect(tl.duration()).toBeLessThanOrEqual(3);

    const added = [...stage.fx.children];
    expect(added.length).toBeGreaterThan(0);
    tl.progress(1);
    for (const el of added) {
      if (!el.isConnected) continue;
      expect(Number(gsap.getProperty(el, "opacity"))).toBe(0);
    }
    tl.kill();
  });

  describe("lumos", () => {
    it("follows the pointer only while it plays", () => {
      const stage = makeStage();
      const add = vi.spyOn(stage.stage, "addEventListener");
      const remove = vi.spyOn(stage.stage, "removeEventListener");
      const tl = SPELL_EFFECTS.lumos(stage, colourOf("lumos"));
      expect(add).not.toHaveBeenCalled();

      tl.progress(0.5);
      expect(add).toHaveBeenCalledWith("pointermove", expect.any(Function));
      const listener = add.mock.calls[0]![1];

      tl.progress(1);
      expect(remove).toHaveBeenCalledWith("pointermove", listener);
      tl.kill();
    });

    it("stops following the pointer when a new cast interrupts it", () => {
      const stage = makeStage();
      const add = vi.spyOn(stage.stage, "addEventListener");
      const remove = vi.spyOn(stage.stage, "removeEventListener");
      const cast = castSpell(stage, { colour: colourOf("lumos"), effect: "lumos" }, null);
      cast.progress(0.5);
      const listener = add.mock.calls.find(([type]) => type === "pointermove")![1];

      const next = castSpell(stage, { colour: colourOf("accio"), effect: "accio" }, cast);
      expect(remove).toHaveBeenCalledWith("pointermove", listener);
      next.kill();
    });
  });

  describe("stupefy", () => {
    it("shudders the stage and puts it back when done", () => {
      const stage = makeStage();
      const tl = SPELL_EFFECTS.stupefy(stage, colourOf("stupefy"));
      expect(tl.getTweensOf(stage.stage).length).toBeGreaterThan(0);

      tl.progress(1);
      expect(gsap.getProperty(stage.stage, "x")).toBe(0);
      expect(stage.stage.style.transform).toBe("");
      tl.kill();
    });

    it("puts the stage back when a new cast interrupts the shudder", () => {
      const stage = makeStage();
      const cast = castSpell(stage, { colour: colourOf("stupefy"), effect: "stupefy" }, null);
      cast.progress(0.35);

      const next = castSpell(stage, { colour: colourOf("lumos"), effect: "lumos" }, cast);
      expect(stage.stage.style.transform).toBe("");
      next.kill();
    });
  });

  it("reparo mends 6–8 shards", () => {
    const stage = makeStage();
    const tl = SPELL_EFFECTS.reparo(stage, colourOf("reparo"));
    const shards = stage.fx.querySelectorAll("[data-shard]");
    expect(shards.length).toBeGreaterThanOrEqual(6);
    expect(shards.length).toBeLessThanOrEqual(8);
    tl.kill();
  });

  it("patronus draws the outline stag when no art is registered", () => {
    const stage = makeStage();
    const tl = SPELL_EFFECTS.patronus(stage, colourOf("patronus"));
    expect(stage.fx.querySelector("svg[data-stag]")).not.toBeNull();
    tl.kill();
  });
});
