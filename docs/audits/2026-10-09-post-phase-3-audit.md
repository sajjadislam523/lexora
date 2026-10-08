# Post-Phase-3 project audit — 9 October 2026

> A dated record of where Lexora stood after the Phase 3 release and the first production deployment. It is a snapshot, not a living document: for current scope see [ROADMAP.md](../ROADMAP.md), for architecture see [ARCHITECTURE.md](../ARCHITECTURE.md). No secrets are recorded here.

## 1. Snapshot

| Item                 | State                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Released version     | `v0.3.0` — Phase 3, Language Engine — on `main` at `d2083a5` (merge of PR #11)                                          |
| Production           | https://lexora-five-sigma.vercel.app, deployed from `main`; read-only smoke tests passing                               |
| Repository           | 140 commits on `main`, 11 PRs, tags `v0.0.0` → `v0.3.0`, CI passing                                                     |
| Branches after audit | `main` and the phase branches `phase/2-application-foundation`, `phase/2.1-public-discovery`, `phase/3-language-engine` |
| Next phase           | Phase 4 (Search Depth), not started; scope still to be written into the roadmap and approved                            |

From the first commit (7 October) to a live, database-backed product took about two days.

## 2. Release timeline

| Release  | Phase                        | PRs          | Delivered                                                                                                                                                                                                            |
| -------- | ---------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v0.0.0` | 0 — Foundation               | #1           | Next.js 16, React 19, strict TypeScript, Tailwind 4 token system, self-hosted fonts, core Lexora components, `/design-system`, lint and format, the five core docs                                                   |
| `v0.1.0` | 1 — Visual Prototype         | #2–#5        | Design language v0.2; app shell (sidebar, mobile sheet, command palette); prototype Home, Finder, language pages (22 sample items) and Practice; responsive at 375–1440 px; every prototype screen labelled          |
| `v0.2.0` | 2 — Application Foundation   | #6, #7       | Better Auth email and password; PostgreSQL with Drizzle migrations; validated environment; protected app routes; Settings and learner profile; security baseline (#7 kept session tokens out of every JSON response) |
| `v0.2.1` | 2.1 — Public Discovery Layer | #8           | Public/private route boundary, landing page with live search, public Explore, SEO language pages, sitemap, save gate, HTTP end-to-end tests                                                                          |
| `v0.3.0` | 3 — Language Engine          | #9, #10, #11 | See §3. Merged 8 October; tagged manually on 9 October (§8)                                                                                                                                                          |
| —        | First production deployment  | —            | 8 October; see §5                                                                                                                                                                                                    |

## 3. Phase 3 — the 13 approved steps

1. **Content schema** — one YAML file per item, Zod-validated, closed vocabularies shared with database enums; items have senses with stable authored IDs (`significant.notable`).
2. **Validation** — `pnpm content:check` with line-accurate errors.
3. **Save model** — `saved_senses` (learner, sense); a saved sense can't be deleted.
4. **Import pipeline** — `pnpm content:import`: one locked transaction, checksum skip, safety checks, retire-not-delete, a recorded release.
5. **Content** — 40 items and 42 senses, in two owner-reviewed content PRs (#9, #10).
6. **Repository** — PostgreSQL data access with an in-memory equivalent for tests.
7. **Search service** — no AI: query classification, full-text and trigram matching, typo correction only for one clear candidate, deterministic ranking, a reason for every result.
8. **Search tests** — a golden suite of 23 cases (the 12 agreed scenarios plus 11), against both repositories.
9. **Search everywhere** — Explore, Finder, the landing page and the command palette use the real service; demo data removed.
10. **Language pages** — all 40 from the database; per-meaning blocks; related links to the right meaning; 308 redirects for old and retired slugs.
11. **Saving** — per meaning, persistent, owned by the learner; optimistic UI corrected by the server; honest database-outage handling.
12. **Account email** — verification (never blocks, never signs in), resend, password reset; Resend delivery behind `EmailSender`, local outbox for development and tests.
13. **Responsive and accessibility pass** — overlays return focus to their opener, failed submits focus the first invalid field, search results are announced, larger touch targets, an accurate prototype badge, Back to search keeps the query, visible tags on multi-meaning pages, and the save gate's primary action first in keyboard order.

## 4. Product and architecture

**What works:** anyone can search the 40 reviewed items (idea, word, preposition, collocation, linker, sentence gap) with typo help and explained results, and read each item's page. Learners can create an account, sign in, edit their profile, save and unsave individual meanings, verify their email and reset their password. Home's dashboard content and the Practice session are labelled sample data; Language bank, Writing Lab, Speaking Lab and Progress are labelled placeholders naming their phase.

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind 4 tokens, shadcn/Radix, Better Auth, Drizzle with PostgreSQL (Docker locally, Neon in production), Vitest, pnpm 12.

**Size:** about 18,800 lines of application code (191 files), 5,100 lines of tests (40 files), 50 content files, 17 pages and 3 route handlers, 23 database tables from 4 migrations, 15 runtime and 16 development dependencies, 57 decision-log entries.

**Key decisions:** YAML is the authored source and PostgreSQL the runtime source, joined by a deliberate import step; authored sense IDs are the database keys and content is retired, never deleted; search is deterministic and AI-free; public pages are identical for everyone and never read the session on the server; layer boundaries are enforced by lint; email sits behind a small interface.

## 5. Production

| Component   | State                                                                                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel      | Project `lexora`, Node 24, functions in `iad1`, Next.js preset; production domain `lexora-five-sigma.vercel.app`                                                                                                                      |
| Neon        | Database `neondb`, PostgreSQL 18.6, us-east-1 (same region as the functions); 4 migrations applied; content release 1 — 40 items, 42 senses, 103 examples, 54 mistakes, 32 relations, 8 intents                                       |
| Variables   | Production has `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (matches the production domain), `RESEND_API_KEY`, `EMAIL_FROM` — verified by name only                                               |
| Email       | Resend without a verified domain: the test sender delivers only to the Resend account owner's address                                                                                                                                 |
| Deployments | Four failed builds, then success. Causes: `DATABASE_URL` missing (the Neon integration had been connected with a custom variable prefix), then an empty database. Fixed by configuration plus migration and import; no code change    |
| Smoke test  | Passing: public pages, search, typo handling, language pages, sitemap, 404, protected redirect, security headers, auth origin check, 401 for unauthenticated saves. Still to do: sign-up, email, saving and reset with a real account |

**How the production database was prepared:** the connection strings were kept in a private, owner-only file outside the repository and shredded afterwards; the database was inspected read-only first (it was empty); then only `pnpm db:migrate` and `pnpm content:import` (run twice, the second reporting "nothing to import") were executed. Vercel stores the Neon values as Sensitive, so they can't be pulled with the CLI — the strings come from the Neon console.

## 6. Security posture

Passwords hashed by Better Auth. Sessions in HttpOnly, Secure, SameSite=Lax cookies, validated against the database on every request, never in JSON. Authorisation on the server for every page, action and endpoint, with identity taken only from the session. Saves are owned, refused cross-site, and only published senses can be saved. Verification links grant nothing; reset tokens last an hour, are single-use and stored hashed, and a reset ends every session. Email tokens travel in the URL fragment. Rate limits on sign-in, sign-up and the email endpoints; reset endpoints accept only Lexora's own origin. Environment validated at start-up; no secrets in the repository; security headers plus HSTS.

## 7. Quality at release

| Check                                  | Result                                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Format, lint, typecheck, content check | Pass                                                                                                  |
| Unit and PostgreSQL integration tests  | 346 pass                                                                                              |
| End-to-end checks (production build)   | 117 pass                                                                                              |
| Production build                       | 61 pages, locally and on Vercel                                                                       |
| CI                                     | Pass on the PR and on `main` (fresh-database migrations, drift check, two imports, tests, build, e2e) |
| Accessibility                          | Step 13 browser audit at 390, 430, 768, 1024, 1280 and 1440 px; HTML accessibility checks run in CI   |

## 8. Process notes

- Owner checkpoints held at every step. When an early merge attempt was denied, the `owner-approved` label checkpoint was added to CI instead of broadening permissions.
- PR #10 targeted the Wave 1a branch rather than the phase branch and was merged into the phase branch manually.
- CI failed once in Phase 3 after a merge without the full suite; since then the full suite runs before every merge.
- PR #11 was merged with GitHub's merge button instead of the label checkpoint. All checks had passed, but the automatic release tag didn't run, so `v0.3.0` was created manually on 9 October with the same format as earlier tags.
- The local `.env.local` had `BETTER_AUTH_URL` pointing at the Vercel address, which breaks local tests and builds; it should be `http://localhost:3000`.
- On 9 October all work branches (20 local, 7 on GitHub) were deleted after confirming each was fully contained in `main`; only `main` and the phase branches remain.

## 9. Open items at the time of the audit

**Soon**

1. Exercise sign-up, email, saving and password reset on the live site with the Resend account's address.
2. Restore `.env.local` to `BETTER_AUTH_URL="http://localhost:3000"`.
3. Preview deployments share the production database, and one fixed `BETTER_AUTH_URL` can't serve preview addresses: give Preview its own Neon branch and settings before relying on previews (the roadmap's open decision on preview deployments).

**Before a public launch**

4. Get a domain (GitHub Student Pack), verify it in Resend and switch `EMAIL_FROM`; until then only the owner receives email, so other learners can't reset a forgotten password.
5. Rate limits for public search and the save endpoints.
6. Error monitoring beyond Vercel logs (Sentry is a candidate for later).
7. Logging hardening: failed-query logs include query parameters (which can contain an email address), and a malformed connection string is printed in full by the `Invalid URL` error.
8. Sign-up says when an address already has an account (Phase 2 design).

**Housekeeping**

9. Update the roadmap (Phase 3 done, Phase 2.1 approved, Phase 4 renamed to Search Depth with its real scope) and write the Phase 4 specification.
10. A custom domain to replace `lexora-five-sigma.vercel.app`; `BETTER_AUTH_URL` must change with it.
11. Automating the browser-only accessibility checks would need a browser test framework (an owner decision).
12. Content Security Policy is planned for Phase 10.

## 10. Recommended order

1. Production smoke test with a real account.
2. Local environment fix.
3. Isolated Preview environment.
4. Roadmap update and an approved Phase 4 (Search Depth) specification.
5. Domain and `EMAIL_FROM` switch when available.
6. Phase 4, with Wave 2 content alongside.
