# Lexora Roadmap

> Incremental phases. **Each phase ends with a review and explicit approval from the product owner before the next begins.** Claude Code must not start a later phase on its own.

**Current release: `v0.3.0` — Phase 3, Language Engine (complete)** · In progress: Phase 4 — Search Depth (specification approved 17 October 2026, branch `phase/4-search-depth`) · Phase 0 `v0.0.0` · Phase 1 `v0.1.0` · Phase 2 `v0.2.0` · Phase 2.1 `v0.2.1`

Legend: ✅ done · 🔜 next · ⬜ not started

---

## Current release

**v0.3.0 — Phase 3: Language Engine**

Phase 3 is complete and released to `main`.

Delivered:

- Structured language content with one YAML file per language item
- Zod validation and deterministic content import
- 40 published language items, 42 senses
- Sense-level saving
- PostgreSQL language repository
- AI-free language search
- Query classification and search-as modes
- Full-text and trigram matching
- Conservative typo correction
- Deterministic ranking with explained results
- Explore, Finder, landing-page search and command palette integration
- Database-backed language pages
- Related language links by sense
- Email verification and password reset
- Local development email outbox
- Responsive and accessibility pass
- 346 unit/integration tests
- 117 production-build E2E checks

Production release:

`v0.3.0`

Phase 3 is closed.

---

## Phase 0 — Foundation ✅

**Goal:** a maintainable base with documentation, design tokens, and a component foundation.

- [x] Next.js 16 + React 19 + TypeScript (strict) project with pnpm
- [x] Tailwind CSS 4 with CSS-first configuration
- [x] shadcn/ui (Radix) primitives installed and restyled to Lexora tokens
- [x] Design tokens (`src/styles/tokens.css`) with colour, radius, shadow, motion, layout, and WCAG AA-verified contrast
- [x] Type roles (`src/styles/typography.css`) and self-hosted fonts (Inter, Newsreader, JetBrains Mono)
- [x] Lexora components: SearchField, LanguageResultCard, CategoryBadge, TagBadge, Kbd, EmptyState, Callout, PageHeader, NavItem
- [x] `/design-system` visual playground (static sample data, clearly labelled)
- [x] Placeholder home page
- [x] ESLint, Prettier (+ Tailwind class sorting), `typecheck` script
- [x] Docs: CLAUDE.md, DESIGN.md, UX_PRINCIPLES.md, ARCHITECTURE.md, ROADMAP.md

**Exit criteria:** lint, typecheck, and build pass; the playground renders at desktop and mobile widths; docs reviewed by the owner.

---

## Phase 1 — Visual Prototype ✅ (approved, `v0.1.0`)

**Goal:** see and feel the product end-to-end with static data, before building any backend.

- [x] Design language v0.2 from the reference study: principles translated, tokens and type roles revised (serif = language only), new components (FilterChip, StatusBadge, SearchTrigger, Tile, Table), `/design-system` rebuilt for review
- [x] App shell: sidebar (collapsible to an icon rail; a sheet on mobile), top bar, global command palette, skip link
- [x] Navigation between pages under an `(app)` route group, with honest placeholders that name the delivering phase
- [x] Dashboard: today's focus, needs attention, continue learning, recent mistakes, quick actions (sample learner data)
- [x] Language Finder: intent search with modes, example searches, fit guide, result cards, context tool, writing vs speaking, honest no-match state
- [x] Language detail (`/language/[slug]`, 22 sample items): meaning, context, warnings, collocations, examples, skills, mistakes, related language
- [x] Practice: five retrieval modes (complete the sentence, natural expression, typed preposition, replace repetition, collocation) with immediate feedback and a summary
- [x] Responsive behaviour verified at 375 / 768 / 1024 / 1440 px
- [x] Every prototype screen marked as such; saving is session-only and labelled; no persistence, backend or AI

**Out of scope:** database, auth, real search, real practice logic.
**Exit criteria:** owner approves the look, the flow, and the information architecture.

---

## Phase 2 — Application Foundation ✅ (approved, PR #6 and #7, `v0.2.0`)

**Goal:** real users, real persistence, real routing — without changing the product experience.

