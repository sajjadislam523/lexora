# Lexora Architecture

> Technical architecture, boundaries, and decisions. Status: **Phase 2 — Application Foundation**. Real accounts, sessions and a database exist; language content is still prototype data. Anything marked _Target_ is agreed direction, not built code.

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
| Validation                 | **Zod 4**: env, server action inputs, form schemas (content files in Phase 3)              | ✅           |
| Database                   | **PostgreSQL 17** — Docker locally, **Neon** in production                                 | ✅           |
| ORM / migrations           | **Drizzle ORM** 0.45 + **drizzle-kit** (SQL migrations in `drizzle/`), postgres.js driver  | ✅           |
| Auth                       | **Better Auth** 1.7 (email + password; social providers later)                             | ✅           |
| Fuzzy search               | Postgres full-text search + `pg_trgm`                                                      | Phase 4      |
| Semantic search (optional) | `pgvector` + embeddings (local model or AI provider)                                       | Phase 9      |
| Spaced repetition          | FSRS (`ts-fsrs`) or SM-2, decided in Phase 5                                               | Phase 5      |
| Unit / integration tests   | **Vitest** — unit tests plus integration tests against Postgres                            | ✅           |
| E2E / a11y tests           | **Playwright** + axe                                                                       | Phase 6–10   |
| Speech                     | Browser `MediaRecorder` + Web Speech API (no paid STT)                                     | Phase 8      |
| Hosting                    | **Vercel** (app) + **Neon** (PostgreSQL)                                                   | Configured   |

---

## 3. Current structure (Phase 2.1)

```text
lexora/
├── CLAUDE.md · AGENTS.md · README.md
├── docs/                         # DESIGN, UX_PRINCIPLES, ARCHITECTURE, ROADMAP, WORKFLOW
├── docker-compose.yml            # Local PostgreSQL 17 (development only)
├── drizzle.config.ts             # drizzle-kit: schema path, migrations dir, direct DB URL
├── drizzle/                      # Generated SQL migrations (committed; never edited by hand)
├── .env.example                  # Documented environment template (real .env files are ignored)
├── scripts/auth-generate.mjs     # Regenerates the Better Auth tables from the auth config
├── test/                         # Vitest setup and the server-only stub
└── src/
    ├── proxy.ts                  # Optimistic protection of personal areas (cookie presence only)
    ├── app/
    │   ├── layout.tsx · globals.css · robots.ts · sitemap.ts · not-found.tsx
    │   ├── (public)/             # Public discovery: no session read on the server, SiteHeader/Footer
    │   │   ├── page.tsx          #   Landing page (static)
    │   │   ├── explore/page.tsx  #   Public Language Finder (server-rendered per query)
    │   │   └── language/[slug]/page.tsx   # Language pages (static, SEO metadata)
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
    │   ├── site/                 # Public header, footer, logo
    │   └── shell/                # AppShell, sidebar, user menu, top bar, command palette
    ├── features/                 # Screen composition: auth, dashboard, discovery, finder, language, practice, settings
    ├── language/                 # Shared language engine: repository, search service, client-safe examples
    ├── demo/                     # Sample learner data for the prototype dashboard and practice screens (NOT language content)
    ├── server/                   # Server-only (import "server-only")
    │   ├── env.ts · site-url.ts  #   Zod-validated server environment; public origin
    │   ├── auth/                 #   Better Auth config, session helpers, account-email links
    │   ├── email/                #   EmailSender (Resend / outbox) and the account email templates
    │   ├── http/                 #   Same-origin guard for cookie-authenticated route handlers
    │   ├── db/                   #   Drizzle client + schema (auth tables generated, product tables hand-written)
    │   └── repositories/         #   Data access; callers pass the session's user id
    ├── lib/                      # Shared, client-safe utilities (cn, auth client, safe redirect, constants)
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
| `/explore`                    | Public        | Dynamic (per `?q=`)              | Public Language Finder; query pages are `noindex`, canonical `/explore`                                                                                             |
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
- **Seeding:** none needed — sign-up creates real users, and the prototype language content lives in `src/demo` until the Phase 3 content pipeline (curated files → Zod validation → seed script).

### 4.5 Data model

| Table              | Owner       | Purpose                                                                                               |
| ------------------ | ----------- | ----------------------------------------------------------------------------------------------------- |
| `users`            | Better Auth | Identity: id, name, email, email_verified, image, timestamps                                          |
| `sessions`         | Better Auth | Active sessions (token, expiry, IP, user agent) → `users` (cascade)                                   |
| `accounts`         | Better Auth | Auth methods per user (`credential` = password hash; later `google`) → `users` (cascade)              |
| `verifications`    | Better Auth | Password-reset tokens, stored as SHA-256 hashes (verification links are signed JWTs, not stored)      |
| `rate_limits`      | Better Auth | Rate-limit counters shared across serverless instances                                                |
| `learner_profiles` | Lexora      | One per user: target band (4.0–9.0, step 0.5, DB-checked), test date, focus skill → `users` (cascade) |

**Future tables** (designed for, not created): every one references `users.id` with `on delete cascade`, so deleting an account removes its data.

```text
users ─┬─ learner_profiles (1:1)          Phase 2 ✅
       ├─ preferences (1:1)               daily goal, register, reminders        Phase 5
       ├─ saved_items (1:n) ─── language_items (Phase 3)                         Phase 5
       ├─ item_mastery (1:n, per item)    SRS state (FSRS fields), last review   Phase 5
       │    └─ review_log (1:n)           every rating, for scheduling + history Phase 5
       ├─ mistakes (1:n)                  wrong form, right form, source         Phase 5–7
       ├─ practice_sessions (1:n) ─ practice_answers (1:n)                       Phase 6
       ├─ writing_submissions (1:n) ─ audit_findings (1:n)                       Phase 7
       └─ speaking_sessions (1:n) ─ speaking_attempts (1:n)                      Phase 8
