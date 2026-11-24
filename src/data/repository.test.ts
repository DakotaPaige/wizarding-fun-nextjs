import { afterEach, describe, expect, it, vi } from "vitest";
import charactersSnapshot from "@/data/snapshot/characters.json";
import spellsSnapshot from "@/data/snapshot/spells.json";
import { loadWizardingData } from "@/data/repository";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadWizardingData", () => {
  it("returns the committed snapshot, synchronously and without any fetch", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const data = loadWizardingData();

    expect(data).not.toBeInstanceOf(Promise);
    expect(data.characters).toHaveLength(charactersSnapshot.length);
    expect(data.spells).toHaveLength(spellsSnapshot.length);
    expect(data.characters.find((c) => c.id === "harry-potter")?.name).toBe("Harry Potter");
    expect(data.spells.find((s) => s.id === "disarming-charm")?.name).toBe("Expelliarmus");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("has no source flag", () => {
    expect(loadWizardingData()).not.toHaveProperty("source");
  });

  it("drops invalid records with a warning naming them", async () => {
    vi.resetModules();
    const valid = {
      id: "ok",
      name: "Ok Person",
      alternateNames: [],
      house: null,
      ancestry: null,
      patronus: null,
      actor: null,
      dateOfBirth: null,
      alive: true,
      eyeColour: null,
      hairColour: null,
      wand: null,
    };
    vi.doMock("@/data/snapshot/characters.json", () => ({ default: [valid, { ...valid, id: "bad", name: 42 }] }));
    vi.doMock("@/data/snapshot/spells.json", () => ({ default: [{ id: "s", name: "S", description: "d" }] }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { loadWizardingData: load } = await import("@/data/repository");
      expect(load().characters.map((c) => c.id)).toEqual(["ok"]);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("bad"));
    } finally {
      vi.doUnmock("@/data/snapshot/characters.json");
      vi.doUnmock("@/data/snapshot/spells.json");
    }
  });
});