- [x] Better Auth with email + password (Google OAuth deliberately deferred; the schema already supports it)
- [x] PostgreSQL 17 (Docker locally, Neon in production) + Drizzle ORM: client, schema, SQL migrations, `db:*` scripts
- [x] Zod-validated server environment (`src/server/env.ts`) with an optional, unused AI boundary
- [x] Users, sessions, accounts, verifications, rate limits (Better Auth) + `learner_profiles` (target band, test date, focus skill)
- [x] Sign-in and sign-up screens: validation, pending, invalid-credentials, rate-limit, session-expired and signed-out states
- [x] Protected `(app)` routes: cookie-presence `proxy.ts` + database-validated `requireSession()`; open-redirect-safe return paths
- [x] Auth-aware shell: user menu with sign-out; personal greeting; `/settings` with name and learning profile
- [x] Security: hashed passwords, HttpOnly/SameSite/Secure cookies, origin checks, rate limiting, hidden session token, security headers
- [x] Layer boundaries enforced by ESLint
- [x] Error and not-found pages with correct HTTP status (pending states live in forms; route-level loading boundaries are added per page when data loading needs them, since a shell-wide one would turn real 404s into soft 404s)
- [x] Vitest unit + Postgres integration tests; CI runs migrations on a fresh database, checks schema drift, tests and builds
- Deferred: preferred register (moves to the Phase 5 preferences table)

**Exit criteria:** a user can sign up, sign in, sign out and edit their profile; sessions persist and expire correctly; unauthenticated users cannot reach app areas; all checks pass from a fresh database.

Follow-up: the auth response hardening (session tokens removed from every auth JSON body) landed on the phase branch after PR #6 was merged and reaches `main` through PR #7.

---

## Phase 2.1 — Public Discovery Layer ✅ (approved, PR #8, `v0.2.1`)

**Goal:** let visitors experience Lexora before creating an account. Prerequisite for Phase 3: the language engine is built for public pages as well as personal learning.

- [x] Route boundary: public discovery (`/`, `/explore`, `/language/[slug]`, auth pages, `/design-system`) vs authenticated personal learning (`/home`, `/finder`, `/bank`, `/practice`, `/writing`, `/speaking`, `/progress`, `/settings`)
- [x] Landing page that leads with a working search ("Find the English you mean.") and real results
- [x] `/explore`: the public Language Finder, sharing the Finder's view and search
- [x] Public, server-rendered language pages with titles, descriptions, canonical URLs, structured data, `robots.txt` and a sitemap
- [x] Shared language engine (`src/language`): `LanguageSearchService` over a `LanguageRepository` (`PrototypeLanguageRepository` today) — deterministic, no AI
- [x] Save gate: visitors who save are invited to create an account and are returned to the same page with the save completed
- [x] Save endpoint (`PUT`/`DELETE /api/bank/items/[slug]`) that authenticates every request, ignores client identity and rejects cross-site requests; nothing is stored until the language bank (Phase 5)
- [x] Public site header and footer; authenticated shell unchanged
- [x] Lint-enforced boundary: public routes can't import server code or prototype content
- [x] Tests: search service, return paths, proxy matcher, save endpoint (Postgres), and HTTP end-to-end route checks against a production build
- Not included: database-backed content (Phase 3), real retrieval (Phase 4), persistent saving (Phase 5)

**Exit criteria:** a visitor can search, read a language page and see the save gate without an account; personal areas still redirect to sign-in; saving is rejected server-side without a session; a new account returns to where it started.

---

## Phase 3 — Language Engine ✅ (approved, PR #11, `v0.3.0`)

**Goal:** a curated, structured language dataset, the domain model around it, and real search on real data (the scope approved in the Phase 3 specification on 7 October 2026, which moved real search here from Phase 4).

