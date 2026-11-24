# PotterDB Data and Wand Rule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ask at most one wand question per round (hard turns only), and replace HP-API with a build-time snapshot merged from PotterDB (characters, spells) and HP-API (actors only), so the quiz and roster have far more data.

**Architecture:** `pnpm snapshot` fetches PotterDB (rate-limited, ~4 min) and HP-API once, normalises and merges them into our own `CharacterRecord`/`SpellRecord` shape, and commits the result. At runtime the repository only reads and validates that snapshot: no network. A shared topic rule decides which topics a turn may use, and the resolver enforces it whatever the AI asks for.

**Tech Stack:** Next.js 16, TypeScript, zod, Vitest, Playwright, `tsx` for scripts.

**Spec:** this plan carries its own decisions (below), agreed in conversation on 2026-11-23/24. The site design remains `docs/superpowers/specs/2026-10-22-harry-potter-site-design.md`.

## Decisions (the spec for this plan)

- **D1 Wand rule.** A wand question may only be asked on a hard (dared) turn, and at most once per round. It applies in AI and classic mode alike.
- **D2 No runtime fetching.** PotterDB allows 15 requests/min per IP, so the site never calls it (or HP-API) at runtime. The committed snapshot is the only data path. `HP_API_BASE_URL`, the live/snapshot `source`, the HP-API runtime client and the e2e `hp-api` route aborts go away. `page.tsx` drops `revalidate` (the page is fully static).
- **D3 Snapshot is normalised.** `src/data/snapshot/characters.json` and `spells.json` hold `CharacterRecord[]` / `SpellRecord[]` (our shape, pretty-printed, sorted by id), not raw API payloads.
- **D4 IDs are PotterDB slugs** (`"harry-potter"`), for both characters and spells. `ROSTER`, `CURATED_SPELLS` and art-manifest slots (`portrait.<slug>`) use slugs.
- **D5 Which characters are kept:** those with a house, a corporeal patronus, or a parsed wand (wood, core and length all known), plus every featured character.
- **D6 Featured characters.** `src/data/curated/featured.ts` exports `FEATURED: Readonly<Record<string, string>>`, slug → display name (e.g. `"luna-lovegood": "Luna Lovegood"`), about 60 well-known characters including all 24 roster members. Display name = `FEATURED[slug]` ?? PotterDB `name` with any parenthetical removed. Normal quiz questions take their answer from featured characters. Hard questions may use any kept character.
- **D7 Actors** come from HP-API, joined in the snapshot script onto featured characters only, by matching the HP-API name to the featured display name (case-insensitive). `ACTOR_OVERRIDES: Record<slug, string>` covers mismatches. Everyone else has `actor: null`.
- **D8 Field mapping (PotterDB → CharacterRecord):** `house` upper-cased or null. `ancestry` ← `blood_status`. `patronus` ← lower-cased `patronus` (generators already skip "non-corporeal"). `dateOfBirth` ← ISO date when `born` starts with `D Month YYYY`, else null. `alive` ← `died === null`. `eyeColour`/`hairColour` ← `eye_color`/`hair_color`. `alternateNames` ← `alias_names`. `wand` ← the first entry of `wands` without "(temporarily)" that parses, else null. **No images are stored or shown.**
- **D9 Wand strings:** `"11', Holly, phoenix feather"`, `"10¾', Vine, dragon heartstring"`. Glyphs ¼ ½ ¾ become .25 .5 .75. "Unknown length", "unknown core" and unknown wood become null for that part. "Unknown length, wood and core" gives null. Trailing parentheticals are dropped. Wood is lower-cased.
- **D10 Spells (PotterDB → SpellRecord):** `id` ← slug. `name` ← `incantation` with its pronunciation parenthetical removed (`"Expelliarmus(ex-PEL-lee-ar-muss)"` → `"Expelliarmus"`), else `name`. `description` ← `effect`. Spells without an effect are dropped. `CURATED_SPELLS` keys move from `apiName` to `slug`.
- **D11 Attribution.** The footer reads: "Character and spell data from Potter DB (potterdb.com), drawn from the Harry Potter Wiki (CC BY-SA); actor names from HP-API." followed by the existing not-affiliated sentence. The README states that the snapshot is CC BY-SA.

## Global Constraints

- Use `corepack pnpm`. Never bypass the minimum-release-age policy. Add no new dependencies.
- No official or film imagery anywhere (no PotterDB `image` field, no Fandom CDN URLs).
- Tests must never touch the network. The snapshot script is the only code that calls PotterDB or HP-API.
- Deterministic quiz: same game state → same question.
- `AGENTS.md` stays untracked.

## Review Focus

