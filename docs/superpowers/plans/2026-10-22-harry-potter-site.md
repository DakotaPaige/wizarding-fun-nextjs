# Harry Potter Fan Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the single-page, GSAP-animated Harry Potter fan site described in the spec: intro, spells, characters, an AI-or-classic Sorting Hat quiz, and a footer. It's backed by our own GraphQL layer over HP-API.

**Architecture:**
- A Next.js App Router app. The page is a Server Component that runs a GraphQL query in-process and hands typed data to client section components, which own the GSAP animation.
- Data comes from HP-API through a cached fetch, with a committed snapshot as fallback. It's normalised once, then served through a Pothos schema at `/api/graphql`.
- The quiz engine is pure TypeScript (generators, sorting, quizmasters) behind a `Quizmaster` interface, exposed as two GraphQL mutations.

**Tech Stack:**
- Next.js (latest stable), TypeScript strict, pnpm, Node 22
- GSAP 3 + `@gsap/react` (ScrollTrigger, SplitText, Flip)
- graphql-yoga, Pothos, GraphQL Code Generator (client preset)
- Zod, `@anthropic-ai/sdk`, `@upstash/redis`
- Vitest + React Testing Library (jsdom), Playwright + `@axe-core/playwright`
- Hosted on Netlify

**Spec:** `docs/superpowers/specs/2026-10-22-harry-potter-site-design.md`. Read it alongside this plan. Section references (§) point there.

**Wireframes:** https://claude.ai/artifact/WBFQqHWu7vJ7iQ7iFUQTzZ

## Global Constraints

