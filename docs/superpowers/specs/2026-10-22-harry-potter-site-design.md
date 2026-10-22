# Harry Potter fan site — design spec

**Date:** 2026-10-22
**Status:** Awaiting review
**Wireframes:** https://claude.ai/artifact/WBFQqHWu7vJ7iQ7iFUQTzZ (v10, approved with the crest and Hat changes below)

## 1. Purpose and success criteria

A single-page, animation-heavy Harry Potter fan site built on [HP-API](https://hp-api.onrender.com). It is a **portfolio piece**: visual polish and code quality are the two things it is judged on.

It succeeds when:

- Every section looks and feels finished on desktop and on a 390 px phone, including with `prefers-reduced-motion`.
- The site keeps working when HP-API is asleep, slow or gone for good.
- The AI quizmaster can never spend more than a hard monthly cap, and the quiz works fully without it.
- The codebase reads cleanly: typed end to end, small focused modules, and tests on all the logic.

## 2. Constraints

| Constraint | Consequence |
|---|---|
| **No copyrighted imagery** | No official house crests: we draw an original emblem (a shield in the house colour with the house initial) as an SVG component. Sorting Hat art is **optional**. HP-API `image` URLs are film stills, so they are **not used**. Every art slot has a designed no-art fallback. |
| **Art comes from the owner, gradually** | Art is looked up through one manifest file. A missing file never breaks a layout. |
| **Hosting: Netlify** | Next.js runs through Netlify's adapter, and route handlers become Netlify Functions with a short default timeout (about 10 s). Each AI step is **one short model call per request**, never a multi-call loop. |
| **AI cost must be capped** | Four layers of protection (§6.5). Default model is Claude Haiku 5.5. |
| **HP-API is free-tier hosted** | It has 30–50 s cold starts and could disappear. Data is served from a cached fetch, with a committed JSON snapshot as fallback (§5.1). |
| **HP-API data is patchy** | Many characters have no wand, patronus or house. Every field is nullable in the schema, and the UI shows a muted "Unknown". Lockhart and Trelawney have no house in the API, so they're excluded from the roster. |

## 3. Tech stack

- **Next.js** (App Router, TypeScript strict, React Server Components), with pnpm and Node 22.
- **GSAP 3** with `@gsap/react` (`useGSAP`), plus the ScrollTrigger, SplitText and Flip plugins.
- **GraphQL:** graphql-yoga served from a Next.js route handler. The schema is code-first with **Pothos**. Client operations are typed with **GraphQL Code Generator** (client preset).
- **AI:** `@anthropic-ai/sdk`, model chosen by the `QUIZ_MODEL` env var (default `claude-haiku-5-5`, switchable to `claude-opus-5-5`).
- **Budget store:** Upstash Redis (REST), chosen because it has atomic `INCR` with expiry.
- **Testing:** Vitest for unit and integration tests, Playwright for end-to-end tests.
- **Styling:** CSS Modules with CSS custom properties for the house palettes. Suggested typefaces are Cinzel (display) and Inter (body), both from Google Fonts. Final choices are made in visual design.

## 4. Page structure

One route (`/`) with five sections in scroll order. The wireframe boards show the layout. This section records the agreed behaviour.

### 4.1 Intro — night sky over Hogwarts
- **Layers, back to front:** sky, stars, moon, castle silhouette, clouds. All are the owner's art, with flat-shape fallbacks.
- **Parallax:** each layer moves with the pointer at its own depth. On phones it follows device tilt after the iOS permission prompt, and falls back to touch-drag.
- **Entrance sequence** (about 3.5 s, skipped as soon as the user scrolls): sky fades up → stars twinkle on in a random stagger → moon glows → castle rises → clouds drift in → title shimmers in letter by letter (SplitText) → tagline → pulsing scroll cue.
- **Cursor:** a wand-tip cursor that trails fading sparkles, drawn as 2D canvas particles. Touches also leave sparkles.
- **Navigation:** map-style links (The Classroom, The Great Hall, The Sorting Ceremony). On mobile they fold into a single "Map" button that opens a sheet. The nav hides on scroll down and returns on scroll up.
- **Transition:** scrolling sinks the view down through the clouds into the spells section.

### 4.2 Spells — the Classroom
- **Pinning:** the section pins with ScrollTrigger. The first spell auto-casts on arrival.
- **Spell list:** 10 curated spells (§5.3) as real `<button>`s. On mobile they become a swipeable chip row.
- **Casting:** every cast plays the shared wand-flick timeline and fires a bolt in the spell's colour, then the spell's **signature effect** plays on the stage. The name and description write themselves in.
- **Effects:** each effect is its own module, registered by key (§7.3).

### 4.3 Characters — the Great Hall
- **Tabs:** four house tabs, each with the original shield emblem. They follow the ARIA tabs pattern, so arrow keys move between them.
- **Switching houses:**
  - background, light and banner blend into the house palette (CSS custom properties tweened by GSAP)
  - the old roster sweeps out in a stagger and the new one deals in
- **Roster:** about 6 curated characters per house (§5.3). Desktop is a responsive grid; mobile is 2-up.
- **Cards:** show the portrait from the art manifest, or the **fallback card**: a shield silhouette with initials.
- **Detail panel:** clicking a card expands it into the panel with GSAP Flip (a bottom sheet on mobile).
  - Contents: alternate names, ancestry, patronus, actor, date of birth, eyes and hair, status, wand.
  - Esc or × closes it back into its card. Previous/next walk the roster.
  - **Stretch goal:** an illustrated wand, one SVG stretched to its length on a 0–15 in scale and tinted by wood type, with a glowing core streak. Fallback: wand details as text.

### 4.4 Quiz — the Sorting Ceremony
- **Round:** 10 questions, each with 4 options.
- **Dare step:** before each question the player picks **Safe** (1 point) or **Daring** (2 points, harder question).
- **Mode badge:** "The Hat is awake · AI quizmaster" or "The Hat is resting · classic mode". It switches automatically, with no error shown to the player.
- **The Hat's voice:** a quote with the attribution "— The Sorting Hat", typed in after each answer. Hat art slot: optional (the `quiz.hat` manifest slot; without it the Hat is a voice only).
- **Result screen:**
  - the emblem reveal with a sparkle burst in house colours
  - the verdict text
  - four play-style stats, each tied to a house
  - "Meet your housemates", which scrolls to the Great Hall with that house selected, and "Play again"

### 4.5 Footer
- "Mischief managed." writes itself in when the footer scrolls into view.
- The map navigation is repeated.
- API credit and fan-project disclaimer ("not affiliated with or endorsed by Warner Bros. or J.K. Rowling"), plus the owner's name and links.

## 5. Data layer

### 5.1 Fetching and resilience
- `hp-api/client.ts` fetches `/api/characters` and `/api/spells` with `next: { revalidate: 86400 }` and a 4 s abort timeout.
- On a timeout, network error or bad response it returns the **committed snapshot** (`data/snapshot/characters.json`, `spells.json`) and logs a warning.
- Raw responses are validated with **Zod** at that boundary. Invalid records are dropped and logged, never passed on.
- `pnpm snapshot` refreshes the snapshot files. It's run manually, and the result is committed.

### 5.2 GraphQL schema (Pothos, code-first)

```graphql
enum HouseName { GRYFFINDOR SLYTHERIN RAVENCLAW HUFFLEPUFF }

type Query {
  houses: [House!]!
  house(name: HouseName!): House
  character(id: ID!): Character
  spells: [Spell!]!                  # the 10 curated spells, in display order
}

type House {
  name: HouseName!
  displayName: String!
  traits: [String!]!
  members: [Character!]!             # curated roster, in display order
}

type Character {
  id: ID!
  name: String!
  initials: String!
  alternateNames: [String!]!
  house: HouseName
  ancestry: String
  patronus: String
  actor: String
  dateOfBirth: String                # ISO date when known
  alive: Boolean!
  eyeColour: String
  hairColour: String
  wand: Wand                         # null when wood, core and length are all empty
  portrait: Art                      # from the art manifest; null → fallback card
}

type Wand { wood: String, core: String, lengthInches: Float }
type Art { src: String!, alt: String!, width: Int!, height: Int! }

type Spell {
  id: ID!
  name: String!
  description: String!               # config override if present, else API text
  colour: String!                    # hex, for the bolt and glow
  effect: SpellEffectKey!            # enum, one value per signature effect
}

type Mutation {
  quizTurn(input: QuizTurnInput!): QuizTurn!
  quizVerdict(input: QuizVerdictInput!): QuizVerdict!
}
```

The quiz input and output types are defined in §6.2.

- **Server Components** run queries in-process through the schema with no HTTP hop. **Client components** (only the quiz) POST to `/api/graphql`.
- **Normalisation lives in resolvers:** empty strings become `null`, `dd-mm-yyyy` dates become ISO, house strings become the enum, and config overrides are applied.

### 5.3 Curated config (`data/curated/`)
- `spells.ts` lists the 10 spells in display order, each with `apiName`, `colour`, `effect` and an optional `descriptionOverride`:
  1. Lumos
  2. Wingardium Leviosa
  3. Incendio
  4. Expelliarmus
  5. Stupefy
  6. Protego
  7. Accio
  8. Alohomora
  9. Reparo
  10. Expecto patronum (needs an override because the API text has typos)
- `roster.ts` lists character IDs per house. The first pick, to be confirmed:
  - **Gryffindor:** Harry, Hermione, Ron, Dumbledore, McGonagall, Neville
  - **Slytherin:** Draco, Snape, Voldemort, Bellatrix, Slughorn, Lucius
  - **Ravenclaw:** Luna, Cho, Flitwick, Padma, Moaning Myrtle, Xenophilius
  - **Hufflepuff:** Cedric, Tonks, Sprout, Newt, Hannah Abbott, Ernie Macmillan
- `houses.ts` holds the display names, traits and palette tokens.
- A unit test fails the build if a curated name or ID is missing from the snapshot.

### 5.4 Art manifest (`data/art-manifest.ts`)
- A typed map from slot keys (`intro.sky`, `intro.castle`, `portrait.<characterId>`, `spell.patronusStag`, `quiz.hat`, …) to `{ src, alt, width, height }`.
- Files live in `public/art/`. Slots not in the manifest render their fallback.

## 6. Quiz engine

### 6.1 Modules (all in `quiz/`)

| Module | Responsibility | Depends on |
|---|---|---|
| `types.ts` | `GameState`, `QuestionSpec`, `Question`, `Quizmaster` interface, `PlayStats` | — |
| `generators/*.ts` | One pure function per topic (`wand`, `patronus`, `spell`, `actor`, `house`, `portrait`). Each turns `(spec, data, rng)` into a `Question` with 4 options. The difficulty controls how plausible the wrong answers are. | Data types only |
| `sorting.ts` | A pure function from `PlayStats` to a house plus per-house scores (§6.4) | — |
| `classic-quizmaster.ts` | Rule-based `Quizmaster`: picks topics, steers away from repeats and toward weak topics, picks difficulty from the dare, uses pre-written Hat lines | `types` |
| `ai-quizmaster.ts` | Claude-backed `Quizmaster` (§6.3) | SDK, `types` |
| `select-quizmaster.ts` | Returns the AI quizmaster or the classic one, based on the budget guard and configuration | `budget/` |
| `budget/budget-guard.ts` | Daily token budget, per-IP game limit, usage recording | Redis client (injected) |

The `Quizmaster` interface:

```ts
interface Quizmaster {
  readonly mode: "ai" | "classic";
  nextTurn(state: GameState, dared: boolean): Promise<{ spec: QuestionSpec; hatLine: string }>;
  verdict(stats: PlayStats, house: HouseName): Promise<string>;
}
```

The quizmaster only ever chooses a **spec** (topic and difficulty) and writes **flavour text**. The question itself always comes from a generator using real data, so the AI can't introduce a wrong fact.

### 6.2 Turn flow (stateless server)
1. The client holds the `GameState`: the turns so far, as `{ topic, difficulty, dared, correct, msToAnswer }`.
2. The client calls `quizTurn({ state, dared })`.
3. The resolver:
   - calls `selectQuizmaster(ip)`
   - calls `nextTurn`
   - runs the generator for the returned spec
   - returns `{ question, hatLine, mode }`
4. The question includes its correct option, and the client does the scoring. Cheating only affects the player's own fun, so the server doesn't check answers.
5. After question 10, the client calls `quizVerdict({ stats })`. The server computes the house with `sorting.ts`, which is deterministic in both modes, and asks the quizmaster for the verdict text.

### 6.3 AI quizmaster
- One `messages.create` call per turn. The settings:
  - `model` from `QUIZ_MODEL`
  - `output_config: { effort: "low" }`
  - `max_tokens` around 400
  - a 6 s abort timeout
- One tool, `pose_question`, with `strict: true` and the input `{ topic: enum, difficulty: enum, hat_line: string (≤ 160 chars) }`. `tool_choice: auto`, plus a system-prompt instruction to always call the tool. Forced tool choice is rejected by current models.
- The system prompt describes the Hat's persona, the rules (vary topics, lean toward the player's weak topics, match difficulty to the dare, one line of commentary, no spoilers about the correct answer) and the allowed enums. The system prompt and tool definitions stay byte-stable so they can be cached. Game state goes in the user message.
- The tool input is validated with Zod. A missing or invalid call raises an error, which leads to the classic fallback for that turn.
- The verdict is one call with the stats and the decided house, returning 2–3 sentences (`max_tokens` around 300).

