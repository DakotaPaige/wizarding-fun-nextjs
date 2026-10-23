import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HouseName } from "@/data/types";
import { HouseSelectionProvider, useHouseSelection } from "@/components/house-selection";
import { Characters, type GreatHallCharacter, type GreatHallHouse } from "./Characters";

const ROSTERS: Record<HouseName, [name: string, actor: string][]> = {
  GRYFFINDOR: [
    ["Harry Potter", "Daniel Radcliffe"],
    ["Hermione Granger", "Emma Watson"],
    ["Ron Weasley", "Rupert Grint"],
    ["Albus Dumbledore", "Richard Harris"],
    ["Minerva McGonagall", "Maggie Smith"],
    ["Neville Longbottom", "Matthew Lewis"],
  ],
  SLYTHERIN: [
    ["Draco Malfoy", "Tom Felton"],
    ["Severus Snape", "Alan Rickman"],
    ["Lord Voldemort", "Ralph Fiennes"],
    ["Bellatrix Lestrange", "Helena Bonham Carter"],
    ["Horace Slughorn", "Jim Broadbent"],
    ["Lucius Malfoy", "Jason Isaacs"],
  ],
  RAVENCLAW: [
    ["Luna Lovegood", "Evanna Lynch"],
    ["Cho Chang", "Katie Leung"],
    ["Filius Flitwick", "Warwick Davis"],
    ["Padma Patil", "Sharon Sandhu"],
    ["Moaning Myrtle", "Shirley Henderson"],
    ["Xenophilius Lovegood", "Rhys Ifans"],
  ],
  HUFFLEPUFF: [
    ["Cedric Diggory", "Robert Pattinson"],
    ["Nymphadora Tonks", "Natalia Tena"],
    ["Pomona Sprout", "Miriam Margolyes"],
    ["Newt Scamander", "Eddie Redmayne"],
    ["Hannah Abbott", "Charlotte Skeoch"],
    ["Ernie Macmillan", "Louis Doyle"],
  ],
};

function member(name: string, actor: string, house: HouseName): GreatHallCharacter {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    initials: name
      .split(" ")
      .map((word) => word[0])
      .slice(0, 2)
      .join(""),
    house,
    alternateNames: [],
    ancestry: null,
    patronus: null,
    actor,
    dateOfBirth: null,
    alive: true,
    eyeColour: null,
    hairColour: null,
    wand: null,
    portrait: null,
  };
}

const HOUSES: GreatHallHouse[] = (Object.keys(ROSTERS) as HouseName[]).map((name) => ({
  name,
  displayName: name.charAt(0) + name.slice(1).toLowerCase(),
  traits: ["Trait one", "trait two"],
  members: ROSTERS[name].map(([character, actor]) => member(character, actor, name)),
}));

/** Stands in for the quiz result, which picks a house through the shared context. */
function QuizResultStub() {
  const { selectHouse } = useHouseSelection();
  return (
    <button type="button" onClick={() => selectHouse("HUFFLEPUFF")}>
      Meet your housemates
    </button>
  );
}

function renderHall(onOpen = vi.fn()) {
  render(
    <HouseSelectionProvider>
      <Characters houses={HOUSES} onOpen={onOpen} />
      <QuizResultStub />
    </HouseSelectionProvider>,
  );
  return { onOpen };
}

const tab = (name: string) => screen.getByRole("tab", { name });
const panel = () => screen.getByRole("tabpanel");
const cards = () => within(panel()).getAllByRole("button");
const banner = () => within(panel()).getByRole("heading", { level: 3 });

