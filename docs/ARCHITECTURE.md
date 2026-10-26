# Lexora Architecture

> Technical architecture, boundaries, and decisions. Status: **Phase 4 — Search Depth released (`v0.4.0`); Phase 5 — Retrieval Loop code-complete, awaiting owner approval** ([approved specification](specs/phase-5-retrieval-loop.md); built: hardening, the scheduler and review data model, the exercise generator with its accept lists, the language bank, the review session, personal mistake evidence, an honest Home and truthful save copy). Real accounts and sessions, curated language content in PostgreSQL, a deterministic search engine and sense-level saving exist. Anything marked _Target_ or _Planned_ is agreed direction, not built code.

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
| Validation                 | **Zod 4**: env, server action inputs, form schemas, authored content files                 | ✅           |
| Database                   | **PostgreSQL 17** — Docker locally, **Neon** in production                                 | ✅           |
| ORM / migrations           | **Drizzle ORM** 0.45 + **drizzle-kit** (SQL migrations in `drizzle/`), postgres.js driver  | ✅           |
| Auth                       | **Better Auth** 1.7 (email + password; social providers later)                             | ✅           |
| Fuzzy search               | Postgres full-text search + `pg_trgm` (typo candidates, labelled fallback)                 | ✅ Phase 3   |
| Semantic search (optional) | `pgvector` + embeddings (local model or AI provider)                                       | Phase 9      |
| Spaced repetition          | FSRS (`ts-fsrs`) or SM-2, decided in Phase 5                                               | Phase 5      |
| Unit / integration tests   | **Vitest** — unit tests plus integration tests against Postgres                            | ✅           |
| E2E / a11y tests           | HTTP checks (Vitest + `fetch`, production build) ✅; browser: Playwright + axe             | Phase 6–10   |
| Speech                     | Browser `MediaRecorder` + Web Speech API (no paid STT)                                     | Phase 8      |
| Hosting                    | **Vercel** (app) + **Neon** (PostgreSQL)                                                   | Configured   |

---

## 3. Current structure (Phase 3)

```text
lexora/
├── CLAUDE.md · AGENTS.md · README.md
├── docs/                         # DESIGN, UX_PRINCIPLES, ARCHITECTURE, ROADMAP, WORKFLOW
│   ├── specs/                    # Approved phase specifications (Phase 4 onward)
│   └── audits/                   # Dated project audits: snapshots, not living documents
├── content/                      # Authored language: one YAML file per item, intents, sources (see content/README.md)
├── docker-compose.yml            # Local PostgreSQL 17 (development only)
├── drizzle.config.ts             # drizzle-kit: schema path, migrations dir, direct DB URL
├── drizzle/                      # Generated SQL migrations (committed; never edited by hand)
├── .env.example                  # Documented environment template (real .env files are ignored)
├── scripts/                      # auth-generate.mjs (Better Auth tables), content.mts (content:check, content:import)
├── test/                         # Vitest setup, fixtures, Postgres integration tests, the golden search suite
├── e2e/                          # HTTP end-to-end checks against a production build (pnpm test:e2e)
└── src/
    ├── proxy.ts                  # Optimistic protection of personal areas (cookie presence only)
    ├── app/
    │   ├── layout.tsx · globals.css · robots.ts · sitemap.ts · not-found.tsx
    │   ├── (public)/             # Public discovery: no session read on the server, SiteHeader/Footer
    │   │   ├── page.tsx          #   Landing page (static, revalidated hourly)
    │   │   ├── explore/page.tsx  #   Public Language Finder (searched on the server per ?q=)
    │   │   └── language/[slug]/page.tsx   # Language pages from PostgreSQL (ISR, SEO metadata)
    │   ├── (auth)/               # sign-in, sign-up, forgot/reset password, verify email — own layout, public
    │   ├── (app)/                # Personal learning: requireSession() in layout.tsx; persistent AppShell
    │   │   ├── home|finder|bank|practice|writing|speaking|progress|settings/page.tsx
    │   │   └── error.tsx
    │   ├── api/auth/[...all]/route.ts   # Better Auth endpoints
    │   ├── api/bank/saved/…              # Saved senses: GET state, PUT/DELETE one sense (authenticated per request)
    │   └── design-system/        # Visual review surface (public, static sample data)
    ├── components/
    │   ├── ui/                   # shadcn primitives + NativeSelect, restyled to tokens
    │   ├── lexora/               # Lexora product components (presentational, incl. FormField)
    │   ├── language/             # Shared save flow: SavedLanguageProvider, save gate, saveable cards
    │   ├── site/                 # Public header, footer, logo, analytics
    │   └── shell/                # AppShell, sidebar, user menu, top bar, command palette
    ├── features/                 # Screen composition: auth, dashboard, discovery, finder, language, practice, settings
    ├── language/                 # Shared language engine (§7)
    │   ├── model.ts · engine.ts  #   Domain types and the content repository interface
    │   ├── schema/               #   Authored content format (Zod) and the closed vocabularies shared with the DB enums
    │   ├── search/               #   classify, match, rank, service: the deterministic search pipeline
    │   ├── examples.ts           #   Client-safe search modes and example searches
    │   └── index.ts              #   Server-only composition root (repository + search service)
    ├── server/                   # Server-only (import "server-only")
    │   ├── env.ts · site-url.ts · app-url.ts  # Zod-validated environment; public origin; app URL per environment
    │   ├── auth/                 #   Better Auth config, session helpers, account-email links
    │   ├── content/              #   Content validation, row building and the import transaction
    │   ├── email/                #   EmailSender (Resend / outbox) and the account email templates
    │   ├── http/                 #   Same-origin guard for cookie-authenticated route handlers
    │   ├── db/                   #   Drizzle client + schema (auth tables generated, product tables hand-written)
    │   └── repositories/         #   Data access: language (published content, read-only), saved senses, learner profiles
    ├── lib/                      # Shared, client-safe utilities (cn, auth client, safe redirect, analytics privacy, constants)
    └── styles/                   # Design tokens and type roles
```

---

## 4. Application foundation (Phase 2)

### 4.1 Authentication