- [x] Content model: one YAML file per item in `content/`, senses with stable authored IDs, Zod validation (`pnpm content:check`)
- [x] Deterministic, rerunnable import (`pnpm content:import`): one transaction, release records, retire-not-delete
- [x] Wave 1: 40 published items, 42 senses, reviewed in content PRs #9 and #10
- [x] PostgreSQL language repository and the AI-free `LanguageSearchService`: query classification, full-text and trigram matching, conservative typo correction, deterministic ranking with explained results, a 23-case golden suite
- [x] Explore, Finder, landing-page search and command palette on the real engine; database-backed, sense-aware language pages
- [x] Persistent, sense-level saving (`saved_senses`), owned by the learner
- [x] Email verification and password reset (Better Auth, Resend, local outbox)
- [x] Responsive and accessibility quality pass
- Not included: AI, the Language Bank screen, practice, Wave 2 content (see Phase 4 and later)

**Exit criteria (met):** the dataset is validated in CI and imported deterministically, browsable by detail page with relationships visible, searchable through one engine on every surface, and learners' saves persist.

---

## Phase 4 — Search Depth 🔜 (approved, in progress)

**Status:** Specification approved by the owner on 17 October 2026 · Integration branch `phase/4-search-depth` · Steps 0–3 and 4.0 merged; Step 4.1 (gap reader and honest fallback) in review
**Specification:** [docs/specs/phase-4-search-depth.md](specs/phase-4-search-depth.md) — the reference for every step, with the readiness audit, worked examples and the decision register (§17)
**Release:** `v0.4.0` when the phase is approved

Phase 4 deepens Lexora's retrieval system rather than introducing new learning surfaces: helping learners **browse, filter, contextualise and discover language**, learning which searches the content doesn't satisfy, and protecting search, while keeping every result deterministic and explained.

Phase 4 remains **AI-free**.

### Scope (approved)

#### 1. Browse and filters

- Four dimensions: **kind** (the seven item kinds), **function** (the discourse functions), **IELTS use** (writing, Writing Task 1/2, speaking, Speaking Part 1/2/3 — skill and task in one control) and **topic**.
- One value per dimension initially; dimensions combine with AND.
- With a query, filters restrict the results without changing their ranking. Without a query, matching language is listed in a fixed order (IELTS relevance, then A–Z).
- Filters are dropdowns, not another row of chips.
- State lives in query parameters on `/explore` and `/finder` in one canonical order; non-canonical forms redirect to it.
- Filtered and paginated views are `noindex, follow` with a self-referencing canonical and stay out of the sitemap. Indexable topic or kind pages are deferred.

#### 2. Richer context-gap analysis

Deterministic matching against authored structures only (patterns, collocations, frames, linker details) — no parser, tagger or model:

- preposition gaps
- collocation gaps: adjective, noun and verb
- verb-frame gaps (the Phase 3 behaviour, kept)
- linker gaps
- at most two gaps in one sentence
- an honest message when a gap can't be read
- a sentence-level check for sentences without a gap, labelled as **not a grammar check**

#### 3. Unmatched-query feedback

Searches that find nothing (or only a full-text fallback) are counted to plan content, without tracking anyone:

- stored: the cleaned query (at most 80 characters), the outcome, the ISO week and a count
- never stored: IP address, user, session, user agent or which surface it came from
- not recorded at all: long sentences, gap queries, digit runs, `@` and URLs
- retention: 13 weeks
- a report command for the owner; no admin screen

#### 4. Search performance

Caching is **deferred**. Search is measured first, against a target of **p95 ≤ 150 ms on a warm Preview deployment**. Any cache needs a separate owner decision.

#### 5. Search rate limiting

A light limit on public search, proposed at **120 requests per minute per IP** with a Vercel Firewall rule. Firewall availability on the project's plan is verified first. If it isn't available, the step stops and reports the constraint; no alternative is built without a new owner decision.

#### 6. Ranking review

- The golden suite is expanded first (from 23 to about 65–70 cases) and a ranking snapshot is added, before any search behaviour changes.
- Ranking changes only to fix demonstrated failures.
- No popularity, click or personal signals.

#### 7. Topics and Wave 2 content

- Topics: **1–3 optional topics per meaning**, from a closed initial list of 10 (education, environment, health, technology, work, economy, government, cities, transport, society). General language has no topic. The topic model lands before Wave 2.
- Wave 2: about **110 more items** in **five batches of roughly 20–25**, one owner-reviewed content PR each, separate from feature work. The exit criterion is coverage (every topic, function, IELTS task and kind adequately covered), with **at least 140 published items**.

