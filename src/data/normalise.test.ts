import { describe, expect, it } from "vitest";
import { RawCharacterSchema } from "@/data/hp-api/schemas";
import { normaliseCharacter, normaliseSpell } from "@/data/normalise";

const hermione = {
  id: "4c7e6819-a91a-45b2-a454-f931e4a7cce3",
  name: "Hermione Granger",
  alternate_names: ["Hermy"],
  species: "human",
  gender: "female",
  house: "Gryffindor",
  dateOfBirth: "19-09-1979",
  yearOfBirth: 1979,
  wizard: true,
  ancestry: "muggleborn",
  eyeColour: "brown",
  hairColour: "brown",
  wand: { wood: "vine", core: "dragon heartstring", length: 10.75 },
  patronus: "otter",
  hogwartsStudent: true,
  hogwartsStaff: false,
  actor: "Emma Watson",
  alternate_actors: [],
  alive: true,
  image: "https://ik.imagekit.io/hpapi/hermione.jpeg",
};

const build = (overrides: Record<string, unknown> = {}) =>
  normaliseCharacter(RawCharacterSchema.parse({ ...hermione, ...overrides }));

describe("normaliseCharacter", () => {
  it("maps a complete record", () => {
    expect(build()).toEqual({
      id: hermione.id,
      name: "Hermione Granger",
      alternateNames: ["Hermy"],
      house: "GRYFFINDOR",
      ancestry: "muggleborn",
      patronus: "otter",
      actor: "Emma Watson",
      dateOfBirth: "1979-09-19",
      alive: true,
      eyeColour: "brown",
      hairColour: "brown",
      wand: { wood: "vine", core: "dragon heartstring", lengthInches: 10.75 },
    });
  });

  it.each(["ancestry", "patronus", "actor", "eyeColour", "hairColour"] as const)(
    "turns an empty %s into null",
    (field) => {
      expect(build({ [field]: "" })[field]).toBeNull();
    },
  );

  it("uppercases the house, and maps empty to null", () => {
    expect(build({ house: "Gryffindor" }).house).toBe("GRYFFINDOR");
    expect(build({ house: "" }).house).toBeNull();
  });

  it("reformats dd-mm-yyyy dates to ISO, and maps empty to null", () => {
    expect(build({ dateOfBirth: "19-09-1979" }).dateOfBirth).toBe("1979-09-19");
    expect(build({ dateOfBirth: "" }).dateOfBirth).toBeNull();
  });

  it("maps a wand with no data to null", () => {
    expect(build({ wand: { wood: "", core: "", length: null } }).wand).toBeNull();
  });

  it("keeps a partially known wand", () => {
    expect(build({ wand: { wood: "holly", core: "", length: null } }).wand).toEqual({
      wood: "holly",
      core: null,
      lengthInches: null,
    });
  });

  it("tolerates missing optional fields", () => {
    const result = normaliseCharacter(RawCharacterSchema.parse({ id: "x", name: "Nobody" }));
    expect(result.alternateNames).toEqual([]);
    expect(result.wand).toBeNull();
    expect(result.house).toBeNull();
  });

  it("never exposes the image", () => {
    expect("image" in build()).toBe(false);
  });
});

describe("normaliseSpell", () => {
  it("maps id, name and description", () => {
    expect(normaliseSpell({ id: "s1", name: "Aberto", description: "Opens locked doors" })).toEqual({
      id: "s1",
      name: "Aberto",
      description: "Opens locked doors",
    });
  });
});
