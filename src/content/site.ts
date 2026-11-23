/**
 * Site-wide copy in one place so the owner can rename the site without hunting
 * through components. Title and tagline are provisional (spec §13).
 */
export interface SiteContent {
  title: string;
  tagline: string;
  owner: string;
  /** `null` hides a link. */
  links: { github: string | null; portfolio: string | null };
}

export const SITE: SiteContent = {
  title: "Lumos",
  tagline: "A small, magical tour of the wizarding world",
  owner: "Dakota",
  links: { github: "https://github.com/DakotaPaige/", portfolio: "https://dakotamauza.com/" },
};

/** Map navigation targets, in scroll order (shared by the header and the footer). */
export const MAP_SECTIONS = [
  { id: "classroom", label: "The Classroom" },
  { id: "great-hall", label: "The Great Hall" },
  { id: "sorting-ceremony", label: "The Sorting Ceremony" },
] as const;