### 6.4 Sorting formula (`sorting.ts`)
Four normalised scores (0–1). The highest wins, and ties break by fixed order (R > H > G > S):

| House | Signal |
|---|---|
| Gryffindor | share of turns dared |
| Ravenclaw | accuracy on hard (dared) questions, weighted by how many hard questions were asked |
| Hufflepuff | longest correct streak ÷ 10, blended with overall consistency |
| Slytherin | share of points earned from dares taken on the player's strongest topics |

The weights are constants in one place and covered by table-driven tests.

### 6.5 Cost protection (four layers)
1. **Anthropic Console (hard cap, set up by hand):** a dedicated workspace and API key for this site, with a monthly spend limit (suggested: $5). Once the cap is hit the API rejects requests, which triggers layer 4.
2. **Daily token budget:** `AI_DAILY_TOKEN_BUDGET` (suggested: 200k). Each call adds `usage.input_tokens + usage.output_tokens` to the Redis key `ai:tokens:<yyyy-mm-dd>`, which expires after 48 h. The budget is checked **before** each call.
3. **Per-visitor limit:** `AI_GAMES_PER_IP_PER_DAY` (default 3). The IP is hashed with a salt before it becomes a key, so raw IPs are never stored. A game counts when it starts.
4. **Fallback:** classic mode is used whenever any of these hold:
   - no `ANTHROPIC_API_KEY`
   - no Redis config
   - budget or IP limit reached
   - any SDK error, timeout or invalid tool call

   Once a game falls back, it stays in classic mode until it ends, so the badge doesn't flip back and forth.

