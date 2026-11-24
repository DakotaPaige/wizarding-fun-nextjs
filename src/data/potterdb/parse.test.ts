import { describe, expect, it } from "vitest";
import { displayName, parseBorn, parseWand, toCharacterRecord, toSpellRecord } from "./parse";
import { PotterCharacterSchema, PotterSpellSchema } from "./schemas";

const harryItem = {
  id: "3b57e3cb-b023-4900-a273-eb9b6a9c8e81",
  type: "character",
  links: { self: "/v1/characters/harry-potter" },
  attributes: {
    slug: "harry-potter",
    alias_names: ["The Boy Who Lived", "The Chosen One"],
    animagus: null,
    blood_status: "Half-blood",
    born: "31 July 1980, Godric's Hollow, West Country, England, Great Britain",
    died: null,
    eye_color: "Bright green",
    hair_color: "Jet-black",
    house: "Gryffindor",
    name: "Harry James Potter",
    patronus: "Stag",
    wands: [
      "10¾', Vine, dragon heartstring (temporarily)",
      "11', Holly, phoenix feather",
      "10', Blackthorn, unknown core (temporarily)",
    ],
    weight: null,
    image: "https://example.invalid/harry.png",
    wiki: "https://example.invalid/wiki",
  },
};

const spellItem = {
  id: "4f9bdf6d-749b-477d-8fe8-426b9a582d2a",
  type: "spell",
  links: { self: "/v1/spells/age-line" },
  attributes: {
    slug: "disarming-charm",
    category: "Charm",
    creator: null,
    effect: "Disarms an opponent",
    hand: null,
    incantation: "Expelliarmus(ex-PEL-lee-ar-muss)",
    light: "Scarlet",
    name: "Disarming Charm",
    image: "https://example.invalid/spell.png",
  },
};

describe("parseWand", () => {
  it("parses a full wand", () => {
    expect(parseWand("11', Holly, phoenix feather")).toEqual({
      wood: "holly",
      core: "phoenix feather",
      lengthInches: 11,
    });
  });

  it("parses fraction glyphs", () => {
    expect(parseWand("10¾', Vine, dragon heartstring")?.lengthInches).toBe(10.75);
    expect(parseWand("11¼', Cypress, unicorn hair")?.lengthInches).toBe(11.25);
    expect(parseWand("9½', Elm, unicorn hair")?.lengthInches).toBe(9.5);
  });

  it("nulls an unknown core and drops the trailing parenthetical", () => {
    expect(parseWand("10', Blackthorn, unknown core (temporarily)")).toEqual({
      wood: "blackthorn",
      core: null,
      lengthInches: 10,
    });
  });

  it("nulls an unknown length or wood", () => {
    expect(parseWand("Unknown length, Yew, phoenix feather")).toEqual({
      wood: "yew",
      core: "phoenix feather",
      lengthInches: null,
    });
    expect(parseWand("12', unknown wood, unicorn hair")?.wood).toBeNull();
  });

  it("returns null when nothing is known or the string is unparseable", () => {
    expect(parseWand("Unknown length, wood and core")).toBeNull();
    expect(parseWand("Unknown length, unknown wood, unknown core")).toBeNull();
    expect(parseWand("")).toBeNull();
  });

  it("tolerates plain numbers and other length marks", () => {
    expect(parseWand("11, Holly, phoenix feather")?.lengthInches).toBe(11);
    expect(parseWand("10.5, Holly, phoenix feather")?.lengthInches).toBe(10.5);
    expect(parseWand('11", Holly, phoenix feather')?.lengthInches).toBe(11);
    expect(parseWand("11′, Holly, phoenix feather")?.lengthInches).toBe(11);
  });
});

describe("parseBorn", () => {
  it("returns an ISO date for a leading 'D Month YYYY'", () => {
    expect(
      parseBorn("31 July 1980, Godric's Hollow, West Country, England, Great Britain"),
    ).toBe("1980-07-31");
    expect(parseBorn("5 March 1960")).toBe("1960-03-05");
  });

  it("returns null for anything else", () => {
    expect(parseBorn("c. 1950")).toBeNull();
    expect(parseBorn(null)).toBeNull();
    expect(parseBorn("")).toBeNull();
    expect(parseBorn("31 Julember 1980")).toBeNull();
  });
});

describe("displayName", () => {
  it("removes parentheticals", () => {
    expect(displayName("luna-lovegood", "Luna Scamander (née Lovegood)", {})).toBe(
      "Luna Scamander",
    );
  });

  it("prefers a featured name", () => {
    expect(
      displayName("luna-lovegood", "Luna Scamander (née Lovegood)", {
        "luna-lovegood": "Luna Lovegood",
      }),
    ).toBe("Luna Lovegood");
  });
});

describe("schemas", () => {
  it("accept real items with extra keys and strip them", () => {
    const character = PotterCharacterSchema.parse(harryItem);
    expect(character.attributes.slug).toBe("harry-potter");
    expect("image" in character.attributes).toBe(false);
    expect(PotterSpellSchema.parse(spellItem).attributes.slug).toBe("disarming-charm");
  });

  it("accept spells with a null incantation and effect", () => {
    const parsed = PotterSpellSchema.parse({
      ...spellItem,
      attributes: { ...spellItem.attributes, incantation: null, effect: null },
    });
    expect(parsed.attributes.effect).toBeNull();
  });
});

describe("toCharacterRecord", () => {
  it("maps Harry", () => {
    const record = toCharacterRecord(PotterCharacterSchema.parse(harryItem), {});
    expect(record).toEqual({
      id: "harry-potter",
      name: "Harry James Potter",
      alternateNames: ["The Boy Who Lived", "The Chosen One"],
      house: "GRYFFINDOR",
      ancestry: "Half-blood",
      patronus: "stag",
      actor: null,
      dateOfBirth: "1980-07-31",
      alive: true,
      eyeColour: "Bright green",
      hairColour: "Jet-black",
      wand: { wood: "holly", core: "phoenix feather", lengthInches: 11 },
    });
  });

  it("uses the featured name, and nulls unknown houses and missing wands", () => {
    const item = PotterCharacterSchema.parse({
      ...harryItem,
      attributes: {
        ...harryItem.attributes,
        house: "Beauxbatons",
        died: "1998",
        wands: null,
        alias_names: null,
        patronus: null,
      },
    });
    const record = toCharacterRecord(item, { "harry-potter": "Harry Potter" });
    expect(record.name).toBe("Harry Potter");
    expect(record.house).toBeNull();
    expect(record.alive).toBe(false);
    expect(record.wand).toBeNull();
    expect(record.alternateNames).toEqual([]);
    expect(record.patronus).toBeNull();
  });
});

describe("toSpellRecord", () => {
  it("uses the incantation without its pronunciation as the name", () => {
    expect(toSpellRecord(PotterSpellSchema.parse(spellItem))).toEqual({
      id: "disarming-charm",
      name: "Expelliarmus",
      description: "Disarms an opponent",
    });
  });

  it("falls back to the spell name when there is no incantation", () => {
    const item = PotterSpellSchema.parse({
      ...spellItem,
      attributes: { ...spellItem.attributes, incantation: null },
    });
    expect(toSpellRecord(item)?.name).toBe("Disarming Charm");
  });

  it("drops spells without an effect", () => {
    const item = PotterSpellSchema.parse({
      ...spellItem,
      attributes: { ...spellItem.attributes, effect: null },
    });
    expect(toSpellRecord(item)).toBeNull();
  });
});
