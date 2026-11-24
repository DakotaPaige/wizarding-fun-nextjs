# Lumos — a small, magical tour of the wizarding world

A fan-made, single-page Harry Potter site built as a portfolio piece: a GSAP-animated night-sky intro, a spell stage, a house-by-house character roster, and a Sorting Hat quiz that can be run by Claude (with strict cost protection) or by a classic, non-AI engine.

Next.js 16 (App Router) · React 19 · GSAP (ScrollTrigger, SplitText, Flip) · GraphQL (Pothos + Yoga) · Anthropic SDK · Upstash Redis · Vitest · Playwright.

> Fan project. Not affiliated with or endorsed by Warner Bros. or J.K. Rowling. Character and spell data comes from [Potter DB](https://potterdb.com), which draws on the [Harry Potter Wiki](https://harrypotter.fandom.com) (CC BY-SA), so the committed data snapshot is CC BY-SA too; actor names come from [HP-API](https://hp-api.onrender.com). No official artwork is shipped: every art slot has an original CSS/SVG fallback.

## Quick start

pnpm is used through Corepack, so prefix commands with `corepack pnpm` (or run `corepack enable` once and use plain `pnpm`).

```bash
corepack pnpm install
corepack pnpm dev        # http://localhost:3000
```

The site runs with no environment variables at all: the quiz simply uses classic mode, and character and spell data is read from the committed snapshot. The running site never calls Potter DB or HP-API.

| Script                        | What it does                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `corepack pnpm dev`           | Start the dev server                                                         |
| `corepack pnpm build`         | Production build                                                             |
| `corepack pnpm start`         | Serve the production build                                                   |
| `corepack pnpm lint`          | ESLint                                                                       |
| `corepack pnpm typecheck`     | `tsc --noEmit`                                                               |
| `corepack pnpm test`          | Vitest unit and component tests                                              |
| `corepack pnpm test:e2e`      | Playwright (desktop and mobile projects; builds and serves the site itself)  |
| `corepack pnpm snapshot`      | Refresh `src/data/snapshot/` from Potter DB and HP-API (about 4 minutes; see below) |
| `corepack pnpm codegen`       | Regenerate typed GraphQL documents from `schema.graphql`                     |
| `corepack pnpm schema:print`  | Print the GraphQL schema to `schema.graphql`                                 |

The e2e web server blanks every AI/Redis variable, so tests always run in classic mode on snapshot data and never spend API money, even if `.env.local` holds a real key. Playwright always builds and starts its own server on port 3100 (`reuseExistingServer: false`) and never reuses a running `pnpm dev`, which would have loaded `.env.local`; a dev server on port 3000 can stay up while e2e runs.

## Data snapshot

Character and spell data is a committed, normalised snapshot (`src/data/snapshot/characters.json` and `spells.json`); the site reads only these files, so pages are fully static. `corepack pnpm snapshot` rebuilds them:

- It fetches characters and spells from Potter DB (`api.potterdb.com`; wand details are parsed from the character records), which allows 15 requests per minute per IP. Requests are spaced 4.1 s apart (429 and 5xx responses are retried with backoff), so a run takes about 4 minutes.
- It fetches actor names from HP-API and joins them onto the featured characters in `src/data/curated/featured.ts`. HP-API is currently suspended by its owner; while it is down the script warns and keeps the actor names already in the committed `characters.json`.
- Files are written only if every Potter DB fetch succeeds, so a failed run leaves the snapshot untouched.

Potter DB's content comes from the Harry Potter Wiki and is licensed CC BY-SA, so the snapshot is too. No images are taken from either API.

## Environment variables

Copy `.env.example` to `.env.local`. All variables are optional.

| Variable                   | Default                      | Purpose                                                        |
| -------------------------- | ---------------------------- | -------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`        | unset (classic mode)         | Key for the AI quizmaster                                      |
| `QUIZ_MODEL`               | `claude-haiku-5-5`           | `claude-haiku-5-5` or `claude-opus-5-5`                        |
| `AI_DAILY_TOKEN_BUDGET`    | `200000`                     | Max AI tokens across all players per day                       |
| `AI_GAMES_PER_IP_PER_DAY`  | `3`                          | Max AI games per visitor per day                               |
| `UPSTASH_REDIS_REST_URL`   | unset (classic mode)         | Redis REST URL for the budget and rate-limit counters          |
| `UPSTASH_REDIS_REST_TOKEN` | unset (classic mode)         | Redis REST token                                               |
| `IP_HASH_SALT`             | unset (classic mode)         | Random salt; IPs are hashed with it, raw IPs are never stored  |

Never commit `.env.local`.

## AI quiz and cost protection

The Sorting Hat quiz is a "dare-and-answer" game. With AI enabled, Claude plays the Hat and writes each turn; the sorting itself is computed server-side by a deterministic formula. Measured live on `claude-haiku-5-5`: roughly 1,250 tokens and 2-3 s per turn.

Four layers cap what it can spend; the AI is used only while all of them allow it:

1. **Anthropic Console cap (set up by hand).** Create a dedicated workspace and a dedicated API key for this site, and set a monthly spend limit on the workspace (suggested: $5). Once the cap is hit, the API rejects requests and layer 4 takes over.
2. **Daily token budget.** `AI_DAILY_TOKEN_BUDGET` (default 200k). Before each call the server atomically reserves an estimate (1,500 tokens) on a Redis counter that expires after 48 h, and only calls Claude if the total still fits; afterwards the reservation is corrected to the tokens actually used. A burst of concurrent requests therefore cannot overshoot the budget.
3. **Per-visitor limit.** `AI_GAMES_PER_IP_PER_DAY` (default 3). A game counts once, when it starts, and the IP is salted and hashed before it becomes a key. Later turns and the verdict only get the AI if their game was started and allowed, and one game makes at most 11 AI calls (10 turns and the verdict). A GraphQL request may select only one `quizTurn` or `quizVerdict`, so one request makes at most one AI call.
4. **Classic fallback.** Classic mode is used whenever there is no API key, no Redis config, Redis fails, a limit is reached, too little of the request's ~8.5 s time budget is left, or the SDK errors, times out or returns an invalid tool call. Once a game falls back it stays classic until it ends, so the badge ("The Hat is awake" / "The Hat is resting") never flips back and forth.

### Upstash setup

1. Create a free Redis database at [upstash.com](https://upstash.com) (a region close to your Netlify functions is best).
2. From the database's REST API section copy the URL and token into `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
3. Generate a salt, e.g. `openssl rand -hex 32`, and set it as `IP_HASH_SALT`.

Without Redis the AI quiz stays off by design: the budget cannot be enforced, so the site plays safe.

## Deploying to Netlify

`netlify.toml` already sets the build command (`pnpm build`) and Node 22.

1. Push the repo and import it in Netlify (the Next.js runtime is detected automatically).
2. Under Site configuration, Environment variables, add the variables above. For a free-to-run deploy set none of them; for the AI quiz set at least `ANTHROPIC_API_KEY`, the three Upstash/salt variables, and optionally `QUIZ_MODEL`, `AI_DAILY_TOKEN_BUDGET` and `AI_GAMES_PER_IP_PER_DAY`.
3. Deploy. The home page is revalidated at most once a day.

## Customising

- **Title, tagline, owner name and links** live in `src/content/site.ts`. Set `links.github` / `links.portfolio` to URLs to show them in the footer; `null` hides them.
- **Section names** for the map navigation are `MAP_SECTIONS` in the same file.
- **House palettes** and other curated data are in `src/data/curated/`.

### Adding art

All imagery goes through `src/data/art-manifest.ts`, which ships empty. Put files in `public/art/` and register them:

```ts
export const ART: Partial<Record<ArtSlot, ArtAsset>> = {
  "intro.castle": { src: "/art/castle.webp", alt: "Hogwarts castle against the night sky", width: 1600, height: 900 },
  "portrait.harry-potter": { src: "/art/harry.webp", alt: "Harry Potter", width: 600, height: 800 },
};
```

Slots used by the site:

| Slot                    | Where                                  |
| ----------------------- | -------------------------------------- |
| `intro.sky`, `intro.stars`, `intro.moon`, `intro.castle`, `intro.clouds` | Intro scene (animated CSS/SVG fallbacks) |
| `spell.wand`            | Spell stage wand                       |
| `spell.patronusStag`    | Patronus spell effect                  |
| `portrait.<characterId>`| Character cards and detail panel; picture-round quiz questions only use characters that have one |
| `quiz.hat`              | The Sorting Hat in the quiz            |

A slot missing from the manifest renders its fallback, so you can add art one piece at a time. Only use artwork you have the right to use.

## Project layout

```
src/
  app/            layout, page, GraphQL route handler
  sections/       intro/, spells/, characters/, quiz/, footer/  (UI and section timelines)
  components/     MapNav, Art, HouseEmblem, FallbackCard, ...
  content/        site.ts (title, tagline, owner, links, map sections)
  animation/      gsap.ts (plugin registration), motion.ts (reduced motion), sparkle-trail/, spell-effects/
  graphql/        Pothos schema, context, in-process execute
  data/           potterdb/ (schemas, parsers), hp-api/ (schemas), snapshot/, curated/, art-manifest.ts
  quiz/           generators, sorting formula, quizmasters (AI and classic), budget/
scripts/          snapshot.ts, print-schema.ts
e2e/              Playwright specs (shell, characters, quiz, reduced motion, CLS)
```

## Accessibility and motion

All GSAP code runs inside `useGSAP` with a scoped ref, and only transform and opacity are animated. With `prefers-reduced-motion: reduce` the intro jumps to its end state, there is no parallax or sparkle trail, spell effects become a short fade, and the roster detail uses a crossfade. Landmarks, a single `h1`, 44 px touch targets and 4.5:1 text contrast are covered by the axe check in the e2e suite.