- **No copyrighted imagery.** HP-API `image` URLs are never rendered or passed to the client. There are no official crests: houses use the `HouseEmblem` SVG (a shield in the house colour plus the initial). Every art slot has a fallback.
- **Art** is resolved only through `src/data/art-manifest.ts`. Files go in `public/art/`.
- **HP-API fetch:** 4000 ms abort timeout, `next: { revalidate: 86400 }`. On any failure, use the committed snapshot. Raw records are Zod-validated, and invalid ones are dropped with `console.warn`.
- **AI model** comes from `QUIZ_MODEL`. Allowed values: `claude-haiku-5-5` (default) and `claude-opus-5-5`. Anything else falls back to the default.
- **AI calls:**
  - exactly one `messages.create` per GraphQL request
  - `output_config: { effort: "low" }`, `tool_choice: { type: "auto" }`, `strict: true` on the tool
  - `max_tokens` 400 per turn and 300 for the verdict
  - client options `{ timeout: 6000, maxRetries: 0 }` (retries would break Netlify's ~10 s function limit)
  - any `stop_reason` other than `tool_use` / `end_turn`, including `refusal`, counts as a failure
- **Budget:**
  - Redis keys `ai:tokens:<YYYY-MM-DD>` and `ai:games:<ipHash>:<YYYY-MM-DD>`, using **UTC** dates, with a TTL of 172800 s
  - the IP hash is `sha256(salt + ip)` as hex, with the salt from `IP_HASH_SALT`
  - `AI_GAMES_PER_IP_PER_DAY` defaults to 3. `AI_DAILY_TOKEN_BUDGET` defaults to 200000.
- **Every env var is optional.** If any AI or Redis var is missing, the quiz runs in classic mode. Missing vars never throw.
- **Quiz round:** 10 questions, 4 options each. Safe = 1 point, Daring = 2 points with `difficulty: "hard"`. Once a game is in classic mode it stays there.
- **Exact copy:**
  - badges: `The Hat is awake · AI quizmaster` / `The Hat is resting · classic mode`
  - attribution: `— The Sorting Hat`
  - error: `The Hat lost its train of thought — try again`
  - footer heading: `Mischief managed.`
  - disclaimer: `Character and spell data from HP-API (hp-api.onrender.com). A fan project — not affiliated with or endorsed by Warner Bros. or J.K. Rowling.`
- **Section names** in the map navigation: `The Classroom` (`#classroom`), `The Great Hall` (`#great-hall`), `The Sorting Ceremony` (`#sorting-ceremony`).
- **Reduced motion** (via `gsap.matchMedia()` with `(prefers-reduced-motion: reduce)`):
  - the entrance jumps to its end state
  - no parallax and no sparkle trail
  - spell effects become a 0.3 s fade
  - Flip becomes a crossfade
- **Accessibility:** touch targets ≥ 44 px, text contrast ≥ 4.5:1, and only transform and opacity are animated (plus CSS custom properties for palettes).
- **Tests** sit next to their source as `*.test.ts(x)`. End-to-end tests go in `e2e/`.

## Review Focus

1. **Rapid spell clicks mid-cast:** the previous timeline is killed. Only the last spell is shown as pressed and named on stage, with no stacked effects. Pinned in Task 13.
2. **Switching house tabs mid-transition:** the last click wins, and the tabs, banner and roster all agree. Pinned in Task 15.
3. **Character with almost no data** (e.g. Moaning Myrtle: no wand, patronus, date of birth or portrait): the card and detail show the fallback card and muted `Unknown`, and nothing crashes. Pinned in Task 16.
4. **Network failure mid-quiz:** the error and retry appear, game state is kept, and a retry doesn't double-count the turn or start a new IP game. Pinned in Task 17.
5. **iOS tilt permission denied or unavailable:** parallax quietly switches to drag mode with no console error. Pinned in Task 12.

---

## Phase 1 — Foundation and data

### Task 1: Scaffold the project

**Files:**
- Create: the Next.js app at the repo root (`pnpm create next-app@latest . --ts --eslint --app --src-dir --import-alias "@/*" --no-tailwind --use-pnpm`)
- Create: `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`, `netlify.toml`, `.nvmrc` (`22`), `.env.example`, `src/app/globals.css`
- Modify: `package.json` scripts, `tsconfig.json` (`"strict": true`, `"noUncheckedIndexedAccess": true`)
- Test: `src/smoke.test.ts`

**Interfaces:**
- Produces:
  - scripts `dev`, `build`, `test` (`vitest run`), `test:e2e` (`playwright test`), `lint`, `typecheck` (`tsc --noEmit`)
  - CSS tokens in `globals.css`: `--ink`, `--ink-muted`, `--surface-0..3`, `--line`, `--gold`, plus `--house-accent` and `--house-accent-2` (default to gold)
  - fonts Cinzel and Inter via `next/font/google`, exposed as `--font-display` and `--font-body`

- [ ] **Step 1:** Run the create-next-app command above. Delete the boilerplate page content and assets.
- [ ] **Step 2:** Add the dev deps `vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom @playwright/test @axe-core/playwright`. Configure Vitest with the jsdom environment, the `@/` alias, and a setup file that imports jest-dom and stubs `window.matchMedia`.
- [ ] **Step 3:** Write `src/smoke.test.ts` asserting `expect(1 + 1).toBe(2)`. Run `pnpm test`. Expected: 1 passed.
- [ ] **Step 4:** Configure Playwright with `webServer: { command: "pnpm build && pnpm start", port: 3000 }` and two projects: `desktop` (1280×800) and `mobile` (390×844).
- [ ] **Step 5:** Write `netlify.toml` with `[build] command = "pnpm build"`, `publish = ".next"`, and `[build.environment] NODE_VERSION = "22"`. Write `.env.example` listing the seven env vars from spec §6.5 with empty values and a one-line comment each.
- [ ] **Step 6:** Run `pnpm lint && pnpm typecheck && pnpm build`. Expected: all succeed.
- [ ] **Step 7:** Commit: `chore: scaffold Next.js app with test tooling and Netlify config`.

### Task 2: HP-API client, validation, normalisation and snapshot

**Files:**
- Create: `src/data/types.ts`, `src/data/hp-api/schemas.ts`, `src/data/hp-api/client.ts`, `src/data/normalise.ts`, `src/data/repository.ts`, `scripts/snapshot.ts`, `src/data/snapshot/characters.json`, `src/data/snapshot/spells.json`
- Test: `src/data/normalise.test.ts`, `src/data/repository.test.ts`

**Interfaces:**
- Produces (in `src/data/types.ts`):
```ts
export type HouseName = "GRYFFINDOR" | "SLYTHERIN" | "RAVENCLAW" | "HUFFLEPUFF";
export interface Wand { wood: string | null; core: string | null; lengthInches: number | null }
export interface CharacterRecord {
  id: string; name: string; alternateNames: string[]; house: HouseName | null;
  ancestry: string | null; patronus: string | null; actor: string | null;
  dateOfBirth: string | null; alive: boolean; eyeColour: string | null;
  hairColour: string | null; wand: Wand | null;
}
export interface SpellRecord { id: string; name: string; description: string }
export interface WizardingData { characters: CharacterRecord[]; spells: SpellRecord[]; source: "live" | "snapshot" }
```
- Produces: `normaliseCharacter(raw: RawCharacter): CharacterRecord` and `normaliseSpell(raw: RawSpell): SpellRecord` in `normalise.ts`. `getWizardingData(deps?: { fetchImpl?: typeof fetch }): Promise<WizardingData>` in `repository.ts`, wrapped in React `cache()`.
- Note: the spec puts normalisation "in resolvers". It lives here instead, because the quiz generators need the same normalised records. Resolvers only apply curation and art.

- [ ] **Step 1:** Write `scripts/snapshot.ts`, which fetches both endpoints and writes pretty JSON to `src/data/snapshot/`. Add `"snapshot": "tsx scripts/snapshot.ts"`. Run it and confirm 437 characters and 77 spells (or the current counts).
- [ ] **Step 2: Write the failing tests** in `normalise.test.ts`:
  - `"" → null` for ancestry, patronus, actor, eye and hair colour
  - `"Gryffindor" → "GRYFFINDOR"` and `"" → null` for house
  - `dateOfBirth: "19-09-1979" → "1979-09-19"`, `"" → null`
  - wand `{ wood: "", core: "", length: null }` → `null`
  - wand `{ wood: "vine", core: "dragon heartstring", length: 10.75 }` → `{ wood: "vine", core: "dragon heartstring", lengthInches: 10.75 }`
  - the `image` field is absent from the output (`expect("image" in result).toBe(false)`)
- [ ] **Step 3:** Run `pnpm test src/data/normalise.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 4:** Implement the Zod schemas (`RawCharacter`, `RawSpell`) with lenient types for the patchy fields, plus `normalise.ts`.
- [ ] **Step 5: Write the failing tests** in `repository.test.ts`, with an injected `fetchImpl`:
  - a live 200 returns `source: "live"`
  - a rejection, a 500, or never resolving within 4000 ms (use fake timers) returns `source: "snapshot"` with snapshot counts
  - one invalid record in a live payload is dropped and `console.warn` is called once
- [ ] **Step 6:** Implement `client.ts` (an `AbortController` with a 4000 ms timeout, `next: { revalidate: 86400 }`) and `repository.ts`. Run the tests. Expected: PASS.
- [ ] **Step 7:** Commit: `feat(data): HP-API client with validation, normalisation and snapshot fallback`.

### Task 3: Curated config and art manifest

**Files:**
- Create: `src/data/curated/houses.ts`, `src/data/curated/spells.ts`, `src/data/curated/roster.ts`, `src/data/art-manifest.ts`
- Test: `src/data/curated/curated.test.ts`

**Interfaces:**
- Produces:
```ts
// houses.ts
export interface HouseInfo { name: HouseName; displayName: string; traits: string[]; accent: string; accent2: string; palette: string }
export const HOUSES: readonly HouseInfo[]; // in display order: G, S, R, H
// spells.ts
export type SpellEffectKey = "lumos"|"leviosa"|"incendio"|"expelliarmus"|"stupefy"|"protego"|"accio"|"alohomora"|"reparo"|"patronus";
export interface CuratedSpell { apiName: string; colour: string; effect: SpellEffectKey; descriptionOverride?: string }
export const CURATED_SPELLS: readonly CuratedSpell[];
// roster.ts
export const ROSTER: Readonly<Record<HouseName, readonly string[]>>; // character IDs, in display order
// art-manifest.ts
export interface ArtAsset { src: string; alt: string; width: number; height: number }
export type ArtSlot = "intro.sky"|"intro.stars"|"intro.moon"|"intro.castle"|"intro.clouds"|"spell.wand"|"spell.patronusStag"|"quiz.hat"|`portrait.${string}`;
export const ART: Partial<Record<ArtSlot, ArtAsset>>;
export function getArt(slot: ArtSlot): ArtAsset | null;
```
- Values:
  - **Houses:** traits from spec §4.3 / the wireframe (Gryffindor: Bravery · daring · nerve · chivalry; Slytherin: Ambition · cunning · leadership · resourcefulness; Ravenclaw: Intelligence · wit · learning · creativity; Hufflepuff: Hard work · patience · loyalty · fairness). Starting accents: `#C8423A`, `#2E8B57`, `#4A78C2`, `#E0B341` (these can change in visual design).
  - **Spells:** colours and order from the wireframe's Spells board. Patronus override: `"The Patronus Charm conjures a guardian of hope and happiness that drives away Dementors."`
  - **Roster:** IDs for the names in spec §5.3, looked up from the snapshot.
  - **`ART`:** starts empty.

- [ ] **Step 1: Write the failing tests:**
  - every `CURATED_SPELLS[i].apiName` exists in the snapshot spells (matched case-sensitively, e.g. `"Expecto patronum"`)
  - there are exactly 10 spells with 10 distinct effect keys
  - every roster ID exists in the snapshot, and its snapshot `house` matches the roster key
  - `ROSTER` resolves to these exact names, in order:
    - GRYFFINDOR: Harry Potter, Hermione Granger, Ron Weasley, Albus Dumbledore, Minerva McGonagall, Neville Longbottom
    - SLYTHERIN: Draco Malfoy, Severus Snape, Lord Voldemort, Bellatrix Lestrange, Horace Slughorn, Lucius Malfoy
    - RAVENCLAW: Luna Lovegood, Cho Chang, Filius Flitwick, Padma Patil, Moaning Myrtle, Xenophilius Lovegood
    - HUFFLEPUFF: Cedric Diggory, Nymphadora Tonks, Pomona Sprout, Newt Scamander, Hannah Abbott, Ernie Macmillan
  - `getArt("portrait.nope")` returns `null`
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement the four files, filling the roster IDs from `src/data/snapshot/characters.json`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(data): curated spells, houses, roster and art manifest`.

### Task 4: GraphQL read schema, route and typed client

**Files:**
- Create: `src/graphql/builder.ts`, `src/graphql/types/house.ts`, `src/graphql/types/character.ts`, `src/graphql/types/spell.ts`, `src/graphql/schema.ts`, `src/graphql/context.ts`, `src/graphql/execute.ts`, `src/graphql/client.ts`, `src/app/api/graphql/route.ts`, `codegen.ts`, `scripts/print-schema.ts`, `schema.graphql`
- Test: `src/graphql/schema.test.ts`

**Interfaces:**
- Consumes: `getWizardingData` (Task 2); `HOUSES`, `CURATED_SPELLS`, `ROSTER`, `getArt` (Task 3).
- Produces:
  - the schema exactly as in spec §5.2 (the Query half). `Character.portrait` comes from `getArt("portrait.<id>")`. `Character.initials` is the first letters of the first two words of the name.
  - `GraphQLContext = { data: WizardingData; ip: string | null }` built by `createContext(request?: Request)`. The IP comes from the `x-nf-client-connection-ip` header, falling back to the first entry of `x-forwarded-for`.
  - `executeQuery<TResult, TVars>(doc: TypedDocumentNode<TResult, TVars>, vars?: TVars): Promise<TResult>` for in-process server use. It throws if there are errors.
  - `gqlFetch<TResult, TVars>(doc, vars): Promise<TResult>` for the browser, POSTing to `/api/graphql`. It throws `GqlError` on network failure or GraphQL errors.
  - `graphql()` from `src/graphql/generated/` (the codegen client preset)
  - scripts `schema:print` and `codegen`

- [ ] **Step 1: Write the failing tests** using `executeQuery` with snapshot data:
  - `houses` returns 4 houses in G, S, R, H order, each with 6 members
  - `house(name: GRYFFINDOR) { members { name } }`, where the second member is `"Hermione Granger"`
  - `character(id: <Hermione>)` returns the wand `{ wood: "vine", core: "dragon heartstring", lengthInches: 10.75 }`, the `dateOfBirth` `"1979-09-19"`, and `initials: "HG"`
  - `character(id: <Snape>) { wand }` is `null`
  - `spells` returns 10 entries in curated order, where `spells[9].description` equals the override
  - the schema has no field named `image` (introspection check)
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement the builder (Pothos, with `HouseName` and `SpellEffectKey` enums), the types, the context, `execute.ts` (using graphql-js `execute` against the built schema), and the yoga route handler exporting `GET` and `POST`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Add `print-schema.ts`, which writes `schema.graphql` with `printSchema`, and `codegen.ts` (client preset, `documents: "src/**/*.{ts,tsx}"`, output `src/graphql/generated/`). Run `pnpm schema:print && pnpm codegen`. Expected: generated files appear, and `pnpm typecheck` passes.
- [ ] **Step 6:** Start `pnpm dev`, then run `curl -s localhost:3000/api/graphql -H 'content-type: application/json' -d '{"query":"{ spells { name } }"}'`. Expected: 10 spell names.
- [ ] **Step 7:** Commit: `feat(graphql): Pothos read schema, yoga route, in-process executor and typed client`.

## Phase 2 — Quiz engine

### Task 5: Quiz types, seeded RNG and question generators

**Files:**
- Create: `src/quiz/types.ts`, `src/quiz/rng.ts`, `src/quiz/generators/index.ts`, and one file per topic in `src/quiz/generators/`: `wand.ts`, `patronus.ts`, `spell.ts`, `actor.ts`, `house.ts`, `portrait.ts`
- Test: `src/quiz/generators/generators.test.ts`

**Interfaces:**
- Consumes: `CharacterRecord`, `SpellRecord`, `HouseName` (Task 2); `ROSTER`, `CURATED_SPELLS`, `getArt` (Task 3).
- Produces (in `src/quiz/types.ts`):
```ts
export type Topic = "wand" | "patronus" | "spell" | "actor" | "house" | "portrait";
export type Difficulty = "normal" | "hard";
export type QuizMode = "ai" | "classic";
export interface QuestionSpec { topic: Topic; difficulty: Difficulty }
export interface Option { id: string; label: string }
export interface Question { id: string; topic: Topic; difficulty: Difficulty; prompt: string; artSlot: string | null; options: Option[]; correctOptionId: string }
export interface TurnRecord { topic: Topic; difficulty: Difficulty; dared: boolean; correct: boolean; msToAnswer: number }
export interface GameState { seed: number; mode: QuizMode; turns: TurnRecord[] }
export interface QuizData { characters: CharacterRecord[]; spells: SpellRecord[] }
export interface Quizmaster {
  readonly mode: QuizMode;
  nextTurn(state: GameState, dared: boolean): Promise<{ spec: QuestionSpec; hatLine: string }>;
  verdict(stats: PlayStats, house: HouseName): Promise<string>;
}
```
(`PlayStats` is defined in Task 6. Import it here as a type.)
- Produces: `createRng(seed: number): () => number` (mulberry32) in `rng.ts`. `generateQuestion(spec, data, rng): Question | null` and `availableTopics(data): Topic[]` in `generators/index.ts`. Each generator has the signature `(difficulty, data, rng) => Question | null`.
- Generator rules (the distractor choice is the only way difficulty shows up):

| Topic | Pool | Prompt | Normal distractors | Hard distractors |
|---|---|---|---|---|
| wand | characters with wood, core and length all set | `"{Wood}, {core}, {length} inches. Whose wand is this?"` | any other pool member | pool members sharing wood or core, topped up randomly |
| patronus | patronus set and not `"Non-Corporeal"` | `"Whose Patronus is {a/an} {patronus}?"` | any | same house as the answer, topped up randomly |
| spell | normal: the curated 10; hard: all spells | `"Which spell: “{description}”?"` | from the same pool | from the same pool |
| actor | roster characters with an actor (hard: all characters with an actor) | `"Who played {name}?"` | actors from the pool | actors of same-house characters |
| house | normal: roster characters; hard: non-roster characters with a house | `"Which house was {name} in?"` | the other 3 houses | the other 3 houses |
| portrait | characters with `getArt("portrait.<id>")` | `"Who is this?"`, with `artSlot` set | any | same house |

  Every generator returns `null` if fewer than 4 distinct labels can be formed. Options are shuffled with `rng`, and IDs are stable (`"<questionId>:<index>"`).

- [ ] **Step 1: Write the failing tests** (seeded with `createRng(42)`, using snapshot data):
  - for every topic in `availableTopics(data)` and both difficulties: 4 options, 4 distinct labels, `correctOptionId` is among them, and the prompt is non-empty
  - the same seed gives deep-equal questions, and a different seed gives a different question for at least one topic
  - the hard wand question's distractors each share wood or core with the answer, when the pool allows it
  - `availableTopics` excludes `"portrait"` while `ART` is empty, and `generateQuestion({topic:"portrait",...})` returns `null`
  - a `QuizData` with only 3 wand-complete characters makes the wand generator return `null`
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement `rng.ts`, the six generators and `index.ts`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(quiz): seeded question generators for six topics`.

### Task 6: Play stats and the sorting formula

**Files:**
- Create: `src/quiz/sorting.ts`
- Test: `src/quiz/sorting.test.ts`

**Interfaces:**
- Produces:
```ts
export interface PlayStats { turns: number; dares: number; hardAsked: number; hardCorrect: number; correct: number; longestStreak: number; totalPoints: number; pointsFromStrongTopicDares: number }
export type HouseScores = Record<HouseName, number>;
export function computePlayStats(turns: TurnRecord[]): PlayStats;
export function sortIntoHouse(stats: PlayStats): { house: HouseName; scores: HouseScores };
export const SORTING_WEIGHTS: { ravenclawSaturation: 5; streakWeight: 0.5; accuracyWeight: 0.5 };
```
- Formula (spec §6.4, with the exact constants):
  - G = `dares / turns`
  - R = `hardAsked === 0 ? 0 : (hardCorrect / hardAsked) * min(1, hardAsked / 5)`
  - H = `0.5 * (longestStreak / 10) + 0.5 * (correct / turns)`
  - S = `totalPoints === 0 ? 0 : pointsFromStrongTopicDares / totalPoints`
  - A "strong topic" is a topic whose accuracy over the game is ≥ the overall accuracy.
  - Ties break in the order RAVENCLAW > HUFFLEPUFF > GRYFFINDOR > SLYTHERIN.
  - Every score is 0 when `turns === 0`.

- [ ] **Step 1: Write the failing table-driven tests:**
  - 10 safe, all correct → `HUFFLEPUFF` (H = 1)
  - 10 dared, all correct → `RAVENCLAW` (G, R, H and S are all 1, so the tie-break decides)
  - 10 dared, all wrong → `GRYFFINDOR`
  - 4 dared wand questions (C, C, C, W), then 6 safe patronus questions (C, C, C, W, W, W) → `SLYTHERIN`, with scores G 0.4, R 0.6, H 0.45 and S ≈ 0.667 (use `toBeCloseTo`)
  - `computePlayStats([])` is all zeros, and `sortIntoHouse` of that gives `RAVENCLAW` with all scores 0
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement `sorting.ts`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(quiz): play stats and deterministic house sorting`.

### Task 7: Classic quizmaster

**Files:**
- Create: `src/quiz/classic-quizmaster.ts`, `src/quiz/hat-lines.ts`
- Test: `src/quiz/classic-quizmaster.test.ts`

**Interfaces:**
- Consumes: `Quizmaster`, `GameState`, `Topic`, `createRng` (Task 5); `PlayStats` (Task 6).
- Produces: `createClassicQuizmaster(opts: { topics: Topic[] }): Quizmaster`, with `mode: "classic"`.
  - `hat-lines.ts` exports `HAT_LINES: { opening: string[]; safeRight: string[]; safeWrong: string[]; daredRight: string[]; daredWrong: string[]; daring: string[]; safe: string[] }` with at least 3 lines each. Seed them with the wireframe lines.
  - It also exports `CLASSIC_VERDICTS: Record<HouseName, string>`.
- Behaviour:
  - the RNG is `createRng(state.seed + state.turns.length)`
  - the topic is never the same as the previous turn's
  - each topic is weighted by `2 - accuracy`, where accuracy defaults to 0.5 for unseen topics
  - difficulty is `"hard"` if dared, else `"normal"`
  - the Hat line reacts to the last turn (`safeRight` and so on), or uses `opening` on turn 0

- [ ] **Step 1: Write the failing tests:**
  - the same state gives the same output
  - over 9 sequential turns there are never two topics in a row
  - `dared: true` gives `difficulty: "hard"`
  - after a wrong dared turn, the `hatLine` is in `HAT_LINES.daredWrong`
  - over 200 seeds with patronus at 0/3 accuracy and wand at 3/3, patronus is picked more often than wand
  - `verdict(stats, "SLYTHERIN")` equals `CLASSIC_VERDICTS.SLYTHERIN`
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(quiz): rule-based classic quizmaster`.

### Task 8: Budget guard

**Files:**
- Create: `src/quiz/budget/budget-guard.ts`, `src/quiz/budget/redis.ts`, `src/quiz/budget/hash-ip.ts`
- Test: `src/quiz/budget/budget-guard.test.ts`

**Interfaces:**
- Produces:
```ts
export interface RedisLike { get(key: string): Promise<number | string | null>; incrby(key: string, by: number): Promise<number>; expire(key: string, seconds: number): Promise<unknown> }
export interface BudgetGuard {
  tryStartGame(ipHash: string, now: Date): Promise<boolean>; // increments the per-IP counter; false if it is now over the limit
  hasBudget(now: Date): Promise<boolean>;                    // today's tokens < the daily budget
  recordUsage(tokens: number, now: Date): Promise<void>;
}
export function createBudgetGuard(opts: { redis: RedisLike; dailyTokenBudget: number; gamesPerIpPerDay: number }): BudgetGuard;
export function getRedis(): RedisLike | null;   // @upstash/redis from env, or null when the env vars are missing
export function hashIp(ip: string, salt: string): string; // sha256(salt + ip), hex
```

- [ ] **Step 1: Write the failing tests** with an in-memory fake `RedisLike`:
  - the 4th `tryStartGame` for the same hash on the same UTC day returns `false` when the limit is 3
  - a call at `2026-10-22T23:59:59Z` and one at `2026-10-23T00:00:01Z` use different keys
  - `recordUsage(150_000)` followed by `recordUsage(60_000)` makes `hasBudget` false with a 200 000 budget
  - every `incrby` is followed by `expire(key, 172800)`
  - `hashIp("1.2.3.4","s")` is 64 hex characters, stable, and never contains the IP
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement the three files.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(quiz): Redis-backed daily token budget and per-IP game limit`.

### Task 9: AI quizmaster

Before writing code, the implementer loads the `claude-api` skill and reads its TypeScript README and tool-use pages for the exact SDK call shapes.

**Files:**
- Create: `src/quiz/ai-quizmaster.ts`, `src/quiz/ai-prompt.ts`
- Test: `src/quiz/ai-quizmaster.test.ts`

**Interfaces:**
- Consumes: `Quizmaster` and types (Task 5); `PlayStats` (Task 6).
- Produces: `createAiQuizmaster(deps: { client: Pick<Anthropic, "messages">; model: string; topics: Topic[]; onUsage: (tokens: number) => Promise<void> }): Quizmaster`, with `mode: "ai"`. It also exports `AiQuizmasterError`.
  - `ai-prompt.ts` exports `SYSTEM_PROMPT: string` (fixed text, no interpolation), `POSE_QUESTION_TOOL` (name `pose_question`, `strict: true`), and `buildTurnMessage(state, dared, topics): string`.
  - Tool input schema: `{ topic: enum(Topic), difficulty: enum(Difficulty), hat_line: string, maxLength 160 }`, with `additionalProperties: false` and all fields required.
- Behaviour:
  - `nextTurn` sends one `messages.create` with the settings from Global Constraints and the request options `{ timeout: 6000, maxRetries: 0 }`
  - it reads the first `tool_use` block and validates its input with Zod
  - it overrides `difficulty` so it matches the dare, because the dare is the player's choice and isn't up to the AI
  - it calls `onUsage(usage.input_tokens + usage.output_tokens)` on **every** response, including invalid ones
  - `verdict` sends one call without tools (`max_tokens: 300`) and returns the trimmed text
  - every failure throws `AiQuizmasterError`

- [ ] **Step 1: Write the failing tests** with a fake `client.messages.create`:
  - a valid tool call returns the spec and `hatLine`, and `onUsage` receives the token sum
  - the request has `tool_choice: { type: "auto" }`, `output_config: { effort: "low" }`, `max_tokens: 400`, the model from deps, and options `{ timeout: 6000, maxRetries: 0 }`
  - `dared: true` plus the AI returning `difficulty: "normal"` gives `spec.difficulty === "hard"`
  - a response with no `tool_use` block → `AiQuizmasterError`, and `onUsage` is still called
  - a topic that isn't in `topics` → `AiQuizmasterError`
  - `stop_reason: "refusal"` → `AiQuizmasterError`
  - the SDK rejecting (timeout) → `AiQuizmasterError`
  - two calls send byte-identical `system` and `tools`
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. Keep `SYSTEM_PROMPT` to the persona and rules in spec §6.3: vary topics, lean toward weak topics, one line ≤ 160 characters, never hint at the answer, always call `pose_question`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(quiz): Claude-backed quizmaster with strict tool and usage reporting`.

### Task 10: Quizmaster selection and quiz mutations

**Files:**
- Create: `src/quiz/select-quizmaster.ts`, `src/quiz/config.ts`, `src/graphql/types/quiz.ts`
- Modify: `src/graphql/schema.ts` (register the quiz types)
- Test: `src/quiz/select-quizmaster.test.ts`, `src/graphql/quiz.test.ts`

**Interfaces:**
- Consumes: Tasks 5–9.
- Produces:
  - `readQuizConfig(env = process.env): { apiKey: string | null; model: "claude-haiku-5-5" | "claude-opus-5-5"; dailyTokenBudget: number; gamesPerIpPerDay: number; ipSalt: string | null }`
  - `selectQuizmaster(args: { state: GameState; ip: string | null; now: Date; config; guard: BudgetGuard | null; makeAi: () => Quizmaster; classic: Quizmaster }): Promise<Quizmaster>`. It returns classic when `state.mode === "classic"`, or when there's no API key, no guard, no IP or no salt. On turn 0 it returns classic if `tryStartGame` is false. Otherwise it returns classic if `!hasBudget`, else AI.
  - GraphQL, as in spec §5.2/§6.2: `quizTurn(input: { state: GameStateInput!, dared: Boolean! }): QuizTurn { question, hatLine, mode }` and `quizVerdict(input: { state: GameStateInput! }): QuizVerdict { house, scores { gryffindor slytherin ravenclaw hufflepuff }, verdict, mode }`.
- Resolver rules:
  - reject input with more than 10 turns (`quizTurn` requires < 10, `quizVerdict` requires exactly 10) using a GraphQL error with code `BAD_INPUT`
  - if an AI call throws, rerun the turn with the classic quizmaster and return `mode: "classic"`
  - if the generator returns `null` for the chosen spec, try the remaining available topics in order with the classic quizmaster's difficulty, then fail with `INTERNAL`

- [ ] **Step 1: Write the failing tests** for `selectQuizmaster`, one per branch above (8 cases). Write the failing tests for the mutations using `executeQuery` with injected fakes (a factory on the context: `context.quiz = { guard, makeAi, classic, now }`):
  - the happy AI path returns `mode: "ai"` and a valid question
  - an AI failure gives `mode: "classic"` with a valid question
  - 11 turns gives `BAD_INPUT`
  - a verdict with 10 turns returns the house from `sortIntoHouse`
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. `createContext` builds `context.quiz` from the real env via `readQuizConfig`, `getRedis`, `createBudgetGuard`, `createAiQuizmaster`, and `new Anthropic({ apiKey })` only when there's a key.
- [ ] **Step 4:** Run the tests, then `pnpm schema:print && pnpm codegen && pnpm typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(quiz): quizmaster selection with sticky classic fallback and GraphQL mutations`.

## Phase 3 — Page and sections

For UI tasks, component tests check behaviour and ARIA (not motion). Animation feel is reviewed by eye with `pnpm dev`. Each section takes its data as props from `page.tsx`.

### Task 11: Page shell, shared components and animation setup

**Files:**
- Create: `src/app/page.tsx`, `src/app/page.query.ts`, `src/animation/gsap.ts`, `src/animation/motion.ts`, `src/components/HouseEmblem.tsx`, `src/components/FallbackCard.tsx`, `src/components/Art.tsx`, `src/components/MapNav.tsx`, `src/components/house-selection.tsx`, and a placeholder `index.tsx` per section in `src/sections/{intro,spells,characters,quiz,footer}/`
- Modify: `src/app/layout.tsx`, `src/data/hp-api/client.ts` (adds the `HP_API_BASE_URL` override), `playwright.config.ts` (`webServer.env`)
- Test: `src/components/components.test.tsx`, `e2e/shell.spec.ts`

**Interfaces:**
- Produces:
  - `gsap.ts` registers ScrollTrigger, SplitText and Flip once and re-exports `gsap`
  - `motion.ts` exports `REDUCED_MOTION = "(prefers-reduced-motion: reduce)"` and `withMotion(ctx: gsap.MatchMedia, full: () => void, reduced: () => void)`
  - `<HouseEmblem house={HouseName} size={number} />`: an inline SVG shield with the path `M4 3h32v19c0 11-8 18-16 21C12 40 4 33 4 22z` (viewBox `0 0 40 46`), the house accent as stroke, and the initial in the display font. It's `aria-hidden`.
  - `<FallbackCard name initials house />`
  - `<Art slot fallback={ReactNode} sizes? />`: uses `next/image` when `getArt(slot)` returns an asset, otherwise renders the fallback
  - `<MapNav />`: the three links from Global Constraints. It hides on scroll down and shows on scroll up (ScrollTrigger `onUpdate` direction). Below 640 px it's a single `Map` button opening a sheet, with `aria-expanded`.
  - `HouseSelectionProvider` and `useHouseSelection(): { house: HouseName; selectHouse(h: HouseName, opts?: { scroll?: boolean }): void }`
  - `page.tsx` runs `PageDataQuery` (houses with members, spells) via `executeQuery`, sets `export const revalidate = 86400`, and renders the sections in order with ids `top`, `classroom`, `great-hall`, `sorting-ceremony`

- [ ] **Step 1: Write the failing tests:**
  - `HouseEmblem` renders the letter `R` for `RAVENCLAW`
  - `Art` with an unknown slot renders its fallback
  - `MapNav` links point to `#classroom`, `#great-hall` and `#sorting-ceremony`
  - `selectHouse("SLYTHERIN")` updates `useHouseSelection().house`
- [ ] **Step 2:** Run the tests. Expected: FAIL. Implement. Run them again. Expected: PASS.
- [ ] **Step 3: Write `e2e/shell.spec.ts`:** with `page.route("**/hp-api.onrender.com/**", r => r.abort())`, the page loads, all four section landmarks are visible, there are zero console errors, and `@axe-core/playwright` reports no serious or critical violations. The server-side fetch can't be intercepted by Playwright, so also start the web server with `HP_API_BASE_URL=http://127.0.0.1:9` in the Playwright config. That means adding an `HP_API_BASE_URL` override (default `https://hp-api.onrender.com`) to `client.ts`.
- [ ] **Step 4:** Run `pnpm test:e2e e2e/shell.spec.ts`. Expected: PASS in both projects.
- [ ] **Step 5:** Commit: `feat(ui): page shell, emblem, fallback card, art slots, map nav`.

### Task 12: Intro section

**Files:**
- Create: `src/sections/intro/Intro.tsx`, `src/sections/intro/intro.module.css`, `src/sections/intro/intro-timeline.ts`, `src/sections/intro/parallax.ts`, `src/animation/sparkle-trail/particle-pool.ts`, `src/animation/sparkle-trail/sparkle-trail.ts`
- Test: `src/sections/intro/parallax.test.ts`, `src/animation/sparkle-trail/particle-pool.test.ts`

**Interfaces:**
- Produces:
  - `buildIntroTimeline(refs: { sky; stars: Element[]; moon; castle; clouds: Element[]; title; tagline; cue }): gsap.core.Timeline`, in the order from spec §4.1, about 3.5 s in total
  - `createParallax(layers: { el: HTMLElement; depth: number }[]): { setSource(s: "pointer" | "tilt" | "drag"): void; destroy(): void }`
  - `requestTiltPermission(): Promise<boolean>`
  - `createParticlePool(size: number)` with `{ spawn(x, y): void; step(dt): void; forEach(cb): void; readonly active: number }`
  - `createSparkleTrail(canvas, { poolSize: 120 }): { start(); stop(); destroy() }`
- Depths: sky 0.05, stars 0.12, moon 0.2, castle 0.45, clouds 0.8. The first scroll calls `tl.progress(1)`. Tilt is requested on the first touch, not on page load.

- [ ] **Step 1: Write the failing tests:**
  - the particle pool's `active` never exceeds `size` after 1000 spawns, and particles retire after their lifetime
  - `requestTiltPermission()` resolves `false` when `DeviceOrientationEvent.requestPermission` rejects, when it resolves `"denied"`, and when `DeviceOrientationEvent` is undefined, with no thrown error and no `console.error` (**Review Focus 5**)
  - it resolves `true` on `"granted"`
- [ ] **Step 2:** Run the tests. Expected: FAIL. Implement. Run them again. Expected: PASS.
- [ ] **Step 3:** Build `Intro.tsx`. The layers come from `<Art slot="intro.*">`, and each fallback is a flat CSS shape. The `h1` uses SplitText for the shimmer, and the wand cursor uses `cursor: none` on fine pointers only (the system cursor stays for keyboard focus). The sparkle trail pauses via IntersectionObserver and `visibilitychange`. Reduced motion follows Global Constraints.
- [ ] **Step 4:** Check by eye with `pnpm dev`: the entrance order, skip on scroll, parallax depth, trail, and reduced motion (DevTools rendering emulation).
- [ ] **Step 5:** Commit: `feat(intro): layered night sky with entrance timeline, parallax and sparkle trail`.

### Task 13: Spells section and cast sequence

**Files:**
- Create: `src/sections/spells/Spells.tsx`, `src/sections/spells/spells.module.css`, `src/animation/cast.ts`, `src/animation/spell-effects/index.ts`, `src/animation/spell-effects/types.ts`
- Test: `src/sections/spells/Spells.test.tsx`

**Interfaces:**
- Consumes: the `spells` query result (Task 4).
- Produces:
  - `StageRefs = { stage: HTMLElement; wand: HTMLElement; tip: HTMLElement; fx: HTMLElement }`
  - `SpellEffect = (stage: StageRefs, colour: string) => gsap.core.Timeline`
  - `SPELL_EFFECTS: Record<SpellEffectKey, SpellEffect>`
  - `castSpell(stage: StageRefs, spell: { colour: string; effect: SpellEffectKey }, previous: gsap.core.Timeline | null): gsap.core.Timeline` kills `previous`, clears `fx`, then plays `wandFlick → bolt(colour) → effect`
- This task registers all 10 keys with a temporary `placeholderEffect` (a flash of colour in `fx`). Task 14 replaces them.

- [ ] **Step 1: Write the failing tests:**
  - 10 buttons render in curated order, and the first has `aria-pressed="true"` on mount
  - clicking "Protego" sets it to pressed and updates the stage heading
  - clicking Incendio, Accio and Reparo within 50 ms leaves exactly one pressed button (Reparo), with the stage heading "Reparo", and `castSpell` called 3 times with each call's `previous` being the timeline the prior call returned (**Review Focus 1**)
- [ ] **Step 2:** Run the tests. Expected: FAIL. Implement the section: pinned with ScrollTrigger on desktop (`pin: true`, `end: "+=100%"`) and not pinned below 640 px, where the list becomes a horizontal scroll-snap chip row. Run the tests again. Expected: PASS.
- [ ] **Step 3:** Check by eye: the auto-cast on arrival, the pin, and the description writing in with SplitText.
- [ ] **Step 4:** Commit: `feat(spells): spell list, stage and interruptible cast sequence`.

### Task 14: The ten signature effects

**Files:**
- Create: one effect per key in `src/animation/spell-effects/`: `lumos.ts`, `leviosa.ts`, `incendio.ts`, `expelliarmus.ts`, `stupefy.ts`, `protego.ts`, `accio.ts`, `alohomora.ts`, `reparo.ts`, `patronus.ts`
- Modify: `src/animation/spell-effects/index.ts`
- Test: `src/animation/spell-effects/effects.test.ts`

**Interfaces:**
- Consumes: `SpellEffect` and `StageRefs` (Task 13).
- Each effect is described in the wireframe's Spells board. Notes:
  - Lumos: a radial-gradient spotlight that follows the pointer within the stage while active
  - Patronus: uses `<Art slot="spell.patronusStag">`, with an SVG outline stag as fallback (drawn by us)
  - Reparo: 6–8 polygon shards that tween back into place

- [ ] **Step 1: Write the failing test:** for every key, calling the effect on a jsdom stage returns a `gsap.core.Timeline` with a duration between 0.3 and 3 s. After `tl.progress(1)`, every element the effect added to `fx` has opacity 0 or has been removed, so nothing is left behind.
- [ ] **Step 2:** Run the test. Expected: FAIL (placeholders don't clean up). Implement the 10 effects. Run the test. Expected: PASS.
- [ ] **Step 3:** Check by eye: each effect against its wireframe description, and the reduced-motion version (0.3 s fade).
- [ ] **Step 4:** Commit: `feat(spells): ten signature spell effects`.

### Task 15: Characters section

**Files:**
- Create: `src/sections/characters/Characters.tsx`, `src/sections/characters/CharacterCard.tsx`, `src/sections/characters/characters.module.css`, `src/sections/characters/roster-swap.ts`, `src/sections/characters/palette.ts`
- Test: `src/sections/characters/Characters.test.tsx`

**Interfaces:**
- Consumes: `houses { name displayName traits members { … } }` (Task 4); `useHouseSelection` (Task 11); `HouseEmblem`, `Art`, `FallbackCard`.
- Produces:
  - `swapRoster(outEls: Element[], inEls: Element[], previous: gsap.core.Timeline | null): gsap.core.Timeline`, which kills `previous`
  - `tweenPalette(root: HTMLElement, house: HouseInfo): gsap.core.Tween`, which tweens `--house-accent` and `--house-accent-2`
  - `<CharacterCard character onOpen />` with `data-flip-id={character.id}`
- Tabs follow the ARIA tabs pattern: `role="tablist"`, `role="tab"` with `aria-selected`, roving `tabIndex`, Left/Right/Home/End keys, and `role="tabpanel"` labelled by its tab.

- [ ] **Step 1: Write the failing tests:**
  - 4 tabs, with Gryffindor selected, and 6 cards
  - the ArrowRight key moves focus and selection to Slytherin
  - clicking Slytherin then Ravenclaw within 50 ms ends with Ravenclaw `aria-selected`, banner heading "Ravenclaw" and Luna Lovegood's card present, with no Slytherin names in the panel (**Review Focus 2**)
  - `selectHouse("HUFFLEPUFF")` from the context selects the Hufflepuff tab
  - a member with `portrait: null` renders `FallbackCard` with its initials
- [ ] **Step 2:** Run the tests. Expected: FAIL. Implement. Run them again. Expected: PASS.
- [ ] **Step 3:** Check by eye: the palette blend, the sweep-out and deal-in stagger, and the 2-up layout at 390 px.
- [ ] **Step 4:** Commit: `feat(characters): house tabs, palette shift and roster transitions`.

### Task 16: Character detail panel

**Files:**
- Create: `src/sections/characters/CharacterDetail.tsx`, `src/sections/characters/useFocusTrap.ts`, `src/sections/characters/format.ts`
- Modify: `src/sections/characters/Characters.tsx`
- Test: `src/sections/characters/CharacterDetail.test.tsx`, `src/sections/characters/format.test.ts`, `e2e/characters.spec.ts`

**Interfaces:**
- Produces:
  - `formatField(value: string | null): string`, which returns `"Unknown"` for null
  - `formatDate(iso: string | null): string`, e.g. `"1979-09-19" → "19 Sep 1979"`
  - `formatWand(w: Wand | null): string`, e.g. `"Vine · dragon heartstring · 10¾ in"`; parts that are missing are left out, and `null` gives `"Unknown"`. Fractions: .25 → ¼, .5 → ½, .75 → ¾.
  - `<CharacterDetail character house onClose onPrev onNext />`: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at the name heading. Esc closes it and focus returns to the opening card. Open and close use `Flip.from` keyed by `data-flip-id`. Below 640 px it's a bottom sheet that closes on a downward drag past 30% of its height.
- Missing values render with the muted style.

- [ ] **Step 1: Write the failing tests:**
  - the `formatWand` / `formatDate` / `formatField` cases above
  - rendering Moaning Myrtle from the snapshot: the heading is "Moaning Myrtle", `Unknown` shows for wand, patronus and born, `FallbackCard` is rendered, and there's no thrown error (**Review Focus 3**)
  - the next button calls `onNext`
  - Esc calls `onClose`
- [ ] **Step 2:** Run the tests. Expected: FAIL. Implement. Run them again. Expected: PASS.
- [ ] **Step 3: Write `e2e/characters.spec.ts`:** using only the keyboard, Tab to the house tabs, use ArrowRight to reach Ravenclaw, Tab to the first card, press Enter to open the dialog, check that focus stays inside it across 10 Tab presses, press Esc, and check that focus is back on the card.
- [ ] **Step 4:** Run `pnpm test:e2e e2e/characters.spec.ts`. Expected: PASS in both projects.
- [ ] **Step 5:** Commit: `feat(characters): Flip detail panel with focus trap and graceful missing data`.

### Task 17: Quiz UI and result screen

**Files:**
- Create: `src/sections/quiz/Quiz.tsx`, `src/sections/quiz/quiz.module.css`, `src/sections/quiz/useQuizGame.ts`, `src/sections/quiz/quiz.graphql.ts`, `src/sections/quiz/DareStep.tsx`, `src/sections/quiz/QuestionCard.tsx`, `src/sections/quiz/HatVoice.tsx`, `src/sections/quiz/Result.tsx`
- Test: `src/sections/quiz/useQuizGame.test.ts`, `src/sections/quiz/Quiz.test.tsx`, `e2e/quiz.spec.ts`

**Interfaces:**
- Consumes: `quizTurn` / `quizVerdict` documents through `gqlFetch` (Task 4/10); `useHouseSelection` (Task 11); `HouseEmblem`.
- Produces: `useQuizGame(deps: { fetchTurn; fetchVerdict; now?: () => number; seed?: number })`, a reducer-backed hook returning:
  - `phase: "intro" | "dare" | "loading" | "question" | "answered" | "verdict-loading" | "result" | "error"`
  - `state: GameState`, `score: number`, `question: Question | null`, `hatLine: string`, `mode: QuizMode`, `result: { house; scores; verdict } | null`
  - `start()`, `choose(dared: boolean)`, `answer(optionId: string)`, `next()`, `retry()`, `restart()`
- Rules:
  - `mode` starts as `"ai"` and becomes `"classic"` permanently once any response says so
  - a turn is added to `state.turns` only in `answer()`
  - `retry()` re-sends exactly the request that failed
  - after the 10th `next()` it calls `fetchVerdict`
  - `msToAnswer` runs from the moment the question is shown to the moment of the answer
- UI copy and layout follow the wireframe's Quiz and Quiz result boards:
  - the Hat line types in with a stepped GSAP tween, and the full text is always in the DOM for screen readers
  - feedback goes to a `aria-live="polite"` region
  - the correct and the chosen option are labelled with text (`Correct` / `Your answer`)
  - the error copy is exact (Global Constraints)
  - "Meet your housemates" calls `selectHouse(result.house, { scroll: true })`

- [ ] **Step 1: Write the failing hook tests** with fake fetchers:
  - a full 10-turn game reaches `"result"`, with `state.turns.length === 10` and the score equal to the sum of the points
  - a response with `mode: "classic"` on turn 3 keeps `mode === "classic"` on turns 4–10 even if a later fake returns `"ai"`
  - `fetchTurn` rejecting on turn 4 → `phase: "error"`, `turns.length === 3`. Then `retry()` sends a request deep-equal to the failed one (same `state`, same `dared`), and on success `turns.length` is still 3 until `answer()` is called (**Review Focus 4**)
  - `restart()` resets to `"intro"` with a new seed
- [ ] **Step 2:** Run the tests. Expected: FAIL. Implement `useQuizGame`. Run them again. Expected: PASS.
- [ ] **Step 3: Write the failing component tests:**
  - the badge text matches the exact copy for each mode
  - with `ART["quiz.hat"]` absent, no hat image renders, but `— The Sorting Hat` does
  - the result screen's "Meet your housemates" calls `selectHouse` with the house
- [ ] **Step 4:** Implement the components. Run the tests. Expected: PASS.
- [ ] **Step 5: Write `e2e/quiz.spec.ts`** (server started with no AI env, so classic mode): play 10 turns choosing Dare on odd turns and the first option each time. The badge shows `The Hat is resting · classic mode`, the result shows one of the four house names, and "Meet your housemates" scrolls to `#great-hall` with that house's tab selected.
- [ ] **Step 6:** Run `pnpm test:e2e e2e/quiz.spec.ts`. Expected: PASS.
- [ ] **Step 7:** Commit: `feat(quiz): dare-and-answer quiz UI with Hat voice, fallback badge and result`.

### Task 18: Footer, reduced-motion pass and final checks

**Files:**
- Create: `src/sections/footer/Footer.tsx`, `src/sections/footer/footer.module.css`, `e2e/reduced-motion.spec.ts`, `README.md`

**Interfaces:**
- Consumes: `MapNav` links (Task 11).
- `README.md` covers:
  - local setup and `pnpm snapshot`
  - the env vars table
  - Anthropic Console setup: a dedicated workspace, a dedicated key, and a monthly spend limit (suggested $5)
  - Upstash setup
  - Netlify deploy with env vars
  - how to add art by editing `art-manifest.ts`

- [ ] **Step 1:** Build the footer with the exact copy. "Mischief managed." writes in with SplitText when it scrolls into view (a ScrollTrigger with `once: true`). It includes a "Back to the sky ↑" link to `#top`.
- [ ] **Step 2: Write `e2e/reduced-motion.spec.ts`:** with `page.emulateMedia({ reducedMotion: "reduce" })`, on load the title and tagline are visible right away (opacity 1 within 100 ms), the sparkle canvas isn't present, and clicking a spell makes its heading visible within 500 ms.
- [ ] **Step 3:** Run `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`. Expected: all pass.
- [ ] **Step 4:** Run `pnpm build && pnpm start` and do a Lighthouse pass in Chrome DevTools (mobile): Accessibility ≥ 95, and no CLS from the intro. Note the scores in the commit message.
- [ ] **Step 5:** Commit: `feat(footer): mischief managed footer, reduced-motion e2e and README`.

### Task 19 (stretch): Illustrated wand

**Files:**
- Create: `src/sections/characters/WandIllustration.tsx`, `src/sections/characters/wand-woods.ts`
- Modify: `src/sections/characters/CharacterDetail.tsx`
- Test: `src/sections/characters/WandIllustration.test.tsx`

**Interfaces:**
- Produces:
  - `WOOD_TONES: Record<string, string>`, covering every distinct wood in the snapshot, with a default tone
  - `<WandIllustration wand={Wand} />`: one SVG on a 0–15 in scale. Its width is `lengthInches / 15` of the track, filled with the wood tone and a core streak. It has `role="img"` and an `aria-label` equal to `formatWand(wand)`.
- If `lengthInches` is null, render the text only.

- [ ] **Step 1: Write the failing tests:**
  - Hermione's wand gives a rendered width ratio of 0.7167 (±0.001)
  - Lucius's 18 in wand is clamped to 1.0
  - a wood missing from `WOOD_TONES` uses the default tone
  - the `aria-label` matches `formatWand`
- [ ] **Step 2:** Run the tests. Expected: FAIL. Implement. Run them again. Expected: PASS.
- [ ] **Step 3:** Commit: `feat(characters): illustrated wand (stretch)`.