- A round where the AI asks for `wand` on a normal turn, or twice: the resolver must serve another topic (test in Task 1).
- Data with no wand-eligible characters: a hard turn must still get a question (Task 1 test: wand unavailable → other topic).
- PotterDB 429 or 5xx mid-snapshot: the script retries with backoff, and on final failure exits non-zero without writing partial files (Task 3).
- A curated slug (roster, featured, spell) missing from a fresh snapshot: a unit test fails naming the slug (Tasks 3 and 4).
- Names with "(née …)" or other parentheticals reaching the UI: the display-name rule and a snapshot test cover it (Task 3).

---

## Phase A

### Task 1: Wand questions only on hard turns, at most once per round

**Files:**
- Create: `src/quiz/topic-rules.ts`, `src/quiz/topic-rules.test.ts`
- Modify: `src/quiz/classic-quizmaster.ts`, `src/quiz/ai-prompt.ts`, `src/graphql/types/quiz.ts` (`generateWithFallback`), plus tests in `src/quiz/classic-quizmaster.test.ts`, `src/graphql/quiz.test.ts`

**Interfaces:**
- Produces: `topicsFor(available: readonly Topic[], turns: readonly TurnRecord[], difficulty: Difficulty): Topic[]`. Returns `available` minus `"wand"` when `difficulty !== "hard"` or any turn has `topic === "wand"`, in the same order.

- [ ] **Step 1: Failing tests**
  - `topic-rules.test.ts`: normal → no wand. Hard with no wand turn → wand kept. Hard after a wand turn → no wand. Order otherwise unchanged.
  - `classic-quizmaster.test.ts`: over 200 seeds × 10 turns, the spec topic is never `wand` on a normal turn and appears at most once per round.
  - `quiz.test.ts`: an AI fake that always returns `{ topic: "wand" }` yields a non-WAND question on a normal turn, and on a hard turn when a WAND turn is already in state. The "never asks the same question twice" round test also asserts at most one WAND per round and none on non-dared turns.
- [ ] **Step 2: Run, expect FAIL** — `corepack pnpm exec vitest run src/quiz src/graphql/quiz.test.ts`
- [ ] **Step 3: Implement.** The classic quizmaster filters its candidates through `topicsFor`. `ai-prompt.ts` lists only `topicsFor(...)` as allowed topics for this turn. `generateWithFallback` builds its topic order from `topicsFor(availableTopics(data), state.turns, spec.difficulty)`, so a disallowed spec topic is skipped, not served.
- [ ] **Step 4: Run all unit tests, expect PASS** — `corepack pnpm test`
- [ ] **Step 5: Commit** — `feat(quiz): wand questions only on dared turns, at most one per round`

---

## Phase B

### Task 2: PotterDB parsing (pure functions)

**Files:**
- Create: `src/data/potterdb/schemas.ts`, `src/data/potterdb/parse.ts`, `src/data/potterdb/parse.test.ts`

**Interfaces:**
- Produces:
  - zod `PotterCharacterSchema` and `PotterSpellSchema` for one JSON:API `data[]` item (`{ id, type, attributes: {...} }`), with attributes nullable as observed.
  - `parseWand(text: string): Wand | null` (D9)
  - `parseBorn(text: string | null): string | null` (D8, ISO `yyyy-mm-dd`)
  - `displayName(slug: string, apiName: string, featured: Readonly<Record<string, string>>): string` (D6)
  - `toCharacterRecord(item: PotterCharacter, featured): CharacterRecord` and `toSpellRecord(item: PotterSpell): SpellRecord | null` (D8, D10)

- [ ] **Step 1: Failing tests** with the exact strings observed:
  - `parseWand("11', Holly, phoenix feather")` → `{ wood: "holly", core: "phoenix feather", lengthInches: 11 }`
  - `"10¾', Vine, dragon heartstring"` → length 10.75
  - `"10', Blackthorn, unknown core (temporarily)"` → core null
  - `"Unknown length, wood and core"` → null
  - `"11¼', Cypress, unicorn hair"` → 11.25
  - `parseBorn("31 July 1980, Godric's Hollow, West Country, England, Great Britain")` → `"1980-07-31"`; `parseBorn("c. 1950")` → null
  - `displayName("luna-lovegood", "Luna Scamander (née Lovegood)", {})` → `"Luna Scamander"`, and with a featured entry → that entry
  - `toCharacterRecord` on a Harry fixture → wand holly/phoenix feather/11, not one of the "(temporarily)" ones; `alive` true; house `"GRYFFINDOR"`
  - `toSpellRecord` on `{ name: "Disarming Charm", incantation: "Expelliarmus(ex-PEL-lee-ar-muss)", effect: "Disarms an opponent" }` → name `"Expelliarmus"`; with null effect → null
- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run, expect PASS**
- [ ] **Step 5: Commit** — `feat(data): parse PotterDB characters, wands and spells`

### Task 3: Snapshot script and new snapshot

**Files:**
- Create: `src/data/curated/featured.ts`, `scripts/snapshot-lib.ts`, `scripts/snapshot-lib.test.ts` (add `scripts/**/*.test.ts` to vitest `include`)
- Modify: `scripts/snapshot.ts`, `src/data/snapshot/characters.json`, `src/data/snapshot/spells.json`

