import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { castSpell } from "@/animation/cast";
import { CURATED_SPELLS } from "@/data/curated/spells";
import { Spells, type ClassroomSpell } from "./Spells";

// The cast sequence is motion; these tests check the list, the stage text and how casts chain.
vi.mock("@/animation/cast", () => ({
  castSpell: vi.fn(() => ({ kill: vi.fn() })),
}));
const cast = vi.mocked(castSpell);

const SPELLS: ClassroomSpell[] = CURATED_SPELLS.map((spell) => ({
  id: spell.apiName.toLowerCase().replace(/\s+/g, "-"),
  name: spell.apiName,
  description: spell.descriptionOverride ?? `What ${spell.apiName} does.`,
  colour: spell.colour,
  effect: spell.effect,
}));

const spellButtons = () => screen.getAllByRole("button").filter((b) => b.hasAttribute("aria-pressed"));
const pressed = () => spellButtons().filter((b) => b.getAttribute("aria-pressed") === "true");
const stageHeading = () => screen.getByRole("heading", { level: 3 });

describe("Spells", () => {
  beforeEach(() => cast.mockClear());

  it("renders the ten spells as toggle buttons in curated order, the first pressed", () => {
    render(<Spells spells={SPELLS} />);
    const buttons = spellButtons();
    expect(buttons.map((b) => b.textContent)).toEqual(CURATED_SPELLS.map((s) => s.apiName));
    expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
    expect(pressed()).toHaveLength(1);
    expect(stageHeading()).toHaveAccessibleName("Lumos");
  });

  it("presses the clicked spell, names it on the stage and casts it", async () => {
    const user = userEvent.setup();
    render(<Spells spells={SPELLS} />);
    await user.click(screen.getByRole("button", { name: "Protego" }));

    expect(screen.getByRole("button", { name: "Protego" })).toHaveAttribute("aria-pressed", "true");
    expect(pressed()).toHaveLength(1);
    expect(stageHeading()).toHaveAccessibleName("Protego");
    // The copy screen readers get (the visual copy beside it is aria-hidden and split for motion).
    expect(screen.getByText(SPELLS[5]!.description, { ignore: "[aria-hidden='true']" })).toBeInTheDocument();
    expect(cast).toHaveBeenCalledTimes(1);
    expect(cast.mock.calls[0]![1]).toEqual({ colour: "#6CB6FF", effect: "protego" });
  });

  it("lets the last of several rapid clicks win, handing each cast the previous timeline", () => {
    render(<Spells spells={SPELLS} />);
    for (const name of ["Incendio", "Accio", "Reparo"]) {
      fireEvent.click(screen.getByRole("button", { name }));
    }

    expect(pressed()).toEqual([screen.getByRole("button", { name: "Reparo" })]);
    expect(stageHeading()).toHaveAccessibleName("Reparo");
    expect(cast).toHaveBeenCalledTimes(3);
    const returned = cast.mock.results.map((r) => r.value);
    expect(cast.mock.calls.map(([, spell]) => spell.effect)).toEqual(["incendio", "accio", "reparo"]);
    expect(cast.mock.calls[0]![2]).toBeNull();
    expect(cast.mock.calls[1]![2]).toBe(returned[0]);
    expect(cast.mock.calls[2]![2]).toBe(returned[1]);
  });
});