Environment variables: `ANTHROPIC_API_KEY`, `QUIZ_MODEL`, `AI_DAILY_TOKEN_BUDGET`, `AI_GAMES_PER_IP_PER_DAY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `IP_HASH_SALT`. All are optional. Without them the site runs in classic mode.

## 7. Animation architecture

### 7.1 Principles
- All GSAP code runs inside `useGSAP` with a scoped ref, so it's cleaned up automatically. Plugins are registered once in `animation/gsap.ts`.
- Reduced motion is handled with `gsap.matchMedia()`. In that mode:
  - the entrance shows its final state
  - parallax and the sparkle trail are off
  - spell effects are cut to a short fade
  - Flip becomes a crossfade
- Only transforms and opacity are animated. Palette changes tween CSS custom properties on the section root.
- Timelines are built by named factory functions (e.g. `buildIntroTimeline(refs)`), so section components stay readable.

### 7.2 Sparkle trail
- One `<canvas>` overlay with a fixed-size particle pool (no allocation per frame), driven by `gsap.ticker`.
- Paused when the tab is hidden or the intro is off-screen. Turned off on coarse pointers unless there's a touch.

### 7.3 Spell effects
- `animation/spell-effects/<key>.ts` each exports `(stage: StageRefs) => gsap.core.Timeline`.
- A typed registry maps `SpellEffectKey` to an effect, so the compiler catches an effect that's missing.
- The cast sequence is `wandFlick()`, then `bolt(colour)`, then `effects[key](stage)`. Picking a new spell kills the previous timeline first.

## 8. Accessibility
- Semantic landmarks, one `h1`, and headings in order.
- Spells are a list of toggle buttons with `aria-pressed`. Houses follow the ARIA tabs pattern. The detail panel is a dialog that traps focus and returns focus to its card.
- Quiz options are buttons. Feedback is announced through a polite live region, and correct/wrong is shown with text, not just colour.
- Text contrast is at least 4.5:1, and touch targets are at least 44 px. The custom cursor never hides the system cursor for keyboard or screen-reader users.

## 9. Error handling summary

| Failure | Behaviour |
|---|---|
| HP-API slow or down | Snapshot data is used, and visitors see no difference |
| Invalid API record | Dropped at the Zod boundary and logged |
| Curated ID missing from data | Caught by a test at build time. At runtime the character is skipped. |
| Art missing | Designed fallback for that slot |
| AI error, timeout or invalid tool call | Classic quizmaster for the rest of that game |
| Budget, IP limit or Console cap reached | Classic mode with the "resting" badge |
| GraphQL error in the quiz | Inline "The Hat lost its train of thought — try again" with a retry button. The section stays usable. |

## 10. Testing
- **Unit (Vitest):**
  - every question generator (4 distinct options, correct answer present, difficulty changes the wrong answers, a seeded RNG gives repeatable results)
  - `sorting.ts` (table-driven)
  - `classic-quizmaster`
  - `budget-guard` (fake Redis)
  - resolver normalisation
  - curated config against the snapshot
- **AI quizmaster:** tests with a fake SDK client, covering a valid tool call, a missing tool call, invalid input, a timeout, and usage being recorded.
- **Integration:** queries run against the real schema with the snapshot loader.
- **End to end (Playwright):**
  - the page renders with HP-API blocked
  - a full classic-mode quiz round reaches a verdict
  - the house tabs and detail panel work by keyboard
  - with reduced motion on, the page renders its final state
- **Not tested automatically:** animation feel. That's reviewed by eye.

## 11. Project layout

```
src/
  app/                    layout.tsx, page.tsx, api/graphql/route.ts
  sections/               intro/, spells/, characters/, quiz/, footer/   (UI + section timelines)
  components/             HouseEmblem, FallbackCard, MapNav, …
  animation/              gsap.ts, reduced-motion.ts, sparkle-trail/, spell-effects/
  graphql/                builder.ts, types/, context.ts, execute.ts
  data/                   hp-api/, snapshot/, curated/, art-manifest.ts
  quiz/                   types.ts, generators/, sorting.ts, *-quizmaster.ts, budget/
public/art/               owner-supplied artwork
scripts/snapshot.ts
```

## 12. Out of scope / stretch
- **Stretch:** the illustrated wand, and Sorting Hat art if original art can be found.
- **Out of scope:** user accounts, sharing results, more pages or routes, HP-API film-still images, more than 10 spells, analytics.

## 13. Open items (not blocking the plan)
- Site title and tagline.
- Final roster and the art delivery schedule.
- The exact Console spend cap and daily token budget numbers.