```

Language content (`language_items`, relations, examples, intents) is **global**, not per user, and arrives in Phase 3.

### 4.6 Environment

Validated by Zod in `src/server/env.ts` (server-only) on first use; errors name the variable, never its value. Template: `.env.example`.

| Variable                | Required                                   | Notes                                                                  |
| ----------------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| `DATABASE_URL`          | Always                                     | Local Docker URL in development; Neon **pooled** URL in production     |
| `DATABASE_URL_UNPOOLED` | Production (Neon)                          | Direct URL, used only by migrations; falls back to `DATABASE_URL`      |
| `BETTER_AUTH_SECRET`    | Always                                     | ≥ 32 random characters; unique per environment; rotate by redeploying  |
| `BETTER_AUTH_URL`       | Production                                 | Public app URL; must be https (http allowed only for localhost)        |
| `EMAIL_TRANSPORT`       | No                                         | `resend` (production default) or `outbox` (default elsewhere)          |
| `RESEND_API_KEY`        | When the transport is `resend`             | Resend API key (sending access only); never logged                     |
| `EMAIL_FROM`            | When the transport is `resend`             | Sender on a domain verified in Resend, e.g. `Lexora <account@…>`       |
| `EMAIL_OUTBOX_DIR`      | No                                         | Outbox folder, default `.email-outbox` (git-ignored)                   |
| `AI_PROVIDER`           | No                                         | `none` (default) — the optional Phase 9 boundary; nothing reads it yet |
| `AI_API_KEY`            | Only if `AI_PROVIDER` is a hosted provider | Never needed to run Lexora                                             |

No variable uses the `NEXT_PUBLIC_` prefix; nothing secret can reach the browser bundle. Development uses `.env.local` (git-ignored); production values live in Vercel's environment settings (Neon's Vercel integration provides both database URLs).

### 4.7 Security model

| Concern                | Measure                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Passwords              | Better Auth scrypt (salted); never logged or returned; 8–128 characters                                                                                                                                                                                                                                                                                      |
| Sessions               | Opaque DB-backed tokens; HttpOnly + SameSite=Lax (+ Secure on https); the token is never in any JSON body (see Token exposure); revocable instantly                                                                                                                                                                                                          |
| CSRF                   | SameSite=Lax cookies plus Better Auth's origin check against `trustedOrigins` (cross-origin POSTs with a cookie → 403); the cookie-less reset endpoints also require the app origin (a `hooks.before` check with `isSameOrigin()`); server actions use Next's built-in origin check; route handlers use `isSameOrigin()` (missing or foreign `Origin` → 403) |
| Brute force            | Database-backed rate limiting per IP: sign-in 5/min, sign-up 3/min, send verification email 3/min, request password reset 3/min, set a new password 5/min, other auth endpoints 100/min                                                                                                                                                                      |
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

- `language/` (the shared engine) imports no UI, server or app code. `language/index.ts` is server-only; client components import only the client-safe `language/examples` and types.
- Public routes (`app/(public)`) and public features (`discovery`, `finder`, `language`) never import `server`; public routes never import `demo`.

These rules are **enforced by ESLint** (`eslint.config.mjs` → boundaries): shared UI, `lib` and `demo` can't import server code or features; server code can't import UI; features can't import each other; the language engine stays independent; public discovery code can't import server code. Type-only imports are allowed.

---

## 6. Language data model (draft, finalised in Phase 3)

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

## 7. Search strategy (Phase 4)

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

## 8. Intelligence layer

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

## 9. Learning engine (Phase 5–6)

- **Mastery** is derived from review history (recall success over spaced intervals), never from views.
- **Scheduler:** FSRS (modern, open-source, `ts-fsrs`) is the leading option over SM-2. It's a pure function: `(card state, rating, now) → next state`.
- **Practice generation** is deterministic from language data: fill-in-the-blank from examples (`highlight_span`), multiple choice from relations (distractors drawn from same-category items and known `mistake.wrong_form`), preposition drills from `preposition_link`, and so on.

## 10. Writing & Speaking labs (Phase 7–8)

- **Writing audit** is a rule pipeline over tokenised text: repetition (lemma frequency), preposition checks against `preposition_link`, collocation checks against `relation(collocates_with)`, linker variety, register mismatches. Each rule returns a `Finding { span, type, message, suggestions[] }`.
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
- **Performance:** fonts self-hosted, static rendering where possible, search debounced on the client and indexed on the server.
- **Security:** auth on every server action and route handler, row ownership checks in repositories, rate-limiting on search and auth, CSP in Phase 10.

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
