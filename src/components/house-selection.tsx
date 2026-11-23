"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { HouseName } from "@/data/types";
import { prefersReducedMotion } from "@/animation/motion";

export const GREAT_HALL_ID = "great-hall";

/** The id of a house's tab in the Great Hall. */
export const houseTabId = (house: HouseName) => `${GREAT_HALL_ID}-tab-${house.toLowerCase()}`;

interface SelectHouseOptions {
  /**
   * Also bring the Great Hall into view and move focus to the house's tab, so keyboard and
   * screen-reader users arrive with the scroll (e.g. "Meet your housemates").
   */
  scroll?: boolean;
}

interface HouseSelection {
  house: HouseName;
  selectHouse(house: HouseName, opts?: SelectHouseOptions): void;
}

const HouseSelectionContext = createContext<HouseSelection | null>(null);

/** Shares the Great Hall's selected house so other sections (the quiz result) can change it. */
export function HouseSelectionProvider({ children }: { children: ReactNode }) {
  const [house, setHouse] = useState<HouseName>("GRYFFINDOR");

  const selectHouse = useCallback((next: HouseName, { scroll = false }: SelectHouseOptions = {}) => {
    setHouse(next);
    if (scroll) {
      // Focus without its own scroll jump; the one scroll below does the moving.
      document.getElementById(houseTabId(next))?.focus({ preventScroll: true });
      document.getElementById(GREAT_HALL_ID)?.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start",
      });
    }
  }, []);

  const value = useMemo(() => ({ house, selectHouse }), [house, selectHouse]);
  return <HouseSelectionContext value={value}>{children}</HouseSelectionContext>;
}

export function useHouseSelection(): HouseSelection {
  const selection = useContext(HouseSelectionContext);
  if (!selection) throw new Error("useHouseSelection must be used inside <HouseSelectionProvider>");
  return selection;
}
