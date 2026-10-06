# Lexora Architecture

> Technical architecture, boundaries, and decisions. Status: **Phase 0**. Only the frontend foundation exists; everything marked _Target_ is the agreed direction, not built code.

---

## 1. Principles

1. **The core works without AI.** Language lookup, search, practice, spaced repetition, and writing/speaking audits run on curated data, database search, deterministic rules, and learning algorithms. No paid API is required to run Lexora.
2. **AI is an optional adapter.** Intelligence sits behind interfaces with deterministic implementations. An AI-backed implementation can be added later, enabled by configuration, with graceful fallback.
3. **Domain logic is plain TypeScript.** Search ranking, intent matching, SRS scheduling, and text analysis live in framework-free modules that are easy to unit-test and portable.
4. **Database portability.** PostgreSQL-compatible SQL through a thin ORM, with data access behind repository functions. Switching providers (Neon, Supabase, RDS, local Docker) is a connection-string change.
5. **Modular monolith.** One Next.js app, organised by feature with explicit boundaries. No microservices.
6. **Few dependencies.** Every dependency must justify itself (see the Decision log).

---

## 2. Stack

| Concern                    | Choice                                                                                     | Status       |
| -------------------------- | ------------------------------------------------------------------------------------------ | ------------ |
| Framework                  | **Next.js 16** (App Router, React Server Components, Turbopack)                            | ✅ Installed |
| UI runtime                 | **React 19.2**                                                                             | ✅           |
| Language                   | **TypeScript 5.9**, `strict` + `noUncheckedIndexedAccess`                                  | ✅           |
| Styling                    | **Tailwind CSS 4** (CSS-first `@theme`, tokens as CSS variables)                           | ✅           |
| Primitives                 | **shadcn/ui** (`radix-nova` style, Radix UI), copied into `src/components/ui` and restyled | ✅           |
| Icons                      | **lucide-react**                                                                           | ✅           |
| Command palette            | **cmdk** (via shadcn `command`)                                                            | ✅           |
| Class merging              | `cn` (shadcn's clsx + tailwind-merge replacement), `class-variance-authority`              | ✅           |
| Lint / format              | ESLint 9 flat config (`eslint-config-next`), Prettier + `prettier-plugin-tailwindcss`      | ✅           |
| Package manager            | **pnpm**                                                                                   | ✅           |
| Validation                 | **Zod**: env, server action inputs, content files                                          | Phase 2      |
| Database                   | **PostgreSQL**                                                                             | Phase 2      |
| ORM / migrations           | **Drizzle ORM** + drizzle-kit (proposed, see review items)                                 | Phase 2      |
| Auth                       | **Better Auth** or **Auth.js**, decided in Phase 2                                         | Phase 2      |
| Fuzzy search               | Postgres full-text search + `pg_trgm`                                                      | Phase 4      |
| Semantic search (optional) | `pgvector` + embeddings (local model or AI provider)                                       | Phase 9      |
| Spaced repetition          | FSRS (`ts-fsrs`) or SM-2, decided in Phase 5                                               | Phase 5      |
| Unit tests                 | **Vitest** (domain logic)                                                                  | Phase 3      |
| E2E / a11y tests           | **Playwright** + axe                                                                       | Phase 6–10   |
| Speech                     | Browser `MediaRecorder` + Web Speech API (no paid STT)                                     | Phase 8      |

---

## 3. Current structure (Phase 1, in progress)

```text
lexora/
├── CLAUDE.md                     # Working agreement for Claude Code
├── AGENTS.md                     # Next.js-generated agent notes (Next 16 docs pointer)
├── docs/                         # DESIGN, UX_PRINCIPLES, ARCHITECTURE, ROADMAP, WORKFLOW
├── components.json               # shadcn/ui configuration
└── src/
    ├── app/
    │   ├── layout.tsx            # Root layout: fonts, metadata, TooltipProvider
    │   ├── globals.css           # Tailwind + token imports + base layer
    │   ├── page.tsx              # Placeholder landing page
    │   ├── (app)/                # App route group, rendered inside the persistent AppShell
    │   │   ├── layout.tsx
    │   │   ├── home|finder|bank|practice|writing|speaking|progress|settings/page.tsx
    │   │   └── language/[slug]/page.tsx   # Static params from demo content; unknown slugs 404
    │   └── design-system/        # Visual review surface (static sample data)
    │       ├── page.tsx
    │       ├── _fixtures.ts      # Illustrative samples, NOT the language dataset
    │       └── _sections/        # Principles, colour, typography, layout, components, states, composition
    ├── components/
    │   ├── ui/                   # shadcn primitives, restyled to tokens
    │   ├── lexora/               # Lexora product components (presentational)
    │   └── shell/                # AppShell, sidebar, top bar, command palette, navigation config
    ├── features/                 # Screen-level composition: dashboard, finder, practice, language
    ├── demo/                     # Phase 1 prototype content + session-only saved state (NOT the dataset)
    ├── lib/
    │   └── utils.ts              # cn()
    └── styles/
        ├── tokens.css            # Design tokens (source of truth for values)
        └── typography.css        # type-* role utilities
```

---

## 4. Target structure

```text
src/
├── app/                          # Routing only: pages, layouts, route handlers, server actions entry
│   ├── (marketing)/              # Public pages
│   ├── (auth)/                   # Sign-in / sign-up
│   ├── (app)/                    # Authenticated app; persistent shell layout
│   │   ├── layout.tsx            # AppShell (sidebar, command palette)
│   │   ├── finder/
│   │   ├── language/[slug]/
│   │   ├── bank/
│   │   ├── practice/
│   │   ├── writing/
│   │   ├── speaking/
│   │   └── progress/
│   └── design-system/
├── components/
│   ├── ui/                       # Primitives (no product knowledge)
│   ├── lexora/                   # Shared product components (no data fetching)
│   └── shell/                    # AppShell, Sidebar, CommandPalette
├── features/                     # Feature modules: UI + server glue for one capability
│   ├── finder/                   #   components/, actions.ts, queries.ts
│   ├── bank/
│   ├── practice/
│   ├── writing/
│   └── speaking/
├── domain/                       # Pure TypeScript. No React, no Next, no DB imports.
│   ├── language/                 #   Types + Zod schemas for entries, relations, categories
│   ├── search/                   #   Query parsing, intent library matching, ranking
│   ├── srs/                      #   Scheduler (FSRS/SM-2), mastery model
│   ├── practice/                 #   Exercise generation from language data
│   ├── audit/                    #   Text analysis rules (repetition, prepositions, collocations)
│   └── intelligence/             #   Interfaces + deterministic implementations (+ optional AI adapter)
├── server/                       # Server-only: repositories, auth, services
│   ├── db/                       #   Drizzle client, schema, migrations
│   ├── repositories/             #   Data access functions (the only code that queries the DB)
│   └── auth/
├── content/                      # Curated language data (version-controlled source files)
│   ├── entries/                  #   JSON/YAML, validated by domain/language schemas
│   └── intents/                  #   Intent library: phrases → intent → categories
└── lib/                          # Small shared utilities (cn, env, formatting)
```

### Dependency rules

```text
app → features → domain
          ↓         ↑
       server ──────┘          components/ui ← components/lexora ← features/app
```

- `domain/` imports nothing from `app`, `features`, `server`, `components`, React, or Next.
- `server/repositories` is the **only** place that talks to the database.
- `components/ui` and `components/lexora` never fetch data. They receive props.
- `features/*` may import `domain`, `server` (server-side only), and components. Features don't import each other. Shared needs move down into `domain` or `components/lexora`.
- `content/` is data, imported only by seed scripts and tests.

Enforce these rules with ESLint import restrictions once the folders exist (Phase 2).

---

## 5. Language data model (draft, finalised in Phase 3)

The goal is `idea → language → context → pattern → practice`, so the model is a **graph of language items with context**, not a word list.

| Entity             | Purpose                                                                      | Key fields                                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `language_item`    | Any retrievable unit: word, phrase, linker, collocation, pattern, expression | `id`, `slug`, `text`, `category`, `meaning`, `register`, `skills[]`, `band_hint?`, `strength?`                                           |
| `pattern`          | Structural usage                                                             | `item_id`, `template` (e.g. `responsible for + noun / -ing`), `notes`                                                                    |
| `example`          | Sentence in context                                                          | `item_id`, `text`, `highlight_span`, `skill`, `source`                                                                                   |
| `relation`         | Typed edge between items                                                     | `from_id`, `to_id`, `type` (`synonym`, `stronger`, `weaker`, `more_formal`, `more_natural`, `opposite`, `collocates_with`, `instead_of`) |
| `preposition_link` | Word → required preposition                                                  | `head_item_id`, `preposition`, `pattern`, `common_error?`                                                                                |
| `mistake`          | Known learner errors                                                         | `item_id`, `wrong_form`, `explanation`                                                                                                   |
| `intent`           | An idea the user might express                                               | `slug`, `label` ("express contrast"), `phrases[]` (trigger phrasings)                                                                    |
| `intent_item`      | Intent → items, ranked                                                       | `intent_id`, `item_id`, `rank`, `context_note`                                                                                           |
| `topic`            | IELTS topic tags (environment, education…)                                   | `slug`, `label`                                                                                                                          |

**User data (Phase 5):** `user_item` (saved, mastery state, SRS fields), `review_log`, `user_mistake`, `practice_session`, `writing_sample`, `speaking_attempt`.

**Content pipeline:** curated source files in `src/content/` → validated by Zod schemas in `domain/language` → seeded into Postgres by a script. Content is version-controlled and reviewable in pull requests. Content licensing must be checked before importing any external lexical source (see review items).

---

## 6. Search strategy (Phase 4)

A deterministic, layered pipeline:

1. **Normalise** the query: lowercase, trim, strip punctuation, expand contractions.
2. **Parse the query shape** with rule-based templates:
   - `synonyms for X` / `better word for X` / `instead of X` → relation lookup on X
   - `preposition after X` / `X + ?` → preposition_link lookup
   - `I want to (say|express) …` / `how to …` → intent matching
   - otherwise → general item search
3. **Intent matching:** compare against the curated `intent.phrases` with trigram similarity and keyword overlap.
4. **Item retrieval:** Postgres full-text search (`tsvector` over text, meaning, and examples) plus `pg_trgm` for typos ("responsable" → "responsible").
5. **Rank:** exact match > intent rank > relation strength > FTS rank > trigram similarity, then adjust by user filters (skill, register) and personal signals (saved, weak areas).
6. **Group** results by category for display.

All steps are pure functions in `domain/search` except retrieval (in a repository). That makes the pipeline testable with fixtures.

---

## 7. Intelligence layer

Interfaces in `domain/intelligence`. Each has a deterministic implementation that ships first.

```ts
interface IntentResolver {
  resolve(query: string): Promise<ResolvedIntent[]>; // rules + intent library
}

interface LanguageSearch {
  search(query: ParsedQuery, filters: SearchFilters): Promise<SearchResult[]>; // FTS + trigram
}

interface TextAnalyzer {
  analyze(text: string, options: AnalysisOptions): Promise<Finding[]>; // rule-based audit
}

interface ExplanationProvider {
  explain(item: LanguageItem, context?: string): Promise<Explanation>; // curated notes
}
```

**Optional AI (Phase 9):**

- An `AiProvider` adapter implements the same interfaces (e.g. `AiIntentResolver`) or wraps the deterministic one (`withAiFallback(deterministic, ai)`).
- It's selected by server-side config (`AI_PROVIDER=none|anthropic|openai|local`), defaulting to `none`.
- It's always time-boxed. On timeout, error, or quota exhaustion, it returns the deterministic result.
- AI output is labelled in the UI and never written into curated content without review.
- Free and local options (e.g. a small local embedding model for semantic search) fit the same interface.

---

## 8. Learning engine (Phase 5–6)

- **Mastery** is derived from review history (recall success over spaced intervals), never from views.
- **Scheduler:** FSRS (modern, open-source, `ts-fsrs`) is the leading option over SM-2. It's a pure function: `(card state, rating, now) → next state`.
- **Practice generation** is deterministic from language data: fill-in-the-blank from examples (`highlight_span`), multiple choice from relations (distractors drawn from same-category items and known `mistake.wrong_form`), preposition drills from `preposition_link`, and so on.

## 9. Writing & Speaking labs (Phase 7–8)

- **Writing audit** is a rule pipeline over tokenised text: repetition (lemma frequency), preposition checks against `preposition_link`, collocation checks against `relation(collocates_with)`, linker variety, register mismatches. Each rule returns a `Finding { span, type, message, suggestions[] }`.
- **Speaking:** record with `MediaRecorder`, transcribe with the browser Web Speech API where available, and fall back to a typed or pasted transcript. The transcript then goes through the same `TextAnalyzer`.
  - Browser support varies, and some browsers (notably Chrome) process recognition on the vendor's servers rather than on the device. The UI must say so before the first use.
  - Lexora itself doesn't upload or store audio unless the user opts in.
  - Self-hosted or local STT (e.g. Whisper running locally) can later plug in behind the same interface.

---

## 10. Cross-cutting

- **Rendering:** Server Components by default. Use `"use client"` only for interactive leaves.
- **Mutations:** Server Actions with Zod-validated input, and authorisation checks in every action.
- **Next.js 16 specifics:** async request APIs (`await cookies()`, `await params`); `proxy.ts` replaces `middleware.ts`; Turbopack is the default bundler.
- **Env:** validated with Zod in `src/lib/env.ts` (Phase 2). No secrets in client bundles.
- **Errors:** route-level `error.tsx` and `not-found.tsx`, plus typed result objects from actions.
- **Performance:** fonts self-hosted, static rendering where possible, search debounced on the client and indexed on the server.
- **Security:** auth on every server action and route handler, row ownership checks in repositories, rate-limiting on search and auth, CSP in Phase 10.

---

## 11. Decision log

| #   | Date       | Decision                                                                                                                                                                | Rationale                                                                                                                                      |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 2026-10-07 | Next.js 16 + TypeScript + Tailwind 4                                                                                                                                    | Requested stack, current stable; RSC suits a data-heavy app                                                                                    |
| 2   | 2026-10-07 | shadcn/ui on Radix (`radix-nova`)                                                                                                                                       | Accessible primitives we own and restyle; Radix chosen over Base UI for maturity                                                               |
| 3   | 2026-10-07 | Tokens as CSS variables mapped via `@theme inline`; kept shadcn variable names                                                                                          | Primitives work unmodified; one place to change values; dark mode becomes a value swap                                                         |
| 4   | 2026-10-07 | Fonts: Inter / Newsreader / JetBrains Mono via `next/font`                                                                                                              | Editorial + interface voices; self-hosted (privacy, no layout shift)                                                                           |
| 5   | 2026-10-07 | Light theme only for now                                                                                                                                                | Focus; token architecture keeps dark mode cheap later                                                                                          |
| 6   | 2026-10-07 | Zod, DB, ORM, and tests not installed in Phase 0                                                                                                                        | Nothing uses them yet; avoid unused dependencies                                                                                               |
| 7   | 2026-10-07 | `shadcn` package as a devDependency                                                                                                                                     | Only its `tailwind.css` (custom variants, utilities) is consumed, at build time                                                                |
| 8   | 2026-10-07 | `suppressHydrationWarning` on `<html>` and `<body>` only                                                                                                                | Browser extensions inject attributes there; it doesn't affect children                                                                         |
| 9   | 2026-10-07 | No AI dependency; intelligence behind interfaces                                                                                                                        | Product requirement; AI optional in Phase 9                                                                                                    |
| 10  | _proposed_ | Drizzle ORM for Postgres                                                                                                                                                | SQL-close, light, portable, no binary engine; good fit for FTS/trigram/pgvector                                                                |
| 11  | 2026-10-07 | Design language v0.2: serif reserved for language content; Inter 600 for all interface headings                                                                         | Owner decision after reference study; serif becomes a reliable "this is English to study" signal                                               |
| 12  | 2026-10-07 | Radius scale 4/6/8/12/16; flat resting surfaces; control-height and section-rhythm tokens                                                                               | Translated from the reference's sober geometry, flat cards and two-density sizing                                                              |
| 13  | 2026-10-07 | Added shadcn `table` primitive                                                                                                                                          | Needed for the language bank and mistakes views; restyled to the table spec                                                                    |
| 14  | 2026-10-07 | App routes live in an `(app)` route group: `/home`, `/finder`, `/bank`, `/practice`, `/writing`, `/speaking`, `/progress`, `/settings`; `/` stays a public landing page | Short, stable URLs; one persistent shell layout; leaves room for `(marketing)` and `(auth)` groups in Phase 2                                  |
| 15  | 2026-10-07 | Shell UI state (collapse, mobile sheet, palette) in a client context, not persisted                                                                                     | Avoids cookie reads that would make every app page dynamic; persistence can come with user preferences in Phase 2                              |
| 16  | 2026-10-07 | Added shadcn `sheet` primitive                                                                                                                                          | Mobile navigation drawer                                                                                                                       |
| 17  | 2026-10-07 | Phase 1 demo content lives in `src/demo/`, imported only by UI code (features, shell, palette)                                                                          | Keeps prototype data obviously separate from the Phase 3 curated dataset and domain model; easy to delete                                      |
| 18  | 2026-10-07 | Saved items are an in-memory client context in the `(app)` layout, labelled "session only" wherever saving appears                                                      | Believable cross-screen save state without fake persistence                                                                                    |
| 19  | 2026-10-07 | `/language/[slug]` is statically generated with `dynamicParams = false`; Finder and Practice read `?q=` / `?step=` via `useSearchParams` inside `Suspense`              | Every route stays static; queries are shareable, and the browser back button works                                                             |
| 20  | 2026-10-07 | Screen composition lives in `src/features/<screen>/`; reusable presentation stays in `components/lexora`                                                                | First use of the target feature structure; features don't import each other except `language/to-card-props` (to move into `domain` in Phase 3) |