/** A stand-in for `window.matchMedia` that reports the given motion preference. */
function emulateMotion(preference: "full" | "none") {
  vi.mocked(window.matchMedia).mockImplementation(
    (query: string) =>
      ({
        matches: preference === "full" && query.includes("no-preference"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  );
}

describe("Characters", () => {
  // Like the setup mock, match no query (so no motion runs) unless a test asks for it.
  afterEach(() => emulateMotion("none"));

  it("renders four house tabs with Gryffindor selected and its six cards", () => {
    renderHall();
    const tabs = within(screen.getByRole("tablist", { name: "Houses" })).getAllByRole("tab");
    ["Gryffindor", "Slytherin", "Ravenclaw", "Hufflepuff"].forEach((name, i) => expect(tabs[i]).toHaveAccessibleName(name));
    expect(tab("Gryffindor")).toHaveAttribute("aria-selected", "true");
    expect(tabs.filter((t) => t.getAttribute("aria-selected") === "true")).toHaveLength(1);
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1, -1]);
    expect(panel()).toHaveAccessibleName("Gryffindor");
    expect(banner()).toHaveTextContent("Gryffindor");
    expect(cards()).toHaveLength(6);
    expect(cards()[0]).toHaveAttribute("data-flip-id", "harry-potter");
  });

  it("moves focus and selection with the arrow, Home and End keys", async () => {
    const user = userEvent.setup();
    renderHall();
    await user.click(tab("Gryffindor"));

    await user.keyboard("{ArrowRight}");
    expect(tab("Slytherin")).toHaveFocus();
    expect(tab("Slytherin")).toHaveAttribute("aria-selected", "true");
    expect(tab("Slytherin")).toHaveAttribute("tabindex", "0");
    expect(banner()).toHaveTextContent("Slytherin");

    await user.keyboard("{End}");
    expect(tab("Hufflepuff")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(tab("Gryffindor")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(tab("Hufflepuff")).toHaveFocus();
    await user.keyboard("{Home}");
    expect(tab("Gryffindor")).toHaveFocus();
    expect(tab("Gryffindor")).toHaveAttribute("aria-selected", "true");
  });

  it("lets the last of two rapid tab clicks decide tabs, banner and roster", () => {
    renderHall();
    fireEvent.click(tab("Slytherin"));
    fireEvent.click(tab("Ravenclaw"));

    expect(tab("Ravenclaw")).toHaveAttribute("aria-selected", "true");
    expect(tab("Slytherin")).toHaveAttribute("aria-selected", "false");
    expect(banner()).toHaveTextContent("Ravenclaw");
    expect(within(panel()).getByRole("button", { name: /Luna Lovegood/ })).toBeInTheDocument();
    for (const [name] of ROSTERS.SLYTHERIN) {
      expect(within(panel()).queryByText(name)).toBeNull();
    }
    expect(cards()).toHaveLength(6);
  });

  it("with full motion, sweeps outgoing cards in a hidden layer and removes them once the swap ends", async () => {
    emulateMotion("full");
    renderHall();
    fireEvent.click(tab("Slytherin"));
    fireEvent.click(tab("Ravenclaw"));

    // Mid-swap the outgoing cards are decorative only: never focusable or announced.
    expect(tab("Ravenclaw")).toHaveAttribute("aria-selected", "true");
    expect(within(panel()).queryByRole("button", { name: /Draco Malfoy|Harry Potter/ })).toBeNull();
    expect(cards()).toHaveLength(6);

    await waitFor(() => expect(screen.queryByText("Harry Potter")).toBeNull(), { timeout: 3000 });
    for (const [name] of ROSTERS.SLYTHERIN) expect(screen.queryByText(name)).toBeNull();
    expect(within(panel()).getAllByText(/Lovegood/)).toHaveLength(2);
  });

  it("follows selectHouse from the shared context (the quiz result)", async () => {
    const user = userEvent.setup();
    renderHall();
    await user.click(screen.getByRole("button", { name: "Meet your housemates" }));

    expect(tab("Hufflepuff")).toHaveAttribute("aria-selected", "true");
    expect(banner()).toHaveTextContent("Hufflepuff");
    expect(within(panel()).getByRole("button", { name: /Cedric Diggory/ })).toBeInTheDocument();
  });

  it("renders the fallback card with initials for a member without a portrait", () => {
    renderHall();
    const card = within(panel()).getByRole("button", { name: /Neville Longbottom/ });
    expect(within(card).getByText("NL")).toBeInTheDocument();
    expect(within(card).getByText("Matthew Lewis")).toBeInTheDocument();
  });

  it("opens a character when its card is clicked", async () => {
    const user = userEvent.setup();
    const { onOpen } = renderHall();
    await user.click(within(panel()).getByRole("button", { name: /Hermione Granger/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0]![0]).toMatchObject({ id: "hermione-granger", name: "Hermione Granger" });
  });

  it("keeps the section landmark and heading order", () => {
    renderHall();
    const section = screen.getByRole("region", { name: "Meet the houses" });
    expect(section).toHaveAttribute("id", "great-hall");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Meet the houses");
    act(() => {
      fireEvent.click(tab("Ravenclaw"));
    });
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1);
  });
});