### Explicitly deferred

Phase 4 does **not** include:

- AI integration, AI semantic search or AI generation
- AI-generated explanations
- the Language Bank screen
- the Practice engine
- Writing Lab analysis
- Speaking Lab analysis
- result caching (unless the measured budget fails and the owner approves one)
- indexable topic or kind pages, multi-select filters

### Phase 4 sequence (approved)

| Step | Work                                                                                      |
| ---- | ----------------------------------------------------------------------------------------- |
| 0    | Approved specification, roadmap and architecture documentation brought up to date         |
| 1    | Regression baseline: expanded golden suite, ranking snapshot, the false-mistake-match fix |
| 2    | Content model: topics (and any newly approved discourse functions), validation, migration |
| 3    | Browse and filter queries in the language engine                                          |
| 4    | Filters and browse UI on Explore and the Finder                                           |
| 5a   | Context gaps I: preposition and collocation gaps                                          |
| 5b   | Context gaps II: linker gaps, two gaps, the sentence-level check                          |
| 6    | Search rate limiting (verify Vercel Firewall first)                                       |
| 7    | Privacy-first unmatched-query feedback                                                    |
| 8    | Performance measurement against the budget                                                |
| 9    | Ranking corrections for demonstrated failures                                             |
| 10   | Responsive, accessibility and product QA                                                  |
| 11   | Phase review and PR to `main`                                                             |

Wave 2 content runs in parallel from Step 2, in its own content PRs. Each step is built, reviewed and merged into the phase branch on its own; decisions the specification marks as _proposed_ are confirmed by the owner at the step that needs them.

### Phase 4 exit criteria

Phase 4 is complete when (measurable details in the specification, §16):

1. The 23 Phase 3 golden cases pass unchanged, and the expanded suite (at least 65 cases, none left pending) passes in memory and on PostgreSQL.
2. A ranking snapshot exists and every change to it since Step 1 is explained in its PR.
3. Browse and filters work across Explore and the Finder; filter state is shareable through canonical URLs and works with browser navigation; filtered pages are `noindex, follow`, self-canonical and outside the sitemap.
4. Context-gap analysis handles preposition, collocation, verb-frame and linker gaps and up to two gaps, explains every verdict, and says honestly when it can't read a gap.
5. The sentence-level check is labelled as not a grammar check.
6. Unmatched queries are recorded only as approved (no identifying data; exclusions applied) and are deleted after 13 weeks; the report command works.
7. Search latency is measured and meets p95 ≤ 150 ms on a warm Preview deployment, with no result cache unless the owner approved one.
8. Search traffic is protected by the approved rate limit, or the owner has decided how to proceed if the Firewall isn't available.
9. Topics exist in the authored content format and the database.
10. Wave 2 content is owner-reviewed and imported: at least 140 published items, meeting the specification's coverage targets.
11. Responsive (390–1440 px) and accessibility checks pass.
12. Preview stays isolated from Production, and production changes are expand-only migrations plus a reviewed import.
13. Unit/integration, golden-search, build and E2E checks pass.
14. Architecture, design and content documentation describe what was built.
15. Product review is complete and the owner approves the phase for merge to `main`.

---

## Phase 5 — Personal Learning ⬜

**Goal:** Lexora remembers what matters to each learner.

- Save to language bank (with personal notes)
- Mistakes log (from practice and audits)
- Spaced repetition scheduler (FSRS vs SM-2 decided here)
- Mastery model derived from review evidence
- Progress view: due items, mastery by category, weak areas

**Exit criteria:** saved items are scheduled and reviewed, and mastery changes reflect real recall.

---

## Phase 6 — Practice ⬜

**Goal:** deterministic exercises generated from the language data.

- Fill-in-the-blank, multiple choice, sentence correction
- Collocation and preposition drills
- Contextual selection (choose the best item for a sentence and register)
- Session flow, keyboard support, feedback, and results feeding SRS and mistakes

**Exit criteria:** practice sessions run end-to-end and update personal learning data.

---

## Phase 7 — Writing Lab ⬜

