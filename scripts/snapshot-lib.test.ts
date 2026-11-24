import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSnapshot, fetchAllPages } from "./snapshot-lib";

const BASE = "https://api.potterdb.com";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function setup(responses: Response[]) {
  const urls: string[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    urls.push(String(input));
    const next = responses.shift();
    if (!next) throw new Error("no more fake responses");
    return next;
  }) as unknown as typeof fetch;
  const sleeps: number[] = [];
  const sleep = async (ms: number) => {
    sleeps.push(ms);
  };
  return { urls, sleeps, deps: { fetchImpl, sleep } };
}

describe("fetchAllPages", () => {
  it("follows links.next and sleeps between requests only", async () => {
    const next = `${BASE}/v1/spells?page[number]=2&page[size]=100`;
    const { urls, sleeps, deps } = setup([
      json({ data: [{ n: 1 }], links: { next } }),
      json({ data: [{ n: 2 }], links: {} }),
    ]);
    const items = await fetchAllPages("/v1/spells", deps);
    expect(items).toEqual([{ n: 1 }, { n: 2 }]);
    expect(urls).toEqual([`${BASE}/v1/spells?page[size]=100`, next]);
    expect(sleeps).toEqual([4100]);
  });

  it("retries a 429 with backoff and then succeeds", async () => {
    const { sleeps, deps } = setup([
      new Response("slow down", { status: 429 }),
      json({ data: [{ n: 1 }], links: {} }),
    ]);
    expect(await fetchAllPages("/v1/spells", deps)).toEqual([{ n: 1 }]);
    expect(sleeps).toEqual([10_000]);
  });

  it("throws after five retries of a 503", async () => {
    const { sleeps, deps } = setup(
      Array.from({ length: 6 }, () => new Response("down", { status: 503 })),
    );
    await expect(fetchAllPages("/v1/spells", deps)).rejects.toThrow(/503/);
    expect(sleeps).toEqual([10_000, 20_000, 30_000, 40_000, 50_000]);
  });

  it("throws immediately on other failures", async () => {
    const { sleeps, deps } = setup([new Response("nope", { status: 404 })]);
    await expect(fetchAllPages("/v1/spells", deps)).rejects.toThrow(/404/);
    expect(sleeps).toEqual([]);
  });
});

function character(slug: string, name: string, attrs: Record<string, unknown> = {}) {
  return {
    id: `id-${slug}`,
    type: "character",
    attributes: { slug, name, ...attrs },
  };
}

describe("buildSnapshot", () => {
  const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
  afterEach(() => spy.mockClear());

  const potterCharacters = [
    character("zed-plain", "Zed Plain"),
    character("hugo-house", "Hugo House", { house: "Ravenclaw" }),
    character("pat-stag", "Pat Stag", { patronus: "Stag" }),
    character("wanda-wand", "Wanda Wand", { wands: ["11', Holly, phoenix feather"] }),
    character("no-patronus", "No Patronus", { patronus: "None" }),
    character("half-wand", "Half Wand", { wands: ["11', Holly, unknown core"] }),
    character("luna-lovegood", "Luna Scamander (née Lovegood)"),
    character("harry-potter", "Harry James Potter"),
    { id: "bad", type: "character", attributes: { slug: "" } },
  ];
  const hpCharacters = [
    { id: "1", name: "Luna Lovegood", actor: "Evanna Lynch" },
    { id: "2", name: "HARRY POTTER", actor: "Daniel Radcliffe" },
    { id: "3", name: "Zed Plain", actor: "Somebody" },
  ];
  const featured = {
    "luna-lovegood": "Luna Lovegood",
    "harry-potter": "Harry Potter",
    "zed-plain": "Zed Plain",
  };

  it("keeps by D5, joins actors to featured characters only, sorted by id", () => {
    const { characters } = buildSnapshot({
      potterCharacters,
      potterSpells: [],
      hpCharacters,
      featured,
      actorOverrides: {},
    });
    expect(characters.map((c) => c.id)).toEqual([
      "harry-potter",
      "hugo-house",
      "luna-lovegood",
      "pat-stag",
      "wanda-wand",
      "zed-plain",
    ]);
    const byId = Object.fromEntries(characters.map((c) => [c.id, c]));
    expect(byId["luna-lovegood"]?.name).toBe("Luna Lovegood");
    expect(byId["luna-lovegood"]?.actor).toBe("Evanna Lynch");
    expect(byId["harry-potter"]?.actor).toBe("Daniel Radcliffe");
    expect(byId["hugo-house"]?.actor).toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("uses an actor override and treats empty actors as null", () => {
    const { characters } = buildSnapshot({
      potterCharacters: [character("harry-potter", "Harry James Potter")],
      potterSpells: [],
      hpCharacters: [
        { id: "1", name: "Harry James Potter", actor: "Daniel Radcliffe" },
        { id: "2", name: "Harry Potter", actor: "" },
      ],
      featured: { "harry-potter": "Harry Potter" },
      actorOverrides: { "harry-potter": "Harry James Potter" },
    });
    expect(characters[0]?.actor).toBe("Daniel Radcliffe");
    const none = buildSnapshot({
      potterCharacters: [character("harry-potter", "Harry James Potter")],
      potterSpells: [],
      hpCharacters: [{ id: "2", name: "Harry Potter", actor: "" }],
      featured: { "harry-potter": "Harry Potter" },
      actorOverrides: {},
    });
    expect(none.characters[0]?.actor).toBeNull();
  });

  it("builds spells, dropping those without an effect or invalid, sorted by id", () => {
    const { spells } = buildSnapshot({
      potterCharacters: [],
      potterSpells: [
        { id: "b", type: "spell", attributes: { slug: "b-spell", name: "B", effect: "Does B" } },
        { id: "a", type: "spell", attributes: { slug: "a-spell", name: "A", effect: "Does A" } },
        { id: "c", type: "spell", attributes: { slug: "c-spell", name: "C", effect: null } },
        { id: "d", type: "spell", attributes: {} },
      ],
      hpCharacters: [],
      featured: {},
      actorOverrides: {},
    });
    expect(spells.map((s) => s.id)).toEqual(["a-spell", "b-spell"]);
  });
});
