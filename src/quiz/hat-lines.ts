import type { HouseName } from "@/data/types";

/** The Hat's voice: dry, wry, a little theatrical. Never hints at an answer. */
export const HAT_LINES: {
  opening: string[];
  safeRight: string[];
  safeWrong: string[];
  daredRight: string[];
  daredWrong: string[];
  daring: string[];
  safe: string[];
} = {
  opening: [
    "Well then. Will you play it safe, or show me a little nerve?",
    "Ah, a fresh head beneath my brim. Let us see what it holds.",
    "Hmm. Another hopeful. Shall we begin, and shall we be bold?",
  ],
  safeRight: [
    "Steady and correct. Patience suits you.",
    "Quite right. No fuss, no flourish. I do admire economy.",
    "Correct, and without a tremor. Noted.",
  ],
  safeWrong: [
    "Even the careful stumble. Onward.",
    "Wrong, but quietly so. Nobody saw. Except me.",
    "A small slip. The careful recover quickly, I find.",
  ],
  daredRight: [
    "Bold, and right. I see a lion stirring in there.",
    "Nerve and knowledge together. How rare, how delightful.",
    "You dared and you delivered. I shall remember that.",
  ],
  daredWrong: [
    "Brave. Wrong, mind you, but brave.",
    "Fortune favours the bold, yet not, it seems, this once.",
    "A grand gamble, grandly lost. I rather enjoyed it.",
  ],
  daring: [
    "Daring, are we? Let us see if the nerve is matched by knowledge.",
    "Oh, ambitious. I do like a head that reaches.",
    "The harder road, then. Do mind your footing.",
  ],
  safe: [
    "Sensible. Very sensible. Hmm…",
    "The cautious path. There is no shame in it. Mostly.",
    "Prudence, is it? I shall write that down.",
  ],
};

export const CLASSIC_VERDICTS: Record<HouseName, string> = {
  GRYFFINDOR:
    "You reached for the harder question again and again, and more often than not you caught it. Nerve like that does not wait politely in the corridor… there is only one table for you.",
  HUFFLEPUFF:
    "Steady answer after steady answer, and never a grumble when one went astray. Loyalty to the long game is a quiet gift. Go and sit where the welcome is warmest.",
  RAVENCLAW:
    "You picked your dares with care and hardly missed one. A mind that weighs a risk before taking it… there is only one table for you.",
  SLYTHERIN:
    "You knew exactly where a gamble would pay and you placed it there, again and again. Cunning is not a flaw, merely a talent with ambition. Your table awaits.",
};
