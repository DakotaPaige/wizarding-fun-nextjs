/** Fallback for a wood that is missing or not listed below. */
export const DEFAULT_WOOD_TONE = "#a88b66";

/**
 * Muted, natural wood colours, light enough to read on the dark detail panel. Keys are the lower-case
 * wood names in the snapshot, and every one has an entry.
 */
export const WOOD_TONES: Record<string, string> = {
  acacia: "#c7a66b",
  alder: "#b98a64",
  ash: "#c9b48c",
  aspen: "#d3c3a0",
  birch: "#d8c8a4",
  blackthorn: "#8a6f5c",
  cedar: "#b5714f",
  cherry: "#a85c48",
  chestnut: "#9c6b45",
  cypress: "#a99a6b",
  dogwood: "#c3a38a",
  ebony: "#7a6a5f",
  elder: "#bfae8c",
  elm: "#b39a78",
  "english oak": "#a07d52",
  fir: "#c4a574",
  ginkgo: "#d1bf8a",
  hawthorn: "#bda88a",
  hazel: "#a8895c",
  holly: "#d6cdb5",
  hornbeam: "#c2b39a",
  larch: "#c9955f",
  mahogany: "#9a4f3c",
  maple: "#c28f5e",
  oak: "#a98055",
  poplar: "#cdbb98",
  "red oak": "#a8664a",
  redwood: "#a65a42",
  rosewood: "#97514a",
  snakewood: "#a9744f",
  vine: "#8f7a4e",
  walnut: "#7e5a3f",
  willow: "#b8a780",
  yew: "#b6824f",
};

/** The tone for a wood, whatever its case; the default when the wood is unknown. */
export function woodTone(wood: string | null): string {
  return (wood && WOOD_TONES[wood.trim().toLowerCase()]) || DEFAULT_WOOD_TONE;
}
