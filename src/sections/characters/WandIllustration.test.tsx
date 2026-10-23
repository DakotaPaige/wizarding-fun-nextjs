import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import charactersSnapshot from "@/data/snapshot/characters.json";
import { RawCharacterSchema } from "@/data/hp-api/schemas";
import { normaliseCharacter } from "@/data/normalise";
import type { Wand } from "@/data/types";
import { formatWand } from "./format";
import { WandIllustration } from "./WandIllustration";
import { DEFAULT_WOOD_TONE, WOOD_TONES, woodTone } from "./wand-woods";

const snapshotCharacters = charactersSnapshot.map((raw) => normaliseCharacter(RawCharacterSchema.parse(raw)));
const wandOf = (name: string): Wand => {
  const wand = snapshotCharacters.find((c) => c.name === name)?.wand;
  if (!wand) throw new Error(`${name} has no wand in the snapshot`);
  return wand;
};

const ratio = () => Number(screen.getByRole("img").getAttribute("data-ratio"));

describe("WandIllustration", () => {
  it("draws Hermione's 10.75 in wand at 10.75/15 of the track", () => {
    render(<WandIllustration wand={wandOf("Hermione Granger")} />);
    expect(ratio()).toBeCloseTo(0.7167, 3);
  });

  it("clamps Lucius's 18 in wand to the full track", () => {
    render(<WandIllustration wand={wandOf("Lucius Malfoy")} />);
    expect(ratio()).toBe(1);
  });

  it("is an image labelled with the wand's text line", () => {
    const wand = wandOf("Hermione Granger");
    render(<WandIllustration wand={wand} />);
    expect(screen.getByRole("img", { name: formatWand(wand) })).toBeInTheDocument();
  });

  it("draws nothing when the length is unknown", () => {
    const { container } = render(<WandIllustration wand={{ wood: "oak", core: null, lengthInches: null }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("tints the wand with its wood tone, or the default for an unlisted wood", () => {
    const { container, rerender } = render(<WandIllustration wand={{ wood: "Vine", core: null, lengthInches: 10 }} />);
    expect(container.querySelector("[data-part='wood']")).toHaveAttribute("fill", WOOD_TONES.vine);
    rerender(<WandIllustration wand={{ wood: "unobtainium", core: null, lengthInches: 10 }} />);
    expect(container.querySelector("[data-part='wood']")).toHaveAttribute("fill", DEFAULT_WOOD_TONE);
  });
});

describe("WOOD_TONES", () => {
  it("has a tone for every wood in the snapshot", () => {
    const woods = new Set(snapshotCharacters.flatMap((c) => (c.wand?.wood ? [c.wand.wood] : [])));
    expect(woods.size).toBeGreaterThan(10);
    for (const wood of woods) expect(WOOD_TONES, wood).toHaveProperty(wood.toLowerCase());
  });

  it("falls back to the default tone for a missing or unknown wood", () => {
    expect(woodTone(null)).toBe(DEFAULT_WOOD_TONE);
    expect(woodTone("unobtainium")).toBe(DEFAULT_WOOD_TONE);
  });
});
