import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import charactersSnapshot from "@/data/snapshot/characters.json";
import spellsSnapshot from "@/data/snapshot/spells.json";
import { loadWizardingData } from "@/data/repository";

const liveCharacter = { id: "c1", name: "Live Wizard", house: "Slytherin", image: "x" };
const liveSpell = { id: "s1", name: "Livio", description: "Lives" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function fetchReturning(characters: unknown[], spells: unknown[]): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) =>
    jsonResponse(String(input).endsWith("/api/characters") ? characters : spells),
  ) as unknown as typeof fetch;
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("loadWizardingData", () => {
  it("returns normalised live data on a 200", async () => {
    const data = await loadWizardingData({ fetchImpl: fetchReturning([liveCharacter], [liveSpell]) });

    expect(data.source).toBe("live");
    expect(data.characters).toHaveLength(1);
    expect(data.characters[0]).toMatchObject({ id: "c1", house: "SLYTHERIN" });
    expect("image" in data.characters[0]!).toBe(false);
    expect(data.spells).toEqual([{ id: "s1", name: "Livio", description: "Lives" }]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("passes the abort signal and revalidate hint to fetch", async () => {
    const fetchImpl = fetchReturning([liveCharacter], [liveSpell]);
    await loadWizardingData({ fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://hp-api.onrender.com/api/characters",
      expect.objectContaining({ signal: expect.any(AbortSignal), next: { revalidate: 86400 } }),
    );
  });

  async function expectSnapshot(fetchImpl: typeof fetch) {
    const data = await loadWizardingData({ fetchImpl });
    expect(data.source).toBe("snapshot");
    expect(data.characters).toHaveLength(charactersSnapshot.length);
    expect(data.spells).toHaveLength(spellsSnapshot.length);
  }

  it("falls back to the snapshot when fetch rejects", async () => {
    await expectSnapshot(vi.fn().mockRejectedValue(new Error("offline")));
  });

  it("falls back to the snapshot on a 500", async () => {
    await expectSnapshot(vi.fn(async () => jsonResponse({}, 500)) as unknown as typeof fetch);
  });

  it("falls back to the snapshot when the payload is not an array", async () => {
    await expectSnapshot(vi.fn(async () => jsonResponse({ nope: true })) as unknown as typeof fetch);
  });

  it("falls back to the snapshot when fetch never resolves within 4000 ms", async () => {
    vi.useFakeTimers();
    const pending = loadWizardingData({ fetchImpl: vi.fn(() => new Promise(() => {})) as unknown as typeof fetch });
    await vi.advanceTimersByTimeAsync(4000);
    const data = await pending;

    expect(data.source).toBe("snapshot");
    expect(data.characters).toHaveLength(charactersSnapshot.length);
  });

  it("drops an invalid live record and warns once", async () => {
    const invalid = { id: "bad", name: 42 };
    const data = await loadWizardingData({
      fetchImpl: fetchReturning([liveCharacter, invalid], [liveSpell]),
    });

    expect(data.source).toBe("live");
    expect(data.characters.map((c) => c.id)).toEqual(["c1"]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.join(" ")).toMatch(/dropped 1 invalid character/i);
  });
});