**Interfaces:**
- Consumes: Task 2 functions.
- Produces:
  - `fetchAllPages(path: string, deps: { fetchImpl: typeof fetch; sleep: (ms: number) => Promise<void> }): Promise<unknown[]>`. Uses `page[size]=100` and follows `links.next`, waiting 4,100 ms between requests. A 429 or 5xx is retried up to 5 times with backoff 10 s × attempt, then throws.
  - `buildSnapshot(input: { potterCharacters: unknown[]; potterSpells: unknown[]; hpCharacters: unknown[] }): { characters: CharacterRecord[]; spells: SpellRecord[] }`. Applies D5, D7 and D10, drops invalid items with a warning, and sorts by id.
  - `FEATURED` (D6), `ACTOR_OVERRIDES` (D7) in `featured.ts`.

- [ ] **Step 1: Failing tests** (fakes only, no network): pagination follows `next` and sleeps between calls; a 429 then a 200 succeeds; 6 × 503 throws. `buildSnapshot` keeps or drops per D5, joins actors per D7 (including an override), and gives featured characters their display names.
- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement.** `snapshot.ts` writes both files only after everything has been fetched and built, so nothing is written on failure.
- [ ] **Step 4: Run tests, expect PASS.** Then run `corepack pnpm snapshot` for real (about 4 minutes) and commit the regenerated JSON.
- [ ] **Step 5: Snapshot sanity test** in `src/data/snapshot.test.ts`: every `FEATURED`, `ROSTER` and `CURATED_SPELLS` slug exists; no `name` contains `(`; at least 150 corporeal patronuses; no field holds a URL.
- [ ] **Step 6: Commit** — `feat(data): build the snapshot from PotterDB with HP-API actors`

### Task 4: Runtime reads the snapshot only; curated data moves to slugs

**Files:**
- Modify: `src/data/repository.ts` (+ test), `src/data/types.ts` (drop `source`), `src/data/curated/roster.ts`, `src/data/curated/spells.ts` (`apiName` → `slug`), `src/quiz/generators/spell.ts`, `src/sections/characters/wand-woods.ts` (tones for every wood now in the snapshot), `src/app/page.tsx` (drop `revalidate`), `src/graphql/context.ts`
- Delete: `src/data/hp-api/client.ts` and its runtime use (HP-API schemas stay only if `scripts/` uses them), `src/data/normalise.ts` if nothing else uses it
- Modify: `e2e/*.spec.ts` (remove `hp-api` route aborts), `playwright.config.ts` (remove `HP_API_BASE_URL`), `.env.example`, README env table

**Interfaces:**
- Produces: `loadWizardingData(): WizardingData` (sync, validated with zod `CharacterRecordSchema`/`SpellRecordSchema`, invalid records dropped with a warning) and `getWizardingData` (React `cache`) with the same call sites.

- [ ] **Step 1: Failing tests.** The repository returns the snapshot without any `fetch`. The roster test resolves all 24 slugs to records with the right house. The wand-woods test requires a tone for every snapshot wood. The curated-spell test resolves each slug.
- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement**
- [ ] **Step 4:** `corepack pnpm typecheck && corepack pnpm lint && corepack pnpm test && corepack pnpm test:e2e`, all PASS
- [ ] **Step 5: Commit** — `refactor(data): serve the committed snapshot only; curated data keyed by slug`

### Task 5: Quiz pools use featured characters for normal questions

**Files:**
- Modify: `src/quiz/generators/{patronus,house,actor,wand}.ts`, `src/quiz/generators/generators.test.ts`

**Interfaces:**
- Consumes: `FEATURED`.
- Produces: generators whose normal-difficulty answer pool is `characters.filter((c) => c.id in FEATURED)`. Hard pools stay as they are (any kept character). The house generator's normal pool changes from roster to featured.

- [ ] **Step 1: Failing test.** Over 300 seeds, every normal question's correct label belongs to a featured character (or, for house and actor, is the featured character's value). The existing "exactly one right answer" and "same id ⇔ same question" tests keep passing on the new snapshot.
- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run, expect PASS**
- [ ] **Step 5: Commit** — `feat(quiz): normal questions about well-known characters only`

### Task 6: Attribution and docs

**Files:**
- Modify: `src/sections/footer/Footer.tsx` (D11 copy), its test or `e2e/shell.spec.ts`, `README.md` (data sources, CC BY-SA note, snapshot workflow, rate limit), `src/sections/characters/format.ts` and `detail.module.css` comments that name HP-API

- [ ] **Step 1: Failing test:** the footer contains "Potter DB" and "CC BY-SA".
- [ ] **Step 2: Implement copy and docs**
- [ ] **Step 3:** full suite (typecheck, lint, unit, e2e) PASS
- [ ] **Step 4: Commit** — `docs: credit Potter DB and the Harry Potter Wiki`
