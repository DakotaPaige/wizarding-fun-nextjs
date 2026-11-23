import { describe, expect, it } from "vitest";
import { formatDate, formatField, formatWand } from "./format";

describe("formatField", () => {
  it("returns the value when present", () => {
    expect(formatField("Otter")).toBe("Otter");
  });

  it('returns "Unknown" for null or blank values', () => {
    expect(formatField(null)).toBe("Unknown");
    expect(formatField("   ")).toBe("Unknown");
  });
});

describe("formatDate", () => {
  it("formats an ISO date as day, short month and year", () => {
    expect(formatDate("1979-09-19")).toBe("19 Sep 1979");
    expect(formatDate("1980-07-31")).toBe("31 Jul 1980");
    expect(formatDate("1881-01-04")).toBe("4 Jan 1881");
  });

  it('returns "Unknown" for null', () => {
    expect(formatDate(null)).toBe("Unknown");
  });

  it("passes through a value that is not an ISO date", () => {
    expect(formatDate("sometime")).toBe("sometime");
  });
});

describe("formatWand", () => {
  it("joins wood, core and length with fractions as glyphs", () => {
    expect(formatWand({ wood: "vine", core: "dragon heartstring", lengthInches: 10.75 })).toBe(
      "Vine · dragon heartstring · 10¾ in",
    );
    expect(formatWand({ wood: "holly", core: "phoenix feather", lengthInches: 11 })).toBe(
      "Holly · phoenix feather · 11 in",
    );
    expect(formatWand({ wood: "elder", core: "Thestral tail hair", lengthInches: 15.5 })).toBe(
      "Elder · Thestral tail hair · 15½ in",
    );
    expect(formatWand({ wood: "willow", core: "unicorn hair", lengthInches: 14.25 })).toBe(
      "Willow · unicorn hair · 14¼ in",
    );
  });

  it("keeps other decimals as they are", () => {
    expect(formatWand({ wood: null, core: null, lengthInches: 12.3 })).toBe("12.3 in");
  });

  it("leaves missing parts out", () => {
    expect(formatWand({ wood: "ash", core: null, lengthInches: 12 })).toBe("Ash · 12 in");
    expect(formatWand({ wood: null, core: "unicorn hair", lengthInches: null })).toBe("Unicorn hair");
  });

  it('returns "Unknown" for null or a wand with nothing recorded', () => {
    expect(formatWand(null)).toBe("Unknown");
    expect(formatWand({ wood: null, core: null, lengthInches: null })).toBe("Unknown");
  });
});
