# Lexora Roadmap

> Incremental phases. **Each phase ends with a review and explicit approval from the product owner before the next begins.** Claude Code must not start a later phase on its own.

**Current release: `v0.3.0` — Phase 3, Language Engine (complete)** · Next: Phase 4 — Search Depth (scoped, awaiting owner approval) · Phase 0 `v0.0.0` · Phase 1 `v0.1.0` · Phase 2 `v0.2.0` · Phase 2.1 `v0.2.1`

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

## Phase 4 — Search Depth 🔜

**Status:** Scoped, awaiting owner approval
**Release:** TBD

Phase 4 deepens Lexora's retrieval system rather than introducing new learning surfaces.

The goal is to make Lexora better at helping learners **browse, filter, contextualise and discover language**, while improving search performance and learning which searches the current content does not satisfy.

Phase 4 remains **AI-free**.

### Scope

#### 1. Browse and filters

Add structured browsing and filtering across the language catalogue.

Filters will support:

- Language kind
  - word
  - collocation
  - linker
  - preposition
  - sentence pattern
  - other approved language kinds
- Function
  - contrast
  - cause
  - result
  - comparison
  - emphasis
  - other approved functions
- IELTS task
- Skill

Filters will be represented in URL state so filtered views are shareable and browser-navigation friendly.

#### 2. Richer context-gap analysis

Expand contextual sentence-gap analysis beyond the Phase 3 verb-gap implementation.

Supported gap types will include:

- noun gaps
- adjective gaps
- preposition gaps
- verb gaps
- multiple gaps within one sentence
- whole-sentence fit

The search engine must explain why a candidate fits the supplied context.

#### 3. Unmatched-query feedback

Introduce privacy-conscious recording of searches for which the language engine finds no useful result.

If approved, the system will record:

- normalised query text
- occurrence count

It will not associate unmatched queries with a learner account.

Retention will be time-limited.

A developer/owner report command will expose the data for content planning. No learner-facing admin screen is planned.

#### 4. Search performance and protection

Improve public-search performance and resilience through:

- caching repeated searches
- cache invalidation after content import
- light search rate limiting

Search must remain responsive without weakening the deterministic ranking guarantees established in Phase 3.

#### 5. Ranking review

Review ranking using:

- the existing 23 golden cases
- an expanded golden suite
- observed aggregate search behaviour when meaningful traffic exists

Early ranking changes should primarily be validated against the expanded deterministic suite because Lexora may not yet have enough real-world usage data for reliable usage-driven tuning.

#### 6. Topics and Wave 2 content

Introduce a topic taxonomy such as:

- environment
- education
- technology
- society
- health
- economy
- other approved IELTS-relevant topics

The topic model must land before Wave 2 content begins so that topics are part of the authored content format rather than retrofitted later.

Wave 2 will grow the catalogue toward approximately 150 items.

Content will continue to be reviewed in owner-approved batches of approximately 20–25 items per content PR.

### Explicitly deferred

Phase 4 does **not** include:

- AI integration
- Language Bank screen
- Practice engine
- Writing analysis
- Speaking analysis
- AI-generated explanations
- AI semantic search

These remain assigned to later phases.

### Proposed Phase 4 sequence

| Step | Work                                                        |
| ---- | ----------------------------------------------------------- |
| 0    | Prerequisites, preview isolation and approved specification |
| 1    | Topics: content format, validation, migration and import    |
| 2    | Browse/filter queries in the language engine                |
| 3    | Filters and browse UI on Explore and Finder                 |
| 4    | Context-gap depth                                           |
| 5    | Privacy-first unmatched-query feedback                      |
| 6    | Search caching and rate limiting                            |
| 7    | Ranking review against expanded golden suite                |
| 8    | Wave 2 content in reviewed batches                          |
| 9    | Responsive/accessibility audit and product review           |

Wave 2 content may begin after Step 1 and proceed alongside subsequent implementation work.

### Phase 4 exit criteria

Phase 4 is complete when:

1. Browse and filtering work across the relevant search surfaces.
2. Filter state is shareable through URLs and works correctly with browser navigation.
3. Context-gap analysis supports more than verbs and handles whole-sentence fit.
4. Multiple gaps are supported where specified by the final Phase 4 specification.
5. Unmatched searches are recorded only if the owner approves the privacy model.
6. Recorded unmatched queries follow the approved retention policy.
7. Repeated searches are cached.
8. Search traffic is protected by the approved rate limit.
9. Cache invalidation occurs correctly after content import.
10. Ranking passes the expanded golden suite.
11. Topics exist in the authored content format and database.
12. Wave 2 content is owner-reviewed and imported.
13. Responsive and accessibility checks pass.
14. Unit/integration, golden-search, build and E2E checks pass.
15. Product review is complete.
16. The Phase 4 branch is approved for merge to `main`.

### Phase 4 approval gate

Phase 4 is **not implementation-approved** by this roadmap update.

Before implementation begins:

1. The preview environment must be isolated from Production.
2. The Phase 4 specification must be reviewed and approved.
3. The owner must explicitly approve the Phase 4 scope.
4. Only then may Phase 4 implementation begin.

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
| Vercel preview deployments    | Before Phase 4 implementation | Isolate Preview from Production: own Neon branch and settings; decide preview sign-in (`BETTER_AUTH_URL`) |
| Unmatched-query privacy model | Phase 4 specification         | Proposed: normalised query and count only, no account link, time-limited retention                        |
| Topic taxonomy                | Phase 4 step 1                | Proposed IELTS topics (environment, education, technology, society, health, economy, …)                   |
| Content sourcing & licensing  | Phase 3                       | ✅ Mixed: Lexora's curated data is the source of truth; provenance kept                                   |
| SRS algorithm                 | Phase 5                       | FSRS (proposed) / SM-2                                                                                    |
| Dark mode timing              | Any                           | Phase 10 (current plan)                                                                                   |
