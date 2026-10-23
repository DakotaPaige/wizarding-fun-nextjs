import type { Wand } from "@/data/types";

/** What the detail panel shows for a value HP-API doesn't record. */
export const UNKNOWN = "Unknown";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FRACTIONS: Record<string, string> = { "0.25": "¼", "0.5": "½", "0.75": "¾" };

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function formatField(value: string | null): string {
  return value?.trim() || UNKNOWN;
}

/** `"1979-09-19"` → `"19 Sep 1979"`. Parsed by hand so no time zone can shift the day. */
export function formatDate(iso: string | null): string {
  if (iso === null) return UNKNOWN;
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const month = match ? MONTHS[Number(match[2]) - 1] : undefined;
  if (!match || !month) return iso;
  return `${Number(match[3])} ${month} ${match[1]}`;
}

/** `10.75` → `"10¾ in"`; quarters and halves become glyphs, other decimals stay as they are. */
function formatLength(inches: number): string {
  const whole = Math.floor(inches);
  const glyph = FRACTIONS[String(inches - whole)];
  if (!glyph) return `${inches} in`;
  return `${whole > 0 ? whole : ""}${glyph} in`;
}

/** `"Vine · dragon heartstring · 10¾ in"`; missing parts are left out. */
export function formatWand(wand: Wand | null): string {
  if (!wand) return UNKNOWN;
  const parts = [wand.wood, wand.core, wand.lengthInches === null ? null : formatLength(wand.lengthInches)];
  const text = parts.filter((part): part is string => Boolean(part)).join(" · ");
  return text ? capitalise(text) : UNKNOWN;
}
