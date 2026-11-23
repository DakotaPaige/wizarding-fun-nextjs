/** Fallback for a wood that is missing or not listed below. */
export const DEFAULT_WOOD_TONE = "#a88b66";

/**
 * Muted, natural wood colours, light enough to read on the dark detail panel. Keys are the lower-case
 * names HP-API uses; every wood in the snapshot has an entry.
 */
export const WOOD_TONES: Record<string, string> = {
  alder: "#b98a64",
  ash: "#c9b48c",
  birch: "#d8c8a4",
  cedar: "#b5714f",
  cherry: "#a85c48",
  chestnut: "#9c6b45",
  cypress: "#a99a6b",
  elm: "#b39a78",
  fir: "#c4a574",
  hawthorn: "#bda88a",
  hazel: "#a8895c",
  holly: "#d6cdb5",
  hornbeam: "#c2b39a",
  larch: "#c9955f",
  mahogany: "#9a4f3c",
  oak: "#a98055",
  vine: "#8f7a4e",
  walnut: "#7e5a3f",
  willow: "#b8a780",
  yew: "#b6824f",
};

/** The tone for a wood, whatever its case; the default when the wood is unknown. */
export function woodTone(wood: string | null): string {
  return (wood && WOOD_TONES[wood.trim().toLowerCase()]) || DEFAULT_WOOD_TONE;
}
