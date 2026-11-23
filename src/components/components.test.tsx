import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { Art } from "@/components/Art";
import { FallbackCard } from "@/components/FallbackCard";
import { HouseEmblem } from "@/components/HouseEmblem";
import { HouseSelectionProvider, useHouseSelection } from "@/components/house-selection";
import { MapNav } from "@/components/MapNav";

describe("HouseEmblem", () => {
  it("renders the house initial and stays hidden from assistive tech", () => {
    const { container } = render(<HouseEmblem house="RAVENCLAW" size={40} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveTextContent("R");
  });
});

describe("FallbackCard", () => {
  it("shows the initials and labels the card with the character's name", () => {
    render(<FallbackCard name="Luna Lovegood" initials="LL" house="RAVENCLAW" />);
    expect(screen.getByRole("img", { name: "Luna Lovegood" })).toHaveTextContent("LL");
  });
});

describe("Art", () => {
  it("renders its fallback when the slot has no registered asset", () => {
    render(<Art slot="portrait.unknown" fallback={<p>No art yet</p>} />);
    expect(screen.getByText("No art yet")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

describe("MapNav", () => {
  it("links to the three sections", () => {
    render(<MapNav />);
    const nav = screen.getByRole("navigation", { name: "Map" });
    const hrefs = Array.from(nav.querySelectorAll("a")).map((a) => [a.textContent, a.getAttribute("href")]);
    expect(hrefs).toEqual([
      ["The Classroom", "#classroom"],
      ["The Great Hall", "#great-hall"],
      ["The Sorting Ceremony", "#sorting-ceremony"],
    ]);
  });

  it("toggles the mobile map sheet and reports it with aria-expanded", async () => {
    const user = userEvent.setup();
    render(<MapNav />);
    const button = screen.getByRole("button", { name: "Map" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("link", { name: "The Great Hall" }));
    expect(button).toHaveAttribute("aria-expanded", "false");
  });
});

describe("useHouseSelection", () => {
  const wrapper = ({ children }: { children: ReactNode }) => <HouseSelectionProvider>{children}</HouseSelectionProvider>;

  it("starts on Gryffindor and updates when a house is selected", () => {
    const { result } = renderHook(() => useHouseSelection(), { wrapper });
    expect(result.current.house).toBe("GRYFFINDOR");
    act(() => result.current.selectHouse("SLYTHERIN"));
    expect(result.current.house).toBe("SLYTHERIN");
  });

  it("moves focus to the selected house tab, without a second scroll, when it scrolls", () => {
    const hall = document.createElement("section");
    hall.id = "great-hall";
    const calls: string[] = [];
    hall.scrollIntoView = () => calls.push("scroll");
    const tabs = (["GRYFFINDOR", "HUFFLEPUFF"] as const).map((house) => {
      const tab = document.createElement("button");
      tab.id = `great-hall-tab-${house.toLowerCase()}`;
      hall.append(tab);
      return tab;
    });
    const focus = vi.spyOn(tabs[1]!, "focus");
    document.body.append(hall);
    try {
      const { result } = renderHook(() => useHouseSelection(), { wrapper });
      act(() => result.current.selectHouse("HUFFLEPUFF"));
      expect(focus).not.toHaveBeenCalled();
      act(() => result.current.selectHouse("HUFFLEPUFF", { scroll: true }));
      expect(document.activeElement).toBe(tabs[1]);
      expect(focus).toHaveBeenCalledWith({ preventScroll: true });
      expect(calls).toEqual(["scroll"]);
    } finally {
      hall.remove();
    }
  });

  it("scrolls the Great Hall into view when asked to", () => {
    const hall = document.createElement("section");
    hall.id = "great-hall";
    let scrolledWith: ScrollIntoViewOptions | undefined;
    hall.scrollIntoView = (opts?: boolean | ScrollIntoViewOptions) => {
      scrolledWith = typeof opts === "object" ? opts : {};
    };
    document.body.append(hall);
    try {
      const { result } = renderHook(() => useHouseSelection(), { wrapper });
      act(() => result.current.selectHouse("HUFFLEPUFF", { scroll: true }));
      expect(scrolledWith).toMatchObject({ block: "start", behavior: "smooth" });
    } finally {
      hall.remove();
    }
  });
});
