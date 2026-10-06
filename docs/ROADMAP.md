# Lexora Roadmap

> Incremental phases. **Each phase ends with a review and explicit approval from the product owner before the next begins.** Claude Code must not start a later phase on its own.

**Current phase: Phase 0 — Foundation (complete, awaiting review)**

Legend: ✅ done · 🔜 next · ⬜ not started

---

## Phase 0 — Foundation ✅ (awaiting review)

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

## Phase 1 — Visual Prototype 🔜

**Goal:** see and feel the product end-to-end with static data, before building any backend.

- App shell: sidebar (collapsible; a sheet on mobile), top bar, global command palette
- Navigation between mock pages under an `(app)` route group
- Dashboard mock: items due, weak areas, recent searches (static)
- Language Finder mock: hero search, sample result groups by category, filters UI (skill, register, category)
- Language detail mock: overview, examples, collocations, mistakes, alternatives
- Practice UI mock: one exercise flow (multiple choice and fill-in-the-blank) with feedback states
- Responsive behaviour across mobile, tablet, and desktop
- Every mock page visibly marked as a prototype; no fake persistence

**Out of scope:** database, auth, real search, real practice logic.
**Exit criteria:** owner approves the look, the flow, and the information architecture.

---

## Phase 2 — Application Foundation ⬜

**Goal:** real users, real persistence, real routing.

- Choose auth (Better Auth vs Auth.js) and implement email plus one OAuth provider
- PostgreSQL + Drizzle: client, schema scaffolding, migrations, local Docker setup
- Zod-validated environment (`src/lib/env.ts`)
- User profile: target band, test date, skill focus, preferred register
- `(app)` routes protected via `proxy.ts`; persistent layout
- Folder boundaries from ARCHITECTURE.md, with ESLint import rules enforcing them
- Error and not-found pages

**Exit criteria:** a user can sign up, sign in, and edit their profile, and the shell persists across routes.

---

## Phase 3 — Language Engine ⬜

**Goal:** a curated, structured language dataset and the domain model around it.

- Domain types and Zod schemas: items, patterns, examples, relations, preposition links, mistakes, categories, topics
- Content source files in `src/content/` with validation and a seed script
- Initial dataset: high-frequency IELTS vocabulary, synonyms, dependent prepositions, collocations, linkers, sentence patterns, speaking expressions (size to be agreed)
- Read-only language detail pages backed by the database
- Vitest set up for domain logic

**Exit criteria:** the dataset is validated in CI, browsable by detail page, and relationships are visible.

---

## Phase 4 — Language Finder ⬜

**Goal:** the core retrieval experience, without AI.

- Query parsing (synonym / preposition / intent / general templates)
- Intent library with trigger phrases ("I want to express contrast")
- Postgres full-text search + `pg_trgm` fuzzy matching (typo tolerance)
- Ranking, grouping by category, filters (skill, register, category, topic)
- Search UI wired up: debounced, keyboard-navigable, empty, no-result, and error states
- Command palette search integration

**Exit criteria:** the example queries in the product brief return relevant, ranked, grouped results.

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

| Decision                     | Needed by | Options                                                      |
| ---------------------------- | --------- | ------------------------------------------------------------ |
| Typography pairing           | Phase 1   | Inter + Newsreader (current) / alternatives                  |
| Ink accent hue               | Phase 1   | Muted indigo `#4450A8` (current) / alternatives              |
| Interface spelling           | Phase 1   | British (proposed) / American                                |
| Auth library                 | Phase 2   | Better Auth / Auth.js                                        |
| ORM                          | Phase 2   | Drizzle (proposed) / Prisma                                  |
| Hosting & DB provider        | Phase 2   | Vercel + Neon / Supabase / self-hosted                       |
| Content sourcing & licensing | Phase 3   | Hand-curated / open lexical sources (licence review) / mixed |
| SRS algorithm                | Phase 5   | FSRS (proposed) / SM-2                                       |
| Dark mode timing             | Any       | Phase 1 / Phase 10                                           |