- **Library:** Better Auth 1.7 with the Drizzle adapter (`provider: "pg"`, plural table names). Configured only in `src/server/auth/auth.ts`.
- **Method:** email + password. The `accounts` table already models "one user, many providers", so Google OAuth is added by configuring `socialProviders` — no schema or architecture change.
- **Passwords:** Better Auth's built-in **scrypt** (salted). 8–128 characters. No custom crypto.
- **Sessions:** opaque random tokens stored in the `sessions` table; 7-day expiry, refreshed at most daily. The cookie (`lexora.session_token`) is `HttpOnly`, `SameSite=Lax`, and `Secure` whenever the app URL is https. No cookie cache: every request validates against the database, so sign-out and revocation take effect immediately. The token is stripped from JSON session responses (`customSession` plugin), so client code never sees it.
- **Endpoints:** `/api/auth/*` via `toNextJsHandler`. Browser code uses `src/lib/auth-client.ts` (same origin, no secrets).
- **Server helpers** (`src/server/auth/session.ts`): `getSession()` (deduplicated per request), `requireSession()` (redirects to `/sign-in?next=…`, adding `reason=session-expired` when a cookie existed but its session didn't), and `toSafeUser()` — the only user fields (`id`, `name`, `email`) allowed into client components.

### 4.1.1 Account email (Phase 3, step 12)

Email verification and password reset are Better Auth's flows, configured in `auth.ts`. Better Auth creates, expires and consumes every token; Lexora only puts tokens into links and delivers the email.

- **Delivery** (`src/server/email/sender.ts`): an `EmailSender` interface with two transports, chosen by `EMAIL_TRANSPORT`. `resend` posts to Resend's HTTP API (no SDK); `outbox` writes each message as a JSON file to `EMAIL_OUTBOX_DIR` (default `.email-outbox/`, git-ignored). The outbox is the default outside production, so development never sends real email by accident. Production defaults to `resend` and refuses to start without `RESEND_API_KEY` and `EMAIL_FROM`. The outbox is allowed in a production build only on a localhost URL (local `pnpm start` and CI). Delivery errors carry only a cause (an HTTP status or error name), never the recipient, content or link.
- **Templates** (`src/server/email/templates.ts`): plain text and simple HTML for verification and reset. They never include the account's name, since anyone can sign up with someone else's address.
- **Links** (`src/server/auth/emails.ts`): `<BETTER_AUTH_URL>/verify-email#token=…` and `<BETTER_AUTH_URL>/reset-password#token=…`. The token is in the **fragment**, which browsers never send to a server, so it stays out of request logs (including Vercel's), analytics and `Referer`. The page reads it in the browser. Verification posts it to a server action (`verifyEmailAction`, which calls `auth.api.verifyEmail`) and then removes it from the address bar. Reset posts it in the body of `POST /api/auth/reset-password`.
- **Verification never gates anything** (Phase 3 decision 3). `requireEmailVerification: false`: an unverified learner signs in and uses every area, search, language pages and saving. The link only marks the address verified. `autoSignInAfterVerification: false`, so opening it creates no session and sets no cookie, whoever opens it. Verification tokens are Better Auth's signed JWTs (HS256 with `BETTER_AUTH_SECRET`), valid for **24 hours**, and not stored. Reopening a link for a verified address is a harmless no-op; Better Auth doesn't make them single-use because they grant nothing. Email change is not enabled, so no link can change an address. A reminder on `/home` and the status in Settings → Account are the only traces. Settings offers _Send verification email_, which Better Auth sends only to the signed-in learner's own address.
- **Password reset:** `POST /api/auth/request-password-reset` answers the same for every address. The email is sent after the response (`advanced.backgroundTasks` → Next's `after()`), so neither the answer nor its timing shows whether an account exists. Reset tokens are 24 random characters, valid for **1 hour**, single-use (consumed atomically), and **stored only as a SHA-256 hash** (`verification.storeIdentifier: "hashed"`). The new password goes through the same rules (8–128) and scrypt hashing as sign-up. `revokeSessionsOnPasswordReset: true` deletes **every** session of the account, including the one that requested the reset, so a session obtained before the reset (by anyone) stops working. The learner then signs in with the new password (`/sign-in?reason=password-reset`).
- **Failure:** if delivery fails on sign-up, the account is created and signed in as normal; the failure is logged (cause only) and the learner can send a new link from Settings. A failed reset email leaves the answer generic. A failed _Send verification email_ answers 503, so the signed-in learner is told it wasn't sent.

### 4.2 Route boundary (Phase 2.1)

Lexora has three layers. Visitors can use the first; the second serves both; the third needs an account.

```text
Public Discovery Layer      /  ·  /explore  ·  /language/[slug]            (no account, no user data)
          │  reads language through
          ▼
Shared Language Engine      src/language — LanguageRepository + LanguageSearchService
          ▲  reads language through
          │
Authenticated Personal Learning   /home · /finder · /bank · /practice · /writing · /speaking · /progress · /settings
```

| Route                         | Access        | Rendering                        | Notes                                                                                                                                                               |
| ----------------------------- | ------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                           | Public        | Static                           | Landing page with live search into `/explore`                                                                                                                       |
| `/explore`                    | Public        | Dynamic (per URL state)          | Finder and browse (`q, kind, function, use, topic, page`); non-canonical URLs 307; `?q=` pages `noindex`, canonical `/explore`; filtered views self-canonical       |
| `/language/[slug]`            | Public        | Static (ISR, hourly) + on demand | Published items from PostgreSQL; old or retired slugs 308; drafts and unknown slugs real 404s. Title, description, canonical URL, Open Graph, `DefinedTerm` JSON-LD |
| `/sign-in`, `/sign-up`        | Public        | Dynamic                          | Redirect signed-in users to `next`                                                                                                                                  |
| `/forgot-password`            | Public        | Static                           | Requests a reset link; the same answer for every address                                                                                                            |
| `/reset-password`             | Public        | Static                           | Sets a new password with the token from the link's fragment; `noindex`                                                                                              |
| `/verify-email`               | Public        | Dynamic                          | Verifies the address with the token from the link's fragment; never signs in; reads the session only to choose the next step; `noindex`                             |
| `/design-system`              | Public        | Static                           | Internal reference                                                                                                                                                  |
| `/robots.txt`, `/sitemap.xml` | Public        | Static                           | Personal areas and `/api/` disallowed; sitemap lists public pages only                                                                                              |
| `/home` … `/settings`         | Authenticated | Dynamic                          | Proxy redirect + `requireSession()` in the `(app)` layout                                                                                                           |
| `/api/auth/*`                 | Public        | —                                | Better Auth (origin-checked, rate-limited)                                                                                                                          |
| `/api/bank/saved?senses=…`    | Authenticated | —                                | Which of the listed senses (max 60) the learner saved; 401 without a session, 400 malformed                                                                         |
| `/api/bank/saved/[senseId]`   | Authenticated | —                                | `PUT` save / `DELETE` remove one sense; 401 without a session, 403 cross-site, 400 malformed ID, 404 unless a published sense; 503 when the database is down        |

**Public pages never read the session on the server.** The `(public)` layout and its pages render the same HTML for everyone, so they can be prerendered and cached and can't leak user data. ESLint enforces it: `src/app/(public)/**` and the public features (`discovery`, `finder`, `language`) can't import `@/server/*`, and public routes read language only through `@/language`. Account-aware UI (header buttons, _Practise this_, the save gate) is resolved in the browser by `SavedLanguageProvider` from Better Auth's `get-session` (token-free).

**Account actions authenticate themselves.** Saving is an HTTP endpoint, not something the page decides: it validates the session cookie against the database, takes the user only from that session (no user id in the URL or body), and checks `Origin` against the app origin because route handlers don't get Next's server-action CSRF protection. Learners save a **sense** (`significant.notable`), stored in `saved_senses`; only published senses of published items can be newly saved, and save and remove are idempotent. Public pages ask for the saved state of the senses on screen in one request (`GET /api/bank/saved?senses=…`), so their HTML stays the same for everyone. A visitor's save gets 401, which opens the save gate; during a database outage the endpoints answer 503 instead (Better Auth reports an outage as “no session”, so they check the database before answering 401).

**Public language data is separate from user data.** The language tables have no user columns and the language repository can't import auth or user-data code (lint). Personal state (saved senses, later review status) comes from user-owned tables and is fetched separately, never merged into public content.

**Return paths.** The save gate sends visitors to `/sign-up?next=<current page>` (or sign-in). `safeRedirect()` accepts relative paths into personal areas and the public return routes (`/explore`, `/language/*`), and nothing else. The started save is remembered in `sessionStorage` for 30 minutes and completed when the session appears.

### 4.2.1 Route protection (two layers)

1. **`src/proxy.ts`** — a fast, optimistic check: on personal-learning paths, no session cookie → redirect to `/sign-in?next=<path>`. It never validates the session and never touches the database. Public routes are outside its matcher.
2. **`(app)/layout.tsx` → `requireSession()`** — the authoritative check against the database for every app page. **Every server action calls `requireSession()` and every route handler calls `getRequestSession()` itself**; the proxy is never relied on for authorisation.

`PROTECTED_ROUTES` in `src/lib/auth-constants.ts` lists the personal areas; tests keep the proxy matcher in sync and assert it never covers public routes. Auth pages redirect signed-in users server-side (never in the proxy, to avoid stale-cookie loops).

### 4.3 Authorisation

Authorisation is ownership: product data belongs to one user. Server actions take the user id **from the session, never from input**, and repositories require that id explicitly (`upsertLearnerProfile(userId, …)`). Roles and organisations are out of scope until a real need appears.

### 4.4 Database and migrations

- **Driver:** postgres.js through `drizzle-orm/postgres-js`, one client per server instance (`src/server/db/client.ts`, global singleton in development). Prepared statements are disabled automatically for Neon's pooled (`-pooler`) host; pool size is small on Vercel.
- **Schema:** `src/server/db/schema/` — `auth.ts` is **generated** by the Better Auth CLI (`pnpm auth:generate`) and owned by the library; product tables (`profile.ts`, and future tables) are hand-written and reference `users.id`. Casing: `snake_case` columns.
- **Migrations:** `pnpm db:generate` writes SQL to `drizzle/` (committed, reviewed in PRs); `pnpm db:migrate` applies it. Migrations use `DATABASE_URL_UNPOOLED` when set (Neon requires a direct connection for DDL). CI applies all migrations to a fresh database and fails if the schema changed without a migration.
- **Production rollout:** run `pnpm db:migrate` against Neon's direct URL before (or as part of) deploying code that needs the new schema. Migrations must be backwards-compatible with the running version (expand → migrate → contract).
- **Local-database guard (Phase 5 Step 0):** drizzle-kit (`drizzle.config.ts`), `pnpm content:import`, the test suite (`test/setup.ts`) and the E2E teardown (`e2e/global-setup.ts`) all call `guardDatabaseTarget` (`scripts/database-target.ts`) before touching the database. It allows only `localhost`, `127.0.0.1`, `::1` and Unix sockets (the Docker database and CI's service container) and refuses anything else before connecting, naming only the host. A deliberate remote run sets `LEXORA_ALLOW_REMOTE_DB` to the exact hostname in the shell; it's read before `.env.local` is loaded, warns loudly, and `CI` grants nothing (README → Local-database guard).
- **Seeding:** none for users — sign-up creates real users. Language content is imported, not seeded: `pnpm content:import` validates `content/` and writes it in one transaction, recording a release (see content/README.md → Importing).

### 4.5 Data model

| Table              | Owner       | Purpose                                                                                               |
| ------------------ | ----------- | ----------------------------------------------------------------------------------------------------- |
| `users`            | Better Auth | Identity: id, name, email, email_verified, image, timestamps                                          |
| `sessions`         | Better Auth | Active sessions (token, expiry, IP, user agent) → `users` (cascade)                                   |
| `accounts`         | Better Auth | Auth methods per user (`credential` = password hash; later `google`) → `users` (cascade)              |
| `verifications`    | Better Auth | Password-reset tokens, stored as SHA-256 hashes (verification links are signed JWTs, not stored)      |
| `rate_limits`      | Better Auth | Rate-limit counters shared across serverless instances                                                |
| `learner_profiles` | Lexora      | One per user: target band (4.0–9.0, step 0.5, DB-checked), test date, focus skill → `users` (cascade) |
| `saved_senses`     | Lexora      | A learner's saved meanings: user → sense, saved at; `users` cascade, `senses` restrict (Phase 3)      |
| `request_limits`   | Lexora      | Per-learner write limits: one row per user and action, its current minute and count; `users` cascade  |
| `review_cards`     | Lexora      | One per saved sense: Leitner box (0 new, 1–5), due at, reviews, lapses; cascades with the save        |
| `review_log`       | Lexora      | One row per answer, unique per card and review number; kept when a save is removed; `users` cascade   |
| Language tables    | Lexora      | Global, imported language content with no user columns (§6)                                           |

**Future tables** (designed for, not created): every one references `users.id` with `on delete cascade`, so deleting an account removes its data.

```text
users ─┬─ learner_profiles (1:1)          Phase 2 ✅
       ├─ preferences (1:1)               daily goal, register, reminders        Later
       ├─ saved_senses (1:n) ─── senses                                         Phase 3 ✅
       │    └─ review_cards (1:1 per save) Leitner box, due at (cascade)        Phase 5 ✅
       ├─ review_log (1:n)                every answer; kept when a save is removed  Phase 5 ✅
       ├─ request_limits (1:n)            per-user write limits                  Phase 5 ✅
       ├─ mistakes (1:n)                  personal mistakes: derived from review_log in Phase 5; a table only if Writing Lab needs one  Phase 7
       ├─ practice_sessions (1:n) ─ practice_answers (1:n)                       Phase 6 (if needed)
       ├─ writing_submissions (1:n) ─ audit_findings (1:n)                       Phase 7
       └─ speaking_sessions (1:n) ─ speaking_attempts (1:n)                      Phase 8
```

Language content (§6) is **global**, not per user. Phase 4 added `senses.topics` (Step 2). The unmatched-search counts table (Phase 4 specification §8) was deferred with the re-scope and doesn't exist. Phase 5 proposes three optional practice columns on `examples` (authored accept lists; [Phase 5 spec §13](specs/phase-5-retrieval-loop.md)).

### 4.6 Environment

Validated by Zod in `src/server/env.ts` (server-only) on first use; errors name the variable, never its value. Template: `.env.example`.

| Variable                | Required                                   | Notes                                                                  |
| ----------------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| `DATABASE_URL`          | Always                                     | Local Docker URL in development; Neon **pooled** URL in production     |
| `DATABASE_URL_UNPOOLED` | Production (Neon)                          | Direct URL, used only by migrations; falls back to `DATABASE_URL`      |
| `BETTER_AUTH_SECRET`    | Always                                     | ≥ 32 random characters; unique per environment; rotate by redeploying  |
| `BETTER_AUTH_URL`       | Production                                 | Production/local app URL; https in production; ignored on Preview      |
| `EMAIL_TRANSPORT`       | No                                         | `resend` (production default) or `outbox` (default elsewhere)          |
| `RESEND_API_KEY`        | When the transport is `resend`             | Resend API key (sending access only); never logged                     |
| `EMAIL_FROM`            | When the transport is `resend`             | Sender on a domain verified in Resend, e.g. `Lexora <account@…>`       |
| `EMAIL_OUTBOX_DIR`      | No                                         | Outbox folder, default `.email-outbox` (git-ignored)                   |
| `VERCEL_ENV`            | Set by Vercel                              | `preview` switches to Vercel's own addresses (`app-url.ts`)            |
| `VERCEL_BRANCH_URL`     | Set by Vercel (Preview)                    | Branch hostname: the app URL on Preview                                |
| `VERCEL_URL`            | Set by Vercel (Preview)                    | Deployment hostname: also trusted on Preview                           |
| `AI_PROVIDER`           | No                                         | `none` (default) — the optional Phase 9 boundary; nothing reads it yet |
| `AI_API_KEY`            | Only if `AI_PROVIDER` is a hosted provider | Never needed to run Lexora                                             |

No variable uses the `NEXT_PUBLIC_` prefix; nothing secret can reach the browser bundle. Development uses `.env.local` (git-ignored); production values live in Vercel's environment settings (Neon's Vercel integration provides both database URLs).

**Environments.** Each environment has its own database and auth secret, and they never share one:

- **Local:** Docker PostgreSQL; `BETTER_AUTH_URL=http://localhost:3000` in `.env.local`.
- **Preview (Vercel):** Git deployments are limited to `main` (`vercel.json` → `git.deploymentEnabled`), so branches and PRs create no previews; this isolation applies only to a preview deployed by hand. A dedicated Neon `preview` branch through Preview-only `DATABASE_URL` and `DATABASE_URL_UNPOOLED`, and its own `BETTER_AUTH_SECRET`. The Neon integration is connected to Production only. The app URL comes from Vercel's system variables (`VERCEL_BRANCH_URL`, else `VERCEL_URL`) when `VERCEL_ENV=preview`, and both addresses are trusted, so sign-in works on every preview; `BETTER_AUTH_URL` is ignored there. Email uses the Resend test sender, which only reaches the account owner. Previews stay behind Vercel's Deployment Protection.
- **Production (Vercel):** the production Neon database through Production-only `DATABASE_URL` and `DATABASE_URL_UNPOOLED`, its own `BETTER_AUTH_SECRET`, and the explicit `BETTER_AUTH_URL`. Production never derives its URL from Vercel's addresses.

The URL rules live in `src/server/app-url.ts` and read configuration only — never a request's `Host` or `Origin`. "Automatically expose System Environment Variables" must stay enabled in the Vercel project (the default). Lexora uses the open-source Better Auth library only, not Better Auth Infrastructure: `BETTER_AUTH_API_KEY` is neither read nor needed.

### 4.7 Security model

| Concern                | Measure                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Passwords              | Better Auth scrypt (salted); never logged or returned; 8–128 characters                                                                                                                                                                                                                                                                                      |
| Sessions               | Opaque DB-backed tokens; HttpOnly + SameSite=Lax (+ Secure on https); the token is never in any JSON body (see Token exposure); revocable instantly                                                                                                                                                                                                          |
| CSRF                   | SameSite=Lax cookies plus Better Auth's origin check against `trustedOrigins` (cross-origin POSTs with a cookie → 403); the cookie-less reset endpoints also require the app origin (a `hooks.before` check with `isSameOrigin()`); server actions use Next's built-in origin check; route handlers use `isSameOrigin()` (missing or foreign `Origin` → 403) |
| Brute force            | Database-backed rate limiting per IP: sign-in 5/min, sign-up 3/min, send verification email 3/min, request password reset 3/min, set a new password 5/min, other auth endpoints 100/min                                                                                                                                                                      |
| Request floods         | Public search (`/explore?q=`, `/finder?q=`): a Vercel Firewall rule, 120/min/IP, set in the Vercel project (README). Signed-in saves and removals: 60/min per learner in PostgreSQL (`request_limits`), counted after authentication, 429 with `Retry-After`. Review answers: 30/min when that endpoint exists (Phase 5 Step 5)                              |
| Account enumeration    | Sign-in errors are generic ("Email or password is incorrect"); reset requests answer the same, equally fast, for every address. Sign-up still says an address has an account (Phase 2 design)                                                                                                                                                                |
| Email tokens           | Better Auth's: reset tokens random, 1 hour, single use, stored hashed; verification JWTs 24 hours, grant nothing. In the URL fragment only; never in JSON, logs or analytics                                                                                                                                                                                 |
| Open redirects         | `safeRedirect()` allows only relative paths into protected areas and the public return routes (`/explore`, `/language/*`)                                                                                                                                                                                                                                    |
| Authorisation          | `requireSession()` in every protected layout, page and action; `getRequestSession()` (401) in route handlers; ids from the session only, never from the client                                                                                                                                                                                               |
| Public/private split   | Public routes never read the session server-side and can't import server code (ESLint); public language items carry no learner data                                                                                                                                                                                                                          |
| Server/client boundary | `server-only` on server modules; ESLint blocks runtime imports of server code from client layers; only `SafeUser` crosses into client components                                                                                                                                                                                                             |
| Secrets                | Zod-validated, never `NEXT_PUBLIC_`, never echoed in errors; no credentials committed (local and CI databases use localhost-only trust auth; CI generates its auth secret per run); GitGuardian scans every PR                                                                                                                                               |
| Headers                | `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy`, no `X-Powered-By`. Full CSP in Phase 10                                                                                                                                                                                                                    |
| Telemetry              | Better Auth telemetry disabled                                                                                                                                                                                                                                                                                                                               |
| Analytics              | Vercel Web Analytics: cookieless, aggregate page views. Every event passes `sanitizeAnalyticsEvent` (`lib/analytics-privacy`): only allowlisted query parameters with fixed values survive, so search text (`q`) and return paths (`next`) are never sent; the fragment (reset and verification tokens) is always removed                                    |

**Token exposure.** Lexora authenticates only with the HttpOnly session cookie — no bearer tokens — so a session token in a response body is never needed. Better Auth returns one by default in `sign-in/email`, `sign-up/email` and `list-sessions`. Rather than modifying Better Auth, a documented `hooks.after` middleware (`redactSessionTokens`, `src/server/auth/redact.ts`) removes `token` from every JSON body while the endpoint's `Set-Cookie` headers pass through untouched; `customSession` does the same for `get-session`. Integration tests assert that no auth response contains a session token or password hash. If a future feature ever needs bearer tokens (e.g. a mobile client), this hook is the one place to revisit.

Re-checked against Better Auth 1.7.7 in Phase 3 step 12, over HTTP against a production build (`e2e/account-email.e2e.ts`). Sign-up and sign-in bodies have the user and no `token`. `get-session` has no session token. `request-password-reset` returns `{ status, message }`, `reset-password` `{ status: true }`, `send-verification-email` `{ status: true }` and `verify-email` `{ status: true, user: null }`. Reset and verification set no cookie. No body contains the session cookie's value. The HttpOnly cookie is the only session credential.

**Logging.** Lexora's code logs only causes, never values (the saved-language endpoints, email delivery and verification failures). Better Auth logs warnings and errors only, without tokens. Next.js request logs contain paths but no bodies or cookies; Postgres statement logging is off. Email tokens travel in URL fragments, so request logs and `Referer` never see them. Tests capture the console through whole verification and reset flows and assert that no token or password appears. Known limit: when a database query fails, Drizzle's error, which Next.js logs, includes the query's parameters (for example an email address). Reset tokens can't appear there (stored hashed) and verification tokens aren't stored. Redacting query parameters belongs to the Phase 10 observability work.

**Known gaps** (tracked in ROADMAP open decisions): breached-password checking deliberately not enabled yet (Better Auth's `haveIBeenPwned` plugin can be added without architectural change — revisit before public launch); CSP deferred to Phase 10.

---

## 5. Target structure

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

- `learning/` (the scheduler and review status) is pure TypeScript: no UI, server, app or prototype imports.
- `language/` (the shared engine) imports no UI, server or app code. `language/index.ts` is server-only; client components import only the client-safe `language/examples` and types.
- Public routes (`app/(public)`) and public features (`discovery`, `finder`, `language`) never import `server`; public routes never import `demo`.

These rules are **enforced by ESLint** (`eslint.config.mjs` → boundaries): shared UI, `lib` and `demo` can't import server code or features; server code can't import UI; features can't import each other; the language engine stays independent; public discovery code can't import server code. Type-only imports are allowed.

---

## 6. Language data model (Phase 3, as built)

The goal is `idea → language → context → pattern → practice`, so the model is a **graph of meanings with context**, not a word list. Authoring rules, fields and validation are in [content/README.md](../content/README.md); the closed value sets are in `src/language/schema/vocabulary.ts` and are shared with the Postgres enums.

| Table                                          | Purpose                                                                                                                                                                     |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `language_items`                               | A retrievable unit: `kind` (word, phrase, collocation, preposition pattern, linker, sentence pattern, functional expression), headword, slug, status, provenance and review |
| `item_forms`, `item_slug_history`              | Every spelling and inflection search should recognise (British default, US variants); old slugs that redirect                                                               |
| `senses`                                       | One meaning of an item, and the unit that is searched, shown and saved: part of speech, definition, CEFR, registers, skills, IELTS relevance and tasks, strength, functions |
| `examples`                                     | Sentences in context with highlight spans, skill and IELTS task, optionally linked to a collocation or pattern                                                              |
| `collocations`, `preposition_patterns`         | Collocations of a sense; the preposition a base word takes, with its complement and the mistake it prevents                                                                 |
| `frames`                                       | Sentence patterns and verb frames as literal parts and typed slots with fillers (context-gap search)                                                                        |
| `mistakes`                                     | Errors learners really make, typed, with the correction and why                                                                                                             |
| `relations`                                    | Typed sense-to-sense edges with weight and note; the importer writes inverses                                                                                               |
| `linker_details`                               | What a linker connects, its positions and punctuation                                                                                                                       |
| `intents`, `intent_triggers`, `intent_entries` | Expression intents ("express contrast"): trigger phrasings and the senses that answer them, grouped and in authored order                                                   |
| `content_sources`, `content_releases`          | Provenance and licences; one record per import (git commit, checksum, counts)                                                                                               |

IDs are authored and permanent; published content is retired, never deleted (decision #40).

**Practice (Phase 5, Step 3):** examples carry optional authored `practice` data — `practice_accept`, `practice_accept_preposition` and `practice_exclude` (arrays, empty by default; migration 0007) — for review exercises; search never reads them.

**Topics (Phase 4, Step 2):** `senses.topics`, an array of the `topic` enum (10 values, `TOPICS` in the vocabulary): 1–3 distinct values per sense, or none for general language. Validated in content; the database checks the limit of three (`senses_topics_max`). Not yet used by search. **User data (Phase 5 onward):** see §4.5.

**Content pipeline:** `content/*.yaml` → Zod and cross-file validation (`pnpm content:check`, in CI) → `pnpm content:import` into PostgreSQL in one transaction. The app never reads YAML at runtime. External lexical sources may only inform the choice of items, after a recorded licence check.

---

## 7. Search (Phase 3, as built)

`LanguageSearchService` (`src/language/search/service.ts`) over a `LanguageSearchRepository` (PostgreSQL in `src/server/repositories/language`, in memory for tests). Deterministic: no AI, embeddings or learned ranking. The full behaviour is documented in the [Phase 4 specification, §3](specs/phase-4-search-depth.md).

1. **Normalise** (`normaliseQuery`, shared with the importer): NFKC, lower case, straight apostrophes, gap markers → `___`, at most 200 characters.
2. **Classify** (`classify.ts`): a gap → context gap; otherwise ordered rules, first match wins (preposition, stronger/weaker, alternative, synonym, collocation, linker, sentence pattern, phrase, "I want to …"); qualifier words become modifiers (writing, speaking, formal, academic, informal, natural); no match → lookup.
3. **Resolve the term:** exact form → spelling variant (with a note) → one clear typo correction (trigram candidates, 1–2 edits by length); never silent, ties become "Did you mean".
4. **Retrieve by intent** through small, indexed repository lookups: relations, preposition patterns, collocations, expression intents, verb frames for context gaps; the lookup cascade ends in a labelled full-text fallback.
5. **Rank** (`rank.ts`): a fixed tuple — match tier, editorial weight, modifier fit, IELTS relevance, relation priority, authored position, A–Z.
6. **Shape:** an interpretation line, groups, a fit guide, mistakes, and a reason for every result.

Correctness is pinned by the golden search suite (`test/search-golden.yaml`, run in memory and against PostgreSQL). Search runs on the server when `/explore?q=` or `/finder?q=` renders; there is no search API. Search text never reaches analytics (decision #59).

**Filters and browse (Phase 4, Step 3a — engine only; the UI is Step 3b).** `src/language/filters.ts` is the one contract, shared by server and browser: four dimensions — kind (item), discourse function, IELTS use (`writing`/`speaking` match the skills, `writing-2` etc. a task the sense is used in) and topic (general language with no topics never matches) — one value each, combined with AND, validated by `searchFiltersSchema`.

- `search(query, filters?)`: without filters, the engine's answer exactly. With filters, the same answer restricted on the server to results (and fit-guide rows and mistakes) whose sense matches; the reading, groups, order and verdicts are unchanged, and `filters: { applied, before, after }` says how many were hidden. One extra query (`senseFacets`) per filtered search.
- `browse(filters, page)`: filters in SQL (`browseSenses`: `WHERE` on the enum columns and arrays, ordered by IELTS relevance, normalised headword `collate "C"`, sense position; 30 per page) plus per-value counts with the other filters applied (`filterCounts`, one statement). No index: at this size the planner's existing index scans take well under a millisecond.
- URL contract: `q, kind, function, use, topic, page` in that order, kinds kebab-case, one value per dimension (first valid wins), `page` only when browsing and never `1`; `parseFinderParams`, `finderHref` and `isCanonicalFinderParams` give pages what they need to redirect anything else (wired in Step 3b).

**Gap reader (Phase 4, Step 4.1).** Before normalising, `planGaps` (`search/gap/reader.ts`) decides from the raw query whether it asks for a word in a gap: underscores always mark a blank; an ellipsis does only between words (and only when a verb frame answers it); at most two blanks. Anything else is an ordinary search on the text without its markers, so "however..." finds _however_. Gap answers report their blanks in `gaps`; the Phase 3 verb-frame path is unchanged. Step 4.2 adds candidates from authored structures for blanks no verb frame answers: preposition patterns, collocations and linkers (`search/gap/candidates.ts`, three bounded reads), one blank at a time, each with its sense and evidence id (`gapMatch`). Step 4.3 adds a categorical verdict to every gap candidate, verb frames included (`gapMatch.verdict`: fits, likely fits, depends, unlikely, not supported, with evidence codes in `signals`; `search/gap/verdicts.ts`), computed from rows already read before filters apply; authored mistakes recreated by the filled-in words make a candidate unlikely. Step 4.4 reads more of the same evidence and removes false fits: never the learner's own neighbouring word as a collocation fill; the preposition after an inflected multiword base ("poses a threat ___") and after a verb frame's object ("allocated money ___", frames read only then); collocations anchored by any of their content words; first words the content's item forms inflect ("took" / "take") count as written. Step 4.5 lets one authored structure fill both blanks — a verb frame, or a preposition pattern on a phrase, read with `findPairPatterns` — with one shared verdict and `gapMatch.gaps: [0, 1]`; independent candidates are never combined. A form of _be_ or _have_ before a collocation, or a content word after it, leaves that side unchecked, and "It is ___ that" is answered only as _Likely fits_. The final-audit closure fixes add R-3: a collocation's authored `pattern` says what follows it, and when the learner's next word is a different function word the verdict is at most _Likely fits_ (it only lowers). In the context tool, a verb-frame group's heading is the engine's label only when every row in it fits. See [phase-4-step-4-context-gaps.md](specs/phase-4-step-4-context-gaps.md) and [phase-4-step-4-context-coverage.md](specs/phase-4-step-4-context-coverage.md).

**Deferred from Phase 4 (never built):** privacy-first unmatched-query feedback, latency measured on a deployment, search rate limiting and the sentence-level check (ROADMAP → Phase 4 → _Deferred from Phase 4_). The filter and browse UI and the context-gap analysis above were built. Phase 5 Step 0 added two narrow search fixes: a query that is exactly an authored intent trigger ("express contrast") is answered as that intent, as "I want to …" is (`hasIntentTrigger`, after exact forms, phrases and mistakes, before typo correction); and an extra-words mistake ("such as for example Japan") is shown only when the query includes a word next to the extra words, so "for example" alone isn't a mistake (`showsMistake`). The golden suite and ranking snapshot are unchanged; the cases are pinned in `test/step-0-cases.ts`.

---

## 8. Intelligence layer

_Target._ Interfaces in `domain/intelligence`, each with a deterministic implementation that ships first. Today the deterministic search is `LanguageSearchService` in `src/language` (§7); the interfaces below are introduced when a second implementation (Phase 9) needs them.

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

## 9. Learning engine (Phase 5–6)

_As built in Phase 5 ([Retrieval Loop specification](specs/phase-5-retrieval-loop.md)); it supersedes the notes below where they differ:_

- **Scheduler** (`src/learning/scheduler.ts`, pure, lint-isolated): five Leitner boxes. Box 0 is new and due when saved; a correct answer moves up one box (at most 5) and a wrong one goes back to box 1. The next review is the answer time plus 1, 3, 7, 14 or 30 days, as fixed 24-hour multiples. `now` is always passed in. Statuses (new, due, learning, known, retired, no exercise yet) are derived in `src/learning/status.ts`, never stored. FSRS and SM-2 were considered and not chosen (D1).
- **Cards** (`review_cards`): one per saved sense, created with the save in one transaction and deleted with it (composite FK, cascade). Saves made before Phase 5 have no card: reads left-join and treat them as new, due since saved, and the first answer creates the card. Nothing is backfilled.
- **Answers** (`review_log`): `recordAnswer` (`src/server/learning/review.ts`) locks the card, then records an answer only for review number `reviews + 1`, backed by `unique (card_id, review_number)`. A retry returns the stored answer; anything else for a used number is stale; answers before the due time are refused. The log outlives the card.
- **Exercises** (`src/learning/exercises.ts`, `answers.ts`, pure): generated at request time from authored content. Three types:
  - complete the sentence: the item's own form blanked in an example;
  - type the preposition: an example's pattern preposition blanked;
  - which is correct: an authored mistake's two versions.

  IDs are stable (`term:` or `preposition:<example id>`, `mistake:<mistake id>`). A sense's exercises take the types in turn, and the card's `reviews` picks the next one and the option order. There's no randomness. Each exercise has a client-safe prompt and a server-only key.

  An answer is correct only as the expected answer, another authored form of the item, or an authored `practice.accept` value. Normalisation covers only case, apostrophes, spaces and end punctuation: no fuzzy matching, stemming or synonyms. Material comes from the content rows (`src/server/content/practice.ts`) or PostgreSQL (`loadPracticeMaterial`, four statements), which are asserted equal. Generating never touches cards, logs or schedules.

- **Bank** (`/bank`; `src/server/learning/bank.ts`, `listBank` / `bankCounts` in `review-cards.ts`):
  - saved senses left-joined to their cards (a save without one reads as new), ordered in SQL as §14 and §17 describe;
  - statuses from `reviewStatus`, next reviews from `nextReview`; whether a sense has an exercise comes from its practice material. Since Phase 7.2 both come from each row's learning state instead (§9.1);
  - one statement for the counts, one for a page of 50 rows, four for the page's practice material;
  - removing goes through the existing save flow; nothing in the bank schedules or writes;
  - _Start review_ (with the number ready) links to `/practice` when something is due or new.
- **Review session** (`/practice`; `loadReviewSession` / `answerReview` in `src/server/learning/review.ts`, `reviewQueue` in `review-cards.ts`):
  - a session is up to five due senses that have an exercise, in §14 order (reviewed and due by due time, then new by save time, ties by sense ID), from one ten-row read plus four statements of practice material. Reading creates no card; the first answer does. Since Phase 7.3 the order within the due senses is practice selection's (§9.1);
  - the browser gets prompts only: no keys, no card ids, and no headword on a typed exercise, where it would be the answer. Sense and exercise ids are authored ids, so they do name the item;
  - `POST /api/review/answers` (route handler, D21): same origin → session → `review_answer` limit (30 a minute) → a strict Zod body of `senseId`, `exerciseId`, `expectedReviews` and `answer` (≤ 2 KB) → `answerReview`. Inside `recordAnswer`'s transaction, with the card locked, the exercise is regenerated for `expectedReviews` and the answer checked (`exercise_changed` and `invalid_answer` record nothing), then scheduled and logged once. Responses: 200 (with `duplicate: true` for a retry), 400, 401, 403, 404 `not_saved`, 409 `retired` / `stale` / `not_due` / `exercise_changed`, 429, 503;
  - feedback is built from the recorded answer and authored content only (the matched mistake's explanation, the pattern's note, or the sense's best-when); the UI never decides correctness;
  - `json`, `guarded` and `unauthenticated` now live in `src/server/http/responses.ts`, shared by both handlers. The demo session (`src/demo/practice.ts`, `?step=`) is gone (D19).
- **Mistake evidence** (`recurringMistakes` in `review-cards.ts`, `src/server/learning/evidence.ts`): no table (D14). One bounded query over `review_log`: the same wrong response (the matched authored mistake, otherwise the exact normalised typed answer) on one sense at least twice in the 30 days before `now`, unless the sense's two latest answers are correct and after it. Shown in the answer's feedback and as `MistakeRow`s in bank rows, with authored text read from content; "Missed n times" comes from the card's `lapses`. It never changes scheduling.
- **Home** (`/home`; `loadHome` in `src/server/learning/home.ts`): no sample data (D15). The bank's counts, the soonest upcoming review, the four latest saves (`recentlySaved`) and the learner's recurring mistakes (`recurringMistakes` over all senses) in parallel, then the practice material and slugs of the senses they name. "Ready" is due plus new, as the bank counts it. An empty bank shows a first-use panel, not zeros; a failed read shows an error, never stand-in data. `src/demo/` and its lint rules are gone, and Progress has left the sidebar and command palette (`HIDDEN_NAV`, D20) while `/progress` stays an honest placeholder.
- **Save copy** (Step 8): `PUT /api/bank/saved/[senseId]` answers `review: "ready"` when the card is due now, otherwise `"scheduled"`. The shared save notice says "It's ready to review." only on `"ready"` and links to the bank; the removal notice says the review history is kept. The save gate and the landing promise only a bank and review when it's due.
- **Release:** the [final audit](specs/phase-5-final-audit.md) and the [production runbook](specs/phase-5-release-runbook.md) (Step 9). Migrations 0005–0007 and the content import run on Neon before the merge into `main` deploys.

- **Mastery** is derived from review history (recall success over spaced intervals), never from views.
- **Scheduler (earlier note):** FSRS (`ts-fsrs`) was the leading option over SM-2. Either way it's a pure function: `(card state, rating, now) → next state`.
- **Practice generation** is deterministic from language data: fill-in-the-blank from examples (their `highlight` spans), multiple choice from relations (distractors drawn from same-category items and known mistakes' `wrong` forms), preposition drills from `preposition_patterns`, and so on.

### 9.1 Learning state (Phase 7.1, Learning Intelligence)

_As built._ A learner's state for one saved sense: its stage, whether it's due, what their recorded answers show, and why, in observed facts. It's the foundation later Phase 7 work reads; nothing displays it yet. Derived, never stored, and with no schema change.

- **Sources** (no new table, nothing duplicated):
  - `saved_senses`: only saved senses have a learning state;
  - `review_cards`: the stage and the due time, exactly as the scheduler leaves them;
  - `review_log`: the evidence. That's every recorded answer on the sense, including answers from before it was removed and saved again (spec §9.4: history still counts as evidence).
- **Rules** (`src/learning/state.ts`, pure):
  - **stage**, by `learningStage`, which `reviewStatus` now also uses, so the bank and the learning state can't disagree:
    - `new` until the card's first answer;
    - `known` in box 4–5, which the scheduler reaches only after at least three right answers in a row (four from new);
    - `learning` otherwise. Any wrong answer goes back to box 1, so it's `learning`.
  - **due**: `due_at ≤ now`, and never for a retired sense, matching the review queue.
  - **evidence**: attempts, correct, incorrect, the last answer's time, and the latest outcome with how many answers in a row had it. `evidenceFrom` is the reference rule.
  - **reason**, in priority order, with its wording in `learningReasonText`:
    1. `not_practised`: "Not practised yet.";
    2. `saved_again`: the new card has no answers but earlier ones exist;
    3. `missed`: "Missed last time." or "Missed the last n times.";
    4. `correct`: "Answered correctly the last n times.".

  Reasons describe answers and never judge the learner or name boxes.

- **Read:** `learningEvidence` in `review-cards.ts` takes given senses or all saved ones. It's one statement: a window over the learner's log rows, aggregated per sense, so no answer rows leave the database. `loadLearningStates` and `loadLearningState` in `src/server/learning/state.ts` apply the rules at `now`. Measured on a local database with 486k logged answers (no new index; the existing user/sense indexes are used):
  - a page of 50 senses: about 2 ms of execution;
  - a 500-sense bank with 6,000 answers: about 22 ms.
- **Practice and Review:** a recorded answer (`recordAnswer`) is the only evidence. Learning state reads the log and the card; it never schedules or writes, and the scheduler is unchanged. Tests assert the SQL evidence equals `evidenceFrom` over the log, the card's `reviews`/`lapses`, and that stage and due agree with `bankCounts` and `reviewQueue`.
- **Privacy:**
  - Learning state is server-only (`import "server-only"`).
  - Every read is scoped by the user ID the caller takes from the session.
  - It's exposed through no route or endpoint, and public routes and features can't import it (§4.2).
- **Not in Phase 7.1:**
  - any UI (Home, Bank and Practice are unchanged);
  - recommendations;
  - an HTTP endpoint;
  - evidence for senses that aren't saved;
  - stored scores or streaks.
- **Language bank (Phase 7.2):** the first consumer. `loadBankPage` keeps the bank's order and its pages of 50, and computes no learning state of its own.
  - **Reads:**
    1. the counts (one statement, now with each filter's count);
    2. one page from `listBank`;
    3. then, in parallel and for that page's sense IDs only: `loadLearningStates`, the practice material and the recurring mistakes.

    That's 8 statements whatever the page's size, filter or number. There's never a read per row, and normal rendering never reads the whole bank.

  - **Rows:** stage, due, next review and reason are the learning state's. Status is `statusOf` over the state's stage and due: the same order `reviewStatus` applies to a card. "Missed n times" still reads the card's stored `lapses` (Phase 5 spec §16).
  - **Filters** (`?show=new|learning|known|due`): `bankFilterTerm` is their SQL form, so a page is filtered before it's read. Stages exclude retired senses. Due includes new saves, as the review queue does. Tests assert each filter selects exactly the senses whose learning state matches, at two times and across pages.
  - **Measured** locally with 727k logged answers, end to end:
    - a page of 1, 7 or 50 rows: about 17–25 ms median;
    - the learning-state read for 50 senses: about 6 ms;
    - an empty filter: one statement.

    No index was added.

- **Practice selection (Phase 7.3):** what a review session takes first, and why. Code: `rankPracticeCandidates` in `src/learning/selection.ts` (pure) and `selectPracticeCandidates(userId, now, limit)` in `src/server/learning/selection.ts`. It's called only by `loadReviewSession`; there's no endpoint.
  - **Candidates:** the learner's saved senses that Review can take now, which is Review's own due queue (`reviewQueue`, due and published, new saves included).
    - Senses that aren't due are never selected. Spec §14 has no early reviews, and an early answer is refused with `409 not_due`; the owner chose this on 26 October 2026 over "practise anyway" (unrecorded) and early review (rescheduled). So the brief's "learning" and "known reinforcement" priorities apply only to senses that are due.
    - Unsaved public content is never a candidate.
    - The pool is the 200 most due senses in Review's order; a larger backlog is reached as those are answered.
  - **Tiers:** each candidate is in exactly one, the first that applies, read from its learning state:
    1. `missed`: answered, and the latest answer was wrong. More misses in a row come first. Reason: the learning state's, "Missed the last 2 times.";
    2. `due`: answered, latest answer right. Learning before known. Reason: "Due for review.";
    3. `new`: no answer on this save. Reason: the learning state's, "Not practised yet." or "Saved again, so its reviews start over.".
  - **Order and overlap:** a sense appears once; "due + learning", "due + known", "missed + learning" and "new + due" each fall in one tier. Ties keep Review's order (most overdue first, then new by save time, then sense ID). There's no score and no randomness: the same data at the same `now` gives the same list.
  - **Reads:** two statements, the due queue and one `loadLearningStates` for the pool; an empty pool needs only the first. A session adds the practice material for the ten candidates it considers (four statements), so it's six statements in all.
    - Exercises still come from `exerciseFor` on the card's review count, and answers still go through `answerReview` and the unchanged scheduler.
    - Each session item carries its reason, shown as one caption under the exercise heading.
  - **Fallbacks:**
    - nothing saved: Practice's existing empty state;
    - nothing due: the existing "caught up" state with the next review;
    - no candidate with an exercise: the same, never invented content.
  - **Measured** locally (61.5k saves, 739k logged answers; no index added):
    - selection: about 10 ms median for 7 or 50 saves, and 22–24 ms for 500-save banks that are due-heavy or miss-heavy;
    - the two statements execute in about 2 ms and 7 ms;
    - a whole session read: 12–26 ms.
  - **No AI:** the tiers are three rules over recorded answers and the schedule, each one explained in words. A model would add nothing a learner could check.

## 10. Writing & Speaking labs (Phase 7–8)

- **Writing audit** is a rule pipeline over tokenised text: repetition (lemma frequency), preposition checks against `preposition_patterns`, collocation checks against `collocations`, linker variety, register mismatches. Each rule returns a `Finding { span, type, message, suggestions[] }`.
- **Speaking:** record with `MediaRecorder`, transcribe with the browser Web Speech API where available, and fall back to a typed or pasted transcript. The transcript then goes through the same `TextAnalyzer`.
  - Browser support varies, and some browsers (notably Chrome) process recognition on the vendor's servers rather than on the device. The UI must say so before the first use.
  - Lexora itself doesn't upload or store audio unless the user opts in.
  - Self-hosted or local STT (e.g. Whisper running locally) can later plug in behind the same interface.

---

## 11. Cross-cutting

- **Rendering:** Server Components by default. Use `"use client"` only for interactive leaves.
- **Mutations:** Server Actions with Zod-validated input, and authorisation checks in every action.
- **Next.js 16 specifics:** async request APIs (`await cookies()`, `await params`); `proxy.ts` replaces `middleware.ts`; Turbopack is the default bundler.
- **Env:** validated with Zod in `src/server/env.ts` (server-only). No secrets in client bundles. See §4.6.
- **Errors:** route-level `error.tsx` and `not-found.tsx`, plus typed result objects from actions. Avoid a shell-wide `loading.tsx`: a Suspense boundary above a page makes `notFound()` stream with status 200. Add Suspense boundaries inside pages that genuinely load data.
- **Performance:** fonts self-hosted, static rendering where possible, search run on the server per submitted query over indexed lookups (Phase 4 measures it against a latency budget before any caching).
- **Security:** auth on every server action and route handler, row ownership checks in repositories, rate limiting on auth (Better Auth, database-backed), on signed-in writes (`request_limits`) and on public search (Vercel Firewall), CSP in Phase 10.

---

## 12. Decision log

| #   | Date       | Decision                                                                                                                                                                                                                                                                                                                    | Rationale                                                                                                                                                                                         |
| --- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 2026-10-07 | Next.js 16 + TypeScript + Tailwind 4                                                                                                                                                                                                                                                                                        | Requested stack, current stable; RSC suits a data-heavy app                                                                                                                                       |
| 2   | 2026-10-07 | shadcn/ui on Radix (`radix-nova`)                                                                                                                                                                                                                                                                                           | Accessible primitives we own and restyle; Radix chosen over Base UI for maturity                                                                                                                  |
| 3   | 2026-10-07 | Tokens as CSS variables mapped via `@theme inline`; kept shadcn variable names                                                                                                                                                                                                                                              | Primitives work unmodified; one place to change values; dark mode becomes a value swap                                                                                                            |
| 4   | 2026-10-07 | Fonts: Inter / Newsreader / JetBrains Mono via `next/font`                                                                                                                                                                                                                                                                  | Editorial + interface voices; self-hosted (privacy, no layout shift)                                                                                                                              |
| 5   | 2026-10-07 | Light theme only for now                                                                                                                                                                                                                                                                                                    | Focus; token architecture keeps dark mode cheap later                                                                                                                                             |
| 6   | 2026-10-07 | Zod, DB, ORM, and tests not installed in Phase 0                                                                                                                                                                                                                                                                            | Nothing uses them yet; avoid unused dependencies                                                                                                                                                  |
| 7   | 2026-10-07 | `shadcn` package as a devDependency                                                                                                                                                                                                                                                                                         | Only its `tailwind.css` (custom variants, utilities) is consumed, at build time                                                                                                                   |
| 8   | 2026-10-07 | `suppressHydrationWarning` on `<html>` and `<body>` only                                                                                                                                                                                                                                                                    | Browser extensions inject attributes there; it doesn't affect children                                                                                                                            |
| 9   | 2026-10-07 | No AI dependency; intelligence behind interfaces                                                                                                                                                                                                                                                                            | Product requirement; AI optional in Phase 9                                                                                                                                                       |
| 10  | 2026-10-07 | Drizzle ORM for Postgres (confirmed in Phase 2)                                                                                                                                                                                                                                                                             | SQL-close, light, portable, no binary engine; good fit for FTS/trigram/pgvector                                                                                                                   |
| 11  | 2026-10-07 | Design language v0.2: serif reserved for language content; Inter 600 for all interface headings                                                                                                                                                                                                                             | Owner decision after reference study; serif becomes a reliable "this is English to study" signal                                                                                                  |
| 12  | 2026-10-07 | Radius scale 4/6/8/12/16; flat resting surfaces; control-height and section-rhythm tokens                                                                                                                                                                                                                                   | Translated from the reference's sober geometry, flat cards and two-density sizing                                                                                                                 |
| 13  | 2026-10-07 | Added shadcn `table` primitive                                                                                                                                                                                                                                                                                              | Needed for the language bank and mistakes views; restyled to the table spec                                                                                                                       |
| 14  | 2026-10-07 | App routes live in an `(app)` route group: `/home`, `/finder`, `/bank`, `/practice`, `/writing`, `/speaking`, `/progress`, `/settings`; `/` stays a public landing page                                                                                                                                                     | Short, stable URLs; one persistent shell layout; leaves room for `(marketing)` and `(auth)` groups in Phase 2                                                                                     |
| 15  | 2026-10-07 | Shell UI state (collapse, mobile sheet, palette) in a client context, not persisted                                                                                                                                                                                                                                         | Avoids cookie reads that would make every app page dynamic; persistence can come with user preferences in Phase 2                                                                                 |
| 16  | 2026-10-07 | Added shadcn `sheet` primitive                                                                                                                                                                                                                                                                                              | Mobile navigation drawer                                                                                                                                                                          |
| 17  | 2026-10-07 | Phase 1 demo content lives in `src/demo/`, imported only by UI code (features, shell, palette)                                                                                                                                                                                                                              | Keeps prototype data obviously separate from the Phase 3 curated dataset and domain model; easy to delete                                                                                         |
| 18  | 2026-10-07 | Saved items are an in-memory client context in the `(app)` layout, labelled "session only" wherever saving appears                                                                                                                                                                                                          | Believable cross-screen save state without fake persistence                                                                                                                                       |
| 19  | 2026-10-07 | `/language/[slug]` is statically generated with `dynamicParams = false`; Finder and Practice read `?q=` / `?step=` via `useSearchParams` inside `Suspense`                                                                                                                                                                  | Every route stays static; queries are shareable, and the browser back button works                                                                                                                |
| 20  | 2026-10-07 | Screen composition lives in `src/features/<screen>/`; reusable presentation stays in `components/lexora`                                                                                                                                                                                                                    | First use of the target feature structure; features don't import each other (enforced by ESLint since Phase 2)                                                                                    |
| 21  | 2026-10-07 | **Better Auth** for authentication, email + password first                                                                                                                                                                                                                                                                  | Owner decision. Self-hosted, Drizzle adapter, sessions in our database, built-in scrypt, rate limiting and origin checks; social providers are configuration                                      |
| 22  | 2026-10-07 | **PostgreSQL**: Docker locally, **Neon** on **Vercel** in production; postgres.js driver                                                                                                                                                                                                                                    | Owner decision. One driver for all environments; pooled URL at runtime, direct URL for migrations                                                                                                 |
| 23  | 2026-10-07 | Better Auth tables are generated by its CLI and owned by the library; product data lives in separate tables (`learner_profiles` …) referencing `users.id`                                                                                                                                                                   | Keeps auth replaceable and invisible; product schema never bends to the auth library                                                                                                              |
| 24  | 2026-10-07 | Plural, snake_case table names (`users`, `sessions` …)                                                                                                                                                                                                                                                                      | Avoids the reserved word `user`; conventional SQL                                                                                                                                                 |
| 25  | 2026-10-07 | Database-validated sessions (no cookie cache); session token hidden from JSON                                                                                                                                                                                                                                               | Immediate revocation and minimal client exposure, at the cost of one indexed query per request                                                                                                    |
| 26  | 2026-10-07 | Two-layer protection: cookie-presence proxy + `requireSession()` in layouts, pages, actions and route handlers                                                                                                                                                                                                              | Fast redirects without trusting the proxy for authorisation (Next.js guidance)                                                                                                                    |
| 27  | 2026-10-07 | Database-backed rate limiting                                                                                                                                                                                                                                                                                               | In-memory limits don't work across serverless instances                                                                                                                                           |
| 28  | 2026-10-07 | No seed data                                                                                                                                                                                                                                                                                                                | Real sign-up creates users; prototype language content stays in `src/demo` until the Phase 3 content pipeline                                                                                     |
| 29  | 2026-10-07 | Vitest for unit and Postgres integration tests; CI runs migrations on a fresh database and detects schema drift                                                                                                                                                                                                             | Proves migrations and auth work from zero on every change                                                                                                                                         |
| 30  | 2026-10-07 | ESLint `no-restricted-imports` enforces the layer boundaries                                                                                                                                                                                                                                                                | Turns the documented dependency rules into checks                                                                                                                                                 |
| 31  | 2026-10-07 | Phase 2.1: discovery is public — `/`, `/explore`, `/language/[slug]` in a `(public)` route group; personal learning stays behind auth                                                                                                                                                                                       | Owner decision: demonstrate value before asking for commitment                                                                                                                                    |
| 32  | 2026-10-07 | Public pages don't read the session on the server; account-aware UI resolves in the browser                                                                                                                                                                                                                                 | Keeps public pages static, cacheable and free of user data. Cost: signed-in learners see the public frame on language pages, with a brief header swap                                             |
| 33  | 2026-10-07 | Shared language engine `src/language`: `LanguageRepository` + `LanguageSearchService`, `PrototypeLanguageRepository` over `src/demo`; search runs on the server                                                                                                                                                             | One boundary for public and personal pages; Phase 3 swaps the repository, Phase 4 the search, without touching pages. Keeps the dataset out of client bundles                                     |
| 34  | 2026-10-07 | Deterministic search rules (exact term → example-search keyword → contained term) and a visible "Matched on …" line                                                                                                                                                                                                         | Honest about how results are found; no AI, embeddings or vector search                                                                                                                            |
| 35  | 2026-10-07 | Saving is a route handler (`PUT`/`DELETE /api/bank/items/[slug]`), not a server action; it stores nothing until Phase 5                                                                                                                                                                                                     | Public pages never import authenticated code; the server is the single authority (401 → save gate). Supersedes #18's client-only save                                                             |
| 36  | 2026-10-07 | Save gate returns to the current page and completes the started save (`sessionStorage`, 30 min)                                                                                                                                                                                                                             | The visitor's intent survives account creation                                                                                                                                                    |
| 37  | 2026-10-07 | HTTP end-to-end route tests (`pnpm test:e2e`, Vitest + `fetch`) against a production build in CI                                                                                                                                                                                                                            | Verifies the real route boundary (proxy, layouts, status codes, metadata) without adding a browser test framework                                                                                 |
| 38  | 2026-10-07 | Phase 3 content model: authored YAML in `content/` (one file per item) validated by Zod, closed vocabularies in `src/language/schema/vocabulary.ts` shared with the Postgres enums                                                                                                                                          | One list per concept, so content, database and search can't drift. Reviewers read an item as one unit                                                                                             |
| 39  | 2026-10-07 | Dev dependency `yaml` (YAML 1.2 parser) for content files                                                                                                                                                                                                                                                                   | Parse errors and validation messages carry line numbers. Content is never parsed at runtime; the database is the runtime source                                                                   |
| 40  | 2026-10-07 | Authored text IDs (`significant.notable`) are the database keys; items and senses are retired, never deleted; `pg_trgm` enabled                                                                                                                                                                                             | Re-imports never change IDs, so saved language and future progress keep their references. Trigram indexes power cautious typo tolerance                                                           |
| 41  | 2026-10-07 | Saves are persisted per **sense** (`saved_senses`: user, sense, saved at), referencing senses with `ON DELETE RESTRICT`; no Language Bank screen until Phase 5                                                                                                                                                              | Owner decision 1: learners save the meaning they need. Restrict makes the database itself refuse to break a save                                                                                  |
| 42  | 2026-10-08 | Phase 3 step 9: Explore, the Finder, the landing page and the command palette's searches use `LanguageSearchService` over `DatabaseLanguageRepository`; `src/language/index.ts` is the only language module allowed to import the repository and DB client                                                                  | One engine and one data source. The UI renders the engine's interpretation, groups, reasons, fit guide and mistakes and computes none of them                                                     |
| 43  | 2026-10-08 | The landing page is static and revalidated hourly; search pages are dynamic and searched on the server per `?q=`                                                                                                                                                                                                            | Content changes only with an import; no dataset or ranking in the browser                                                                                                                         |
| 44  | 2026-10-08 | Language pages, the sitemap and command-palette items keep the Phase 1 sample items until step 10; saving checks the slug against published content                                                                                                                                                                         | Step-by-step switch-over; saving works for every real result in the meantime                                                                                                                      |
| 45  | 2026-10-08 | Phase 3 step 10: `/language/[slug]` renders `DatabaseLanguageRepository.getItemBySlug()` — prerendered from the published slugs, revalidated hourly, `dynamicParams = true`; 308 for old or retired slugs, 404 for drafts and unknown slugs. Supersedes #19's `dynamicParams = false`                                       | A published item is never a 404, even one published after the last build; no stale sample snapshot                                                                                                |
| 46  | 2026-10-08 | Language pages render each sense with its own glance, patterns, collocations, examples, mistakes and relations; related links and sense-specific search results open the page at that sense (`#sense-<key>`). The Phase 1 sample items and `PrototypeLanguageRepository` are removed. Supersedes #33's prototype repository | Meaning-first: a relation is shown with the meaning it belongs to, never as a property of the whole word                                                                                          |
| 47  | 2026-10-08 | Phase 3 step 11: persistent sense-level saving — `GET /api/bank/saved?senses=` (bounded batch) and `PUT`/`DELETE /api/bank/saved/[senseId]` over the existing `saved_senses` table; the item-level `/api/bank/items/[slug]` and the in-memory saved set are removed. Supersedes #18 and #35                                 | PostgreSQL is the only store of saved state; a meaning is saved, never a whole word. No migration was needed: the table was already sense-level and empty                                         |
| 48  | 2026-10-08 | A save made before its sense is retired is kept (the importer never deletes senses, and `ON DELETE RESTRICT` protects it) and can still be removed; a retired sense can't be saved anew                                                                                                                                     | Learner data is never lost or corrupted by content lifecycle changes; the Language Bank (Phase 5) decides how to show retired saves                                                               |
| 49  | 2026-10-08 | Phase 3 step 12: email verification and password reset are Better Auth's flows; Resend is only the delivery provider, behind `EmailSender` (`resend` / `outbox`), called through Resend's HTTP API with `fetch`, so no SDK dependency                                                                                       | One token system (Better Auth's); the provider can be swapped; nothing to install                                                                                                                 |
| 50  | 2026-10-08 | The `outbox` transport writes email to a local folder: the default outside production and in CI, refused for a deployed (non-localhost) production URL; production fails at start-up without `RESEND_API_KEY` and `EMAIL_FROM`                                                                                              | CI follows real links without sending email; a misconfigured deploy fails loudly instead of losing mail                                                                                           |
| 51  | 2026-10-08 | Email tokens travel in the link's URL fragment; verification goes through a server action and reset through a POST body                                                                                                                                                                                                     | Fragments never reach servers, request logs or `Referer`; the verification JWT contains the address                                                                                               |
| 52  | 2026-10-08 | Verification never gates (`requireEmailVerification: false`) and never signs in (`autoSignInAfterVerification: false`); links last 24 hours; a reminder on `/home` and a resend button in Settings                                                                                                                          | Phase 3 decision 3                                                                                                                                                                                |
| 53  | 2026-10-08 | Reset tokens stored hashed (`verification.storeIdentifier: "hashed"`), valid 1 hour, single use; a reset revokes every session; reset emails sent after the response (`backgroundTasks` → `after()`)                                                                                                                        | A database leak yields no usable link; a pre-reset session never survives; no timing signal for account enumeration                                                                               |
| 54  | 2026-10-08 | Two `hooks.before` checks: the cookie-less reset endpoints require the app origin, and `send-verification-email` requires a session                                                                                                                                                                                         | Better Auth checks `Origin` only when a cookie is sent; without these, any site could make its visitors request reset emails around the per-IP limit, and anyone could mail an unverified address |
| 55  | 2026-10-08 | Phase 3 step 13: overlays restore focus to their opener in the shared `DialogContent`/`SheetContent` (`ui/use-return-focus`); compact buttons get a coarse-pointer hit area in `ui/button`; failed submits focus the first invalid field (`focusFirstInvalid`)                                                              | Fix once in shared primitives rather than per page; Radix restores focus only to its own `Trigger`, which Lexora's state-opened overlays don't use                                                |
| 56  | 2026-10-08 | _Back to search_ returns to the last results page, remembered per tab in `sessionStorage` (`lib/last-search`)                                                                                                                                                                                                               | `document.referrer` doesn't change on client-side navigation; a per-tab convenience, not learner data, and harmless when storage is unavailable                                                   |
| 57  | 2026-10-08 | `e2e/accessibility.e2e.ts` checks the HTML of every public and personal page (one h1, named controls, labelled fields, unique ids, labelled landmarks); layout overflow, focus visibility and keyboard behaviour are verified in the browser at each release step                                                           | Catches structural regressions in CI without adding a browser test framework (decision 37)                                                                                                        |
| 58  | 2026-10-10 | Dependency `@vercel/analytics` (Vercel Web Analytics) for aggregate page-view and traffic insight; mounted only through `components/site/analytics.tsx`, never directly                                                                                                                                                     | First-party to the existing host, cookieless, aggregate: no user identifiers or profiles; not AI. Trade-off: one more script, and the counts live with Vercel                                     |
| 59  | 2026-10-10 | Every analytics event passes `beforeSend` → `sanitizeAnalyticsEvent` (`lib/analytics-privacy`): only allowlisted parameters with fixed values survive (`reason`, `step`); `q`, `next` and any new parameter are dropped; the fragment is always dropped                                                                     | Learner search text is private input, and reset and verification tokens sit in the fragment: sanitise the payload, don't rely on aggregation. Pages are counted, searches never                   |
| 60  | 2026-10-17 | Preview isolation: own Neon branch, own `BETTER_AUTH_SECRET`, Neon integration on Production only. On Preview the app URL comes from Vercel's `VERCEL_BRANCH_URL`/`VERCEL_URL` (`app-url.ts`) and both are trusted origins; elsewhere `BETTER_AUTH_URL`. No Better Auth Infrastructure                                      | Previews must never touch production data or auth, and each preview has its own address. The URL comes from Vercel's configuration, never a request; production never takes the preview path      |
| 61  | 2026-10-17 | Phase 4 (Search Depth) specification approved: `docs/specs/phase-4-search-depth.md`, with the unmatched-query privacy model, browse/filter and indexing model, topics, Wave 2 pace, deferred caching, Firewall rate limiting (to verify), golden suite first, gap scope and step order                                      | One reviewed reference for the phase. Each decision gets its own entry when its step lands; decisions marked proposed are confirmed at their step                                                 |
| 62  | 2026-10-17 | Topics are a closed enum (`topic`, 10 values) stored as `senses.topics topic[]` (default empty, at most three by check constraint); YAML `topics` is optional, 1–3, distinct                                                                                                                                                | Phase 4 D4: topics belong to a meaning and cross topics; an enum array matches `functions` and needs no join                                                                                      |
| 63  | 2026-10-17 | Discourse functions gain comparison, decrease, opinion and hedging (`ALTER TYPE … ADD VALUE`)                                                                                                                                                                                                                               | Owner decision D11 (17 October 2026): Task 1 trends and comparison, Task 2 stance                                                                                                                 |
| 64  | 2026-10-17 | Search filters restrict the engine's answer on the server (`senseFacets`) instead of entering its lookups; browse filters, orders, pages and counts in SQL; one client-safe contract (`language/filters.ts`) for values, matching and the canonical URL                                                                     | Spec §5.2 and owner decision (Step 3a): a filter must never change how a query is read or ranked; filtering inside lookups would                                                                  |
| 65  | 2026-10-17 | Feature PRs (`feat`/`fix`/`docs`/`chore` → `phase/*`) merge by CI once the full suite passes on their latest commit; drafts wait. Vercel deploys `main` only (`vercel.json`: `"**": false`, `"main": true`)                                                                                                                 | Owner request: the label-gated merge never ran (every feature PR was merged by hand) and branch previews aren't wanted. `main` still needs the owner's label                                      |
| 66  | 2026-10-17 | Step 3b: Explore and the Finder parse the URL with `parseFinderParams` and redirect non-canonical URLs with 307 before rendering; filters are native selects in a GET form; browse renders `LanguageRow`s; filter labels live once in `language/filter-labels`                                                              | Spec §5 and §13 (D2, D3): one URL per state, a no-JS fallback, no chip row; D13 left unchanged                                                                                                    |
| 67  | 2026-10-18 | Step 4.1: a pure gap reader runs on the raw query before normalising: underscores are blanks, an ellipsis only between words and only with a verb frame, at most two; otherwise ordinary search (`gapNote` when there were more than two)                                                                                   | CG-D5 and CG-D6 with the owner's Step 4.1 rules: never invent a gap reading; "however..." returned nothing before                                                                                 |
| 68  | 2026-10-18 | Step 4.2: context-gap candidates come only from authored preposition patterns, collocations and linker details, matched per blank in pure code after three bounded reads; verb frames first and unchanged; no verdicts or scores                                                                                            | CG-D3, CG-D7, CG-D9 with the owner's Step 4.2 scope: never invent a candidate the data doesn't hold                                                                                               |
| 69  | 2026-10-18 | Step 4.3: five categorical context-fit verdicts with evidence codes, by a fixed precedence (authored mistake > unsupported > fits > likely fits > depends); verb frames keep their Phase 3 `fit`; no scores                                                                                                                 | Owner's Step 4.3 verdict model (amends CG-D8): explainable from authored evidence, never a grammar check                                                                                          |
| 70  | 2026-10-18 | Step 4.4: context coverage from existing evidence — collocation guards (no repeat of the learner's word, base words only from item forms, an unchecked side → likely fits), bare forms for multiword bases, frame prepositions after an object, any-content-word anchor, authored first-word inflections                    | Audit found false Fits; widens reach without new content, schema, verdicts or scores (docs/specs/phase-4-step-4-context-coverage.md)                                                              |
| 71  | 2026-10-19 | Step 4.5: one authored structure (a verb frame, or a preposition pattern on a phrase) may fill both blanks with one shared verdict; be/have before or a content word after a collocation leaves that side unchecked; "It is ___ that" only as likely fits                                                                   | Owner-approved Step 4.5 audit (G5-D1–D9); lowers or hedges, never raises a verdict (docs/specs/phase-4-step-4-5-context-gap-extensions.md)                                                        |
| 72  | 2026-10-21 | Phase 4 closure: R-3 — a collocation's authored `pattern` continuation is checked; a different function word after it caps the verdict at likely fits. The context tool relabels a verb-frame group unless every row fits. Phase 4 re-scoped (ROADMAP)                                                                      | Final audit FP-1 and UI-1 (docs/specs/phase-4-final-audit.md §19): authored evidence first; lowers only; the engine's labels are unchanged                                                        |
| 73  | 2026-10-22 | Local-database guard (`scripts/database-target.ts`) in drizzle-kit, `content:import`, the tests and the E2E teardown: local hosts only; a remote run needs `LEXORA_ALLOW_REMOTE_DB=<exact host>` in the shell, read before env files load; `CI` grants nothing                                                              | `.env.local` once held a Neon URL that a migration and two test runs reached. Refusing before connecting prevents that; naming the host keeps the override deliberate                             |
| 74  | 2026-10-22 | Per-learner write limits in PostgreSQL (`request_limits`, migration 0005): a fixed one-minute window, one atomic upsert per request, counted after authentication and validation; saves and removals 60/min, review answers 30/min (Step 5)                                                                                 | Phase 5 D17. Works across serverless instances, needs no new service and is testable in CI; one row per learner per action                                                                        |
| 75  | 2026-10-22 | Public search rate limit: a Vercel Firewall rule, 120/min/IP on `/explore` and `/finder` with `q`, set in the Vercel project rather than the repository                                                                                                                                                                     | Phase 5 D17. `vercel.json`'s `mitigate` supports only deny and challenge; the README has the dashboard, CLI and verification steps                                                                |
| 76  | 2026-10-22 | Search: an exact authored intent trigger is answered as its intent; an extra-words mistake is shown only with a neighbouring word                                                                                                                                                                                           | Phase 5 Step 0 fixes for “express contrast” and “for example”, with every golden case and the ranking snapshot unchanged                                                                          |
| 77  | 2026-10-22 | Review scheduler: five Leitner boxes as a pure module (`src/learning`), box 0 for new cards due when saved, intervals of 1/3/7/14/30 days as fixed 24-hour multiples from the answer time; statuses derived, never stored                                                                                                   | Phase 5 D1–D4, confirmed by the owner over a box-1 start. Explainable, auditable, testable with a fixed clock, and free of timezone arithmetic                                                    |
| 78  | 2026-10-22 | `review_cards` cascade with `saved_senses` (composite FK); the card is created with the save in one transaction; saves without a card read as new, with no backfill                                                                                                                                                         | Phase 5 §9.4. One owner of what a learner saved; old saves need no data migration, and the migrate-then-deploy gap is safe                                                                        |
| 79  | 2026-10-22 | Once-only answers: `unique (card_id, review_number)` under a row lock, keyed by the card's `reviews` when the exercise was shown; no client-generated submission id                                                                                                                                                         | Phase 5 D11, confirmed by the owner. A retry or second tab can't schedule twice, and the stored answer is returned to it                                                                          |
| 80  | 2026-10-22 | Review exercises are generated at request time by a pure function from authored rows (not stored), with stable IDs from authored IDs and a fixed order (types in turn; the card's `reviews` picks the next)                                                                                                                 | Phase 5 D9–D10. One source of truth, no drift, no randomness; the same material is asserted equal from YAML and PostgreSQL                                                                        |
| 81  | 2026-10-22 | Answers accept only the expected form, the item's other authored forms and authored `practice.accept` lists on examples; relations never imply acceptance; normalisation is case, apostrophes, spaces and end punctuation only                                                                                              | Phase 5 D5, D8. Correctness comes from content; owner confirmed generating every safely located blank, with the Step 3b accept-list review before any learner sees one                            |
| 82  | 2026-10-22 | “Which is correct?” keeps punctuation-only mistakes; it skips a mistake only when both versions read the same as written                                                                                                                                                                                                    | The choice shows the authored sentences, where a missing comma is visible; spec §12.3 compared normalised text, which would have hidden 4 mistakes                                                |
| 83  | 2026-10-23 | Language bank: sections and SQL order from spec §14/§17, no filters, 50 per page, counts read before streaming so a page past the end redirects; no review button until Practice is real (Step 5); next review in whole days                                                                                                | Spec §17. One truthful view of saved language from existing state; a review button now would lead to the labelled prototype                                                                       |
| 84  | 2026-10-23 | Review session: `/practice` replaced by up to five due exercises from authored content; answers through `POST /api/review/answers`, checked inside the locked transaction against the exercise regenerated for `expectedReviews`; typed prompts omit the headword; practice renders without a Suspense boundary             | Spec §14, §15, D11, D19, D21. Server-authoritative and once-only; rendering in one pass keeps the exercise in the HTML the accessibility suite checks                                             |
| 85  | 2026-10-23 | Mistake evidence derived from `review_log` in one bounded query (§16), no table or migration; unrecognised typed answers count by exact normalised text; resolved is derived; feedback and bank rows show it, plus "Missed n times" from `lapses`                                                                           | D14, owner-confirmed over a stored evidence table. The log row is the evidence, so it is atomic and once-only by construction; nothing is stored twice                                            |
| 86  | 2026-10-23 | Honest Home: `loadHome` reads counts, the next review, four latest saves and up to three recurring mistakes from the learner's data; `src/demo/` deleted; Progress hidden from navigation (`HIDDEN_NAV`); routes unchanged (`/home`, `/`, `/finder`)                                                                        | Spec §18, D15, D20; owner kept the spec's routes over moving Home to `/`, which would put a session-reading page on the public landing route                                                      |
| 87  | 2026-10-24 | Save copy promises only what exists: the save response says `review` is `ready` or `scheduled`, read from the card after saving; the notices, save gate and landing CTA use spec §19's wording                                                                                                                              | Spec §19. `PUT` is idempotent, so saving an answered meaning again isn't ready; reading the card keeps "It's ready to review" true                                                                |
| 88  | 2026-10-24 | Phase 5 release order: migrations 0005–0007, then the content import, both on Neon from the phase PR's head, before the owner approves the merge that deploys; rollback is Vercel Instant Rollback, never schema changes                                                                                                    | Saving writes review cards and the bank, Practice and Home read the review tables, so the schema must exist first; it is additive, so v0.4.0 runs on it unchanged                                 |
| 91  | 2026-10-26 | Learning state (§9.1) derived, not stored: stage from the review card through the bank's own rule (`learningStage`), evidence from `review_log` across saves in one aggregated statement, reasons as observed facts; no table, migration, index, endpoint or UI                                                             | Phase 7.1. Card and log already hold every fact; a second mastery rule or table would drift from the scheduler. Measured fast on existing indexes                                                 |
| 92  | 2026-10-26 | The bank reads each row's learning state from `loadLearningStates` for its page (one batched statement) and filters by stage or due in SQL (`?show=`), keeping its order and pages; stage-and-due filter chips with counts replace the Phase 5 summary line                                                                 | Phase 7.2. One source for stage, due and reason; filtering in SQL keeps pages of 50 without reading the whole bank; the old summary's partition would contradict stage counts                     |
| 93  | 2026-10-26 | Practice selection (§9.1) orders Review's due queue by tier from the learning state (missed, more misses first; due, learning before known; new), ties in Review's order; never selects what isn't due; reasons on each session item; no endpoint, index or scheduler change                                                | Phase 7.3. Owner chose to keep spec §14's no-early-reviews rule over practising or reviewing not-due senses; one due definition, one learning state, one exercise generator                       |
