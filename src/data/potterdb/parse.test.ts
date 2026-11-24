import { describe, expect, it } from "vitest";
import {
  displayName,
  parseBorn,
  parsePatronus,
  parseWand,
  toCharacterRecord,
  toSpellRecord,
} from "./parse";
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
    expect(parseWand("Unknown length, wood, and core (formerly)")).toBeNull();
  });

  it("tolerates plain numbers and other length marks", () => {
    expect(parseWand("11, Holly, phoenix feather")?.lengthInches).toBe(11);
    expect(parseWand("10.5, Holly, phoenix feather")?.lengthInches).toBe(10.5);
    expect(parseWand('11", Holly, phoenix feather')?.lengthInches).toBe(11);
    expect(parseWand("11′, Holly, phoenix feather")?.lengthInches).toBe(11);
  });
});

describe("parseWand cores", () => {
  const core = (text: string) => parseWand(`11', Holly, ${text}`)?.core;

  it("strips a trailing ' core'", () => {
    expect(core("phoenix feather core")).toBe("phoenix feather");
  });

  it("nulls cores that carry digits or notes instead of a material", () => {
    expect(core("dragon heartstring 12")).toBeNull();
    expect(core("previously unicorn hair")).toBeNull();
    expect(core("and unknown core")).toBeNull();
  });
});

describe("parsePatronus", () => {
  it("lowercases a creature and drops trailing parentheticals", () => {
    expect(parsePatronus("Jack Russell terrier")).toBe("jack russell terrier");
    expect(parsePatronus("Otter (corporeal)")).toBe("otter");
  });

  it("nulls missing, unknown and non-corporeal values", () => {
    for (const text of [null, "", "None", "Unknown", "Unknown form; giant-sized", "Non-corporeal", "Corporeal"]) {
      expect(parsePatronus(text), String(text)).toBeNull();
    }
  });

  it("nulls guesses, lists and vague words that make no species prompt", () => {
    for (const text of [
      "Either a bat, buffalo, or squirrel",
      "Something with horns",
      "Raven or Crow",
      "Rabbit or hare",
      "Jack Rabbit (c. 1986), Wolf (1995-1998)",
      "Bird",
    ]) {
      expect(parsePatronus(text), text).toBeNull();
    }
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

describe("toCharacterRecord aliases", () => {
  const aliasesOf = (alias_names: string[], featured: Record<string, string> = {}) =>
    toCharacterRecord(
      PotterCharacterSchema.parse({ ...harryItem, attributes: { ...harryItem.attributes, alias_names } }),
      featured,
    ).alternateNames;

  it("drops disguises, strips parentheticals and drops the display name", () => {
    expect(
      aliasesOf(
        [
          "Harry Potter (self-proclaimed)",
          "Gregory Goyle (under disguise of Polyjuice Potion)",
          "Barny Weasley (Polyjuice)",
          "Vernon Dudley (the name he used to disguise his identity)",
          "Potty (by Peeves and Slytherins)",
          "The Chosen One",
        ],
        { "harry-potter": "Harry Potter" },
      ),
    ).toEqual(["Potty", "The Chosen One"]);
  });

  it("dedupes case-insensitively, first wins, and keeps at most five", () => {
    expect(aliasesOf(["Ron", "RON (by family)", "A", "B", "C", "D", "E"])).toEqual(["Ron", "A", "B", "C", "D"]);
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

  const named = (incantation: string | null, name = "Disarming Charm") =>
    toSpellRecord(
      PotterSpellSchema.parse({ ...spellItem, attributes: { ...spellItem.attributes, incantation, name } }),
    )?.name;

  it("treats placeholder incantations as missing", () => {
    expect(named("Unknown")).toBe("Disarming Charm");
    expect(named("none")).toBe("Disarming Charm");
  });

  it("strips every pronunciation and stray end quotes", () => {
    expect(named("Finite(fi-NEE-tay), Finite Incantatem'(fi-NEE-tay in-can-TAH-tem)")).toBe(
      "Finite, Finite Incantatem",
    );
  });

  it("falls back to the name when the incantation is still garbled", () => {
    expect(
      named("For the Charm: Geminio(juh-MIN-ee-oh)For the Curse: Gemino(juh-MIN-oh)", "Doubling Charm"),
    ).toBe("Doubling Charm");
  });

  it("drops spells without an effect", () => {
    const item = PotterSpellSchema.parse({
      ...spellItem,
      attributes: { ...spellItem.attributes, effect: null },
    });
    expect(toSpellRecord(item)).toBeNull();
  });
});
