import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import charactersSnapshot from "@/data/snapshot/characters.json";
import type { CharacterRecord } from "@/data/types";
import type { GreatHallCharacter } from "./CharacterCard";
import { CharacterDetail } from "./CharacterDetail";

/** A roster member built from the snapshot, as the page query would return it. */
function fromSnapshot(name: string, initials: string): GreatHallCharacter {
  const raw = charactersSnapshot.find((c) => c.name === name);
  if (!raw) throw new Error(`${name} is not in the snapshot`);
  return { ...(raw as CharacterRecord), initials, portrait: null };
}

const MYRTLE = fromSnapshot("Moaning Myrtle", "MM");
const HERMIONE = fromSnapshot("Hermione Granger", "HG");

function renderDetail(character = MYRTLE) {
  const props = { onClose: vi.fn(), onPrev: vi.fn(), onNext: vi.fn() };
  render(
    <CharacterDetail
      character={character}
      house="RAVENCLAW"
      prevName="Padma Patil"
      nextName="Xenophilius Lovegood"
      {...props}
    />,
  );
  return props;
}

const dialog = () => screen.getByRole("dialog");
/** The value shown for a field, found through its term so the test reads like the panel. */
const field = (term: string) => within(dialog()).getByText(term, { selector: "dt" }).nextElementSibling as HTMLElement;

describe("CharacterDetail", () => {
  it("is a modal dialog labelled by the character's name", () => {
    renderDetail();
    expect(dialog()).toHaveAttribute("aria-modal", "true");
    expect(dialog()).toHaveAccessibleName("Moaning Myrtle");
    expect(within(dialog()).getByRole("heading", { name: "Moaning Myrtle" })).toBeInTheDocument();
  });

  it("renders Moaning Myrtle's patchy record gracefully", () => {
    expect(() => renderDetail(MYRTLE)).not.toThrow();
    expect(within(dialog()).getByRole("heading")).toHaveTextContent("Moaning Myrtle");
    for (const term of ["Wand", "Patronus", "Born"]) {
      expect(field(term)).toHaveTextContent("Unknown");
    }
    // Every missing value shares one muted style.
    const unknowns = within(dialog()).getAllByText("Unknown");
    expect(new Set(unknowns.map((el) => el.className)).size).toBe(1);
    expect(unknowns[0]!.className).not.toBe("");
    expect(within(dialog()).getByRole("img", { name: "Moaning Myrtle", hidden: true })).toBeInTheDocument();
    expect(field("Played by")).toHaveTextContent("Shirley Henderson");
    expect(field("Status")).toHaveTextContent("Deceased");
  });

  it("shows a complete record without any Unknown", () => {
    renderDetail(HERMIONE);
    expect(field("Born")).toHaveTextContent("19 Sep 1979");
    expect(field("Wand")).toHaveTextContent("Vine · dragon heartstring · 10¾ in");
    expect(field("Patronus")).toHaveTextContent(/otter/i);
    expect(field("Status")).toHaveTextContent("Alive");
    expect(within(dialog()).queryByText("Unknown")).toBeNull();
  });

  it("draws the wand only when the character has one with a length", () => {
    renderDetail(HERMIONE);
    expect(within(dialog()).getByRole("img", { name: "Vine · dragon heartstring · 10¾ in" })).toBeInTheDocument();
  });

  it("draws no wand for a character without one", () => {
    renderDetail(MYRTLE);
    expect(within(dialog()).queryByRole("img", { name: /in$/ })).toBeNull();
  });

  it("calls onNext and onPrev from the roster buttons", async () => {
    const user = userEvent.setup();
    const { onNext, onPrev } = renderDetail();
    await user.click(within(dialog()).getByRole("button", { name: /Next: Xenophilius Lovegood/ }));
    expect(onNext).toHaveBeenCalledTimes(1);
    await user.click(within(dialog()).getByRole("button", { name: /Previous: Padma Patil/ }));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it("calls onClose on Esc and from the close button", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDetail();
    expect(within(dialog()).getByRole("button", { name: "Close" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes from the × button", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDetail();
    await user.click(within(dialog()).getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps Tab and Shift+Tab inside the dialog", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Outside</button>
        <CharacterDetail character={MYRTLE} house="RAVENCLAW" onClose={vi.fn()} onPrev={vi.fn()} onNext={vi.fn()} />
      </>,
    );
    for (let i = 0; i < 6; i++) {
      await user.tab();
      expect(dialog()).toContainElement(document.activeElement as HTMLElement);
    }
    for (let i = 0; i < 6; i++) {
      await user.tab({ shift: true });
      expect(dialog()).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it("makes the background inert while open and restores it on unmount", () => {
    const outside = document.createElement("div");
    document.body.append(outside);
    const { unmount } = render(
      <CharacterDetail character={MYRTLE} house="RAVENCLAW" onClose={vi.fn()} onPrev={vi.fn()} onNext={vi.fn()} />,
    );
    expect(outside).toHaveAttribute("inert");
    expect(document.documentElement.style.overflow).toBe("hidden");
    unmount();
    expect(outside).not.toHaveAttribute("inert");
    expect(document.documentElement.style.overflow).toBe("");
    outside.remove();
  });
});
