import { getWizardingData } from "@/data/repository";
import { createQuizServices, type QuizServices } from "@/quiz/services";
import type { CharacterRecord, SpellRecord, WizardingData } from "@/data/types";

export interface GraphQLContext {
  /** Loaded once per request; resolvers read from it instead of refetching. */
  data: WizardingData;
  ip: string | null;
  /** Quizmaster collaborators; built from env per request, replaced by fakes in tests. */
  quiz: QuizServices;
}

export interface Lookups {
  characterById: ReadonlyMap<string, CharacterRecord>;
  spellByName: ReadonlyMap<string, SpellRecord>;
}

const lookupCache = new WeakMap<WizardingData, Lookups>();

/** id/name indexes over the request's data, built on first use. */
export function getLookups(data: WizardingData): Lookups {
  let lookups = lookupCache.get(data);
  if (!lookups) {
    lookups = {
      characterById: new Map(data.characters.map((c) => [c.id, c])),
      spellByName: new Map(data.spells.map((s) => [s.name, s])),
    };
    lookupCache.set(data, lookups);
  }
  return lookups;
}

/** Client IP from Netlify's header, falling back to the first `x-forwarded-for` hop. */
export function getClientIp(request?: Request): string | null {
  const netlify = request?.headers.get("x-nf-client-connection-ip")?.trim();
  if (netlify) return netlify;
  const forwarded = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || null;
}

export async function createContext(request?: Request): Promise<GraphQLContext> {
  const data = await getWizardingData();
  return { data, ip: getClientIp(request), quiz: createQuizServices(data) };
}