**Goal:** audit the learner's own writing with rules, not AI.

- Editor with inline annotations
- Repetition detection, preposition checks, collocation checks, linker variety, register mismatches
- Structured suggestions linked to language items and one-click save
- Findings feed the mistakes log

**Exit criteria:** a pasted Task 2 essay produces accurate, actionable findings.

---

## Phase 8 — Speaking Lab ⬜

**Goal:** speaking practice with a transcript-based language analysis.

- Recording (MediaRecorder), browser transcription where supported, manual transcript fallback
- Language analysis of the transcript (shared with the Writing Lab)
- Retry workflow: compare attempts and target expressions
- Privacy notes for browser speech services

**Exit criteria:** a learner can record, review the transcript and findings, and retry.

---

## Phase 9 — Optional AI ⬜

**Only after the non-AI product is useful on its own.**

- `AiProvider` adapter behind the existing intelligence interfaces, off by default
- Candidates: semantic search, contextual sentence interpretation, richer writing and speaking feedback, personalised explanations, generated practice
- Time-boxed calls with deterministic fallback; AI output labelled in the UI
- Cost controls and per-user limits

**Exit criteria:** with AI disabled, nothing degrades; with AI enabled, measurable improvements.

---

## Phase 10 — Production QA ⬜

- Accessibility audit (WCAG 2.1 AA, keyboard, screen readers, zoom)
- Performance budgets and profiling
- Responsive testing across devices
- Security review (auth, authorisation, rate limits, CSP, dependency audit)
- Test coverage: unit (domain), integration (repositories), e2e (critical flows)
- Error handling and observability
- Dark mode (if not delivered earlier)
- UX polish pass

---

## Open decisions (tracked)

| Decision                      | Needed by                     | Status / options                                                                                          |
| ----------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| Typography pairing            | —                             | ✅ Inter + Newsreader (serif for language only)                                                           |
| Ink accent hue                | —                             | ✅ Muted indigo `#4450A8`                                                                                 |
| Interface spelling            | —                             | ✅ British English; American spellings recognised as variants                                             |
| Auth library                  | —                             | ✅ Better Auth, email + password                                                                          |
| ORM                           | —                             | ✅ Drizzle                                                                                                |
| Hosting & DB provider         | —                             | ✅ Vercel + Neon (Docker Postgres locally)                                                                |
| Email provider                | Phase 3                       | ✅ Resend, behind an `EmailSender` abstraction                                                            |
| Google OAuth                  | When wanted                   | Configure `socialProviders.google`; no schema change                                                      |
| Vercel preview deployments    | Before Phase 4 implementation | ✅ Separate Neon `preview` branch and auth secret; sign-in uses Vercel's preview addresses (`app-url.ts`) |
| Unmatched-query privacy model | Phase 4 specification         | ✅ Cleaned query, outcome, week, count; nothing identifying; 13 weeks (Phase 4 spec D1)                   |
| Topic taxonomy                | Phase 4 step 2                | ✅ 1–3 optional topics per meaning, closed list of 10 (Phase 4 spec D4, §6)                               |
| Browse URLs and indexing      | Phase 4 step 4                | ✅ Canonical params; filtered views noindex, self-canonical, not in sitemap (D2)                          |
| Search caching                | Phase 4 step 8                | ✅ Deferred; measure first, p95 ≤ 150 ms on warm Preview (D6)                                             |
| Search rate limiting          | Phase 4 step 6                | Approved: 120 req/min/IP via Vercel Firewall, if available; else stop and report (D7)                     |
| Ranking changes               | Phase 4 step 1                | ✅ Golden suite and snapshot first; fix demonstrated failures only (D8)                                   |
| New discourse functions       | Phase 4 step 2                | ✅ comparison, decrease, opinion, hedging (owner, 17 October 2026; D11)                                   |
| Content sourcing & licensing  | Phase 3                       | ✅ Mixed: Lexora's curated data is the source of truth; provenance kept                                   |
| SRS algorithm                 | Phase 5                       | FSRS (proposed) / SM-2                                                                                    |
| Dark mode timing              | Any                           | Phase 10 (current plan)                                                                                   |
