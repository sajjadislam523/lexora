# Lexora

**Find the right English. Use it naturally. Remember it when it matters.**

Lexora is a language-retrieval workspace for IELTS Academic candidates. It helps them find the right word, synonym, preposition, linker, collocation, or sentence pattern for what they want to say, then practise it until it comes naturally.

> Status: **Phase 3 — Language Engine released (`v0.3.0`); Phase 4 — Search Depth in progress** ([specification](docs/specs/phase-4-search-depth.md)). Anyone can search and read the 40 published language pages from PostgreSQL. Learners save meanings, verify their email and reset their password. See [docs/ROADMAP.md](docs/ROADMAP.md).

Lexora runs fully without any AI provider.

## Local development

Requirements: Node.js 20.9+ (developed on Node 26), pnpm, and Docker.

```bash
pnpm install
cp .env.example .env.local
# Set BETTER_AUTH_SECRET in .env.local to a random value:
openssl rand -base64 32

pnpm db:up        # start PostgreSQL 17 in Docker (localhost:5432)
pnpm db:migrate   # create the tables
pnpm dev          # http://localhost:3000
```

Open <http://localhost:3000>: the landing page, `/explore` and `/language/*` work without an account. Create an account to reach the app (`/home`, `/finder`, …). `/design-system` is the public design reference.

To start again from an empty database: `pnpm db:reset && pnpm db:migrate`.

**Account email in development.** Nothing is sent. With `EMAIL_TRANSPORT="outbox"` (the default outside production, and set in `.env.example`), each verification or password-reset email is written as a JSON file to `.email-outbox/` (git-ignored). Open the newest file and follow the link in it. The same applies to a local `pnpm build && pnpm start`, which needs `EMAIL_TRANSPORT="outbox"` set because production defaults to Resend. The end-to-end tests read the outbox the same way, so CI never sends email.

## Scripts

| Command                               | Purpose                                                    |
| ------------------------------------- | ---------------------------------------------------------- |
| `pnpm dev`                            | Development server (Turbopack)                             |
| `pnpm build` / `pnpm start`           | Production build / serve                                   |
| `pnpm lint` / `pnpm typecheck`        | ESLint (incl. layer boundaries) / TypeScript               |
| `pnpm format` / `pnpm format:check`   | Prettier (with Tailwind class sorting)                     |
| `pnpm test`                           | Vitest unit tests + integration tests against the local DB |
| `pnpm test:e2e`                       | HTTP route checks against a running server (`pnpm start`)  |
| `pnpm db:up` / `db:down` / `db:reset` | Start / stop / wipe the local Postgres container           |
| `pnpm db:generate`                    | Create a SQL migration from schema changes (`drizzle/`)    |
| `pnpm db:migrate`                     | Apply migrations                                           |
| `pnpm db:studio`                      | Browse the database                                        |
| `pnpm auth:generate`                  | Regenerate Better Auth tables after changing auth config   |
| `pnpm content:check`                  | Validate `content/` (no database needed)                   |
| `pnpm content:import`                 | Validate and import `content/` into the database           |

## Production (Vercel + Neon)

For a phase release, follow that phase's runbook, which is authoritative for the order and the checks (Phase 5: [docs/specs/phase-5-release-runbook.md](docs/specs/phase-5-release-runbook.md)). The general order is migrations, then content, then the merge that deploys.

1. **Database:** create a Neon project (or add the Neon integration in Vercel). You need two connection strings: the **pooled** one (host contains `-pooler`) and the **direct** one.
2. **Environment variables** in Vercel → Project → Settings → Environment Variables (Production):

   | Variable                | Value                                                 |
   | ----------------------- | ----------------------------------------------------- |
   | `DATABASE_URL`          | Neon pooled connection string                         |
   | `DATABASE_URL_UNPOOLED` | Neon direct connection string (used for migrations)   |
   | `BETTER_AUTH_SECRET`    | A new random value (`openssl rand -base64 32`)        |
   | `BETTER_AUTH_URL`       | The production URL, e.g. `https://lexora.app` (https) |
   | `RESEND_API_KEY`        | A Resend API key with sending access only             |
   | `EMAIL_FROM`            | e.g. `Lexora <account@mail.lexora.app>`               |

   Never reuse the development secret. Don't set `AI_PROVIDER` — Lexora doesn't need it.

   **Resend:** add the sending domain in Resend and publish its DNS records (SPF/DKIM) before deploying. Use that domain in `EMAIL_FROM`, and keep click and open tracking off for it (tracking would rewrite the links that carry account tokens). Production refuses to start without `RESEND_API_KEY` and `EMAIL_FROM`; email links are built from `BETTER_AUTH_URL`.

3. **Migrations:** apply them to Neon before the new code goes live:

   ```bash
   LEXORA_ALLOW_REMOTE_DB="<neon direct host>" DATABASE_URL_UNPOOLED="<neon direct url>" DATABASE_URL="<neon pooled url>" pnpm db:migrate
   ```

   Keep migrations backwards-compatible with the running version (add first, remove later). `LEXORA_ALLOW_REMOTE_DB` must name the direct URL's host exactly (see [Local-database guard](#local-database-guard)); type it in the shell for this one command, never in `.env.local`.

4. **Content:** import the language content into Neon after migrating and before the new code goes live. Run it from the commit being deployed (for a phase release, the phase PR's head commit, before it's merged), with a clean `content/` folder:

   ```bash
   git fetch origin && git checkout --detach <commit being deployed> && git status --short content   # must print nothing
   LEXORA_ALLOW_REMOTE_DB="<neon direct host>" DATABASE_URL_UNPOOLED="<neon direct url>" DATABASE_URL="<neon pooled url>" pnpm content:import
   ```

   - The import validates first and writes everything in one transaction: it either succeeds completely or changes nothing.
   - It is safe to re-run. Unchanged content prints `nothing to import`; changed content records a new release in `content_releases` (with the git commit, content checksum and counts).
   - It refuses to run, and changes nothing, if a published item or sense has been deleted from `content/`, a published item is set back to draft, or a slug changed without keeping the old one. Retire content instead (see [content/README.md](content/README.md)).
   - To roll content back, check out the earlier commit and import again. IDs never change, so saved language survives in both directions.

5. **Deploy:** merge to `main` after the phase PR is approved. Vercel builds with `pnpm build`.

### Local-database guard

`pnpm db:migrate` (and the other drizzle-kit commands), `pnpm content:import`, `pnpm test` and `pnpm test:e2e` refuse to run unless the database they would use is local: `localhost`, `127.0.0.1`, `::1` or a Unix socket, such as the Docker database (`postgres://lexora@localhost:5432/lexora`) or CI's service container (`scripts/database-target.ts`). They check before opening any connection, and the message names only the host.

To target a remote database on purpose (the production steps above), set `LEXORA_ALLOW_REMOTE_DB` to that database's exact hostname in the shell, for that one command. The commands print a warning naming the host. The override is read before `.env.local` is loaded, so it can't be left in an env file, and `CI` doesn't bypass the guard. Keep `DATABASE_URL` in `.env.local` pointing at Docker.

### Search rate limit (Vercel Firewall)

Public search is limited at the edge to **120 requests per minute per IP** (Phase 5 decision D17). Search is server-rendered on `GET /explore?q=…` and `GET /finder?q=…`, so one Vercel Firewall rate-limit rule covers it. `vercel.json` can't express rate limits (its `mitigate` supports only `deny` and `challenge`), so the rule lives in the Vercel project. WAF rate limiting is available on every plan; Hobby allows one rate-limit rule per project with a fixed window keyed by IP.

- **Dashboard:** Project → Firewall → Configure → New Rule:
  - If **Request Path** _is any of_ `/explore`, `/finder`, **and** **Query** `q` _exists_;
  - Then **Rate Limit**: Fixed Window, 60 s, 120 requests, key **IP**, action **Default (429)**;
  - Save, Review Changes, **Publish**.
- **CLI equivalent** (Vercel CLI, logged in and linked to the project):

  ```bash
  vercel firewall rules add "Public search rate limit" \
    --condition '{"type":"path","op":"inc","value":["/explore","/finder"]}' \
    --condition '{"type":"query","op":"ex","key":"q"}' \
    --action rate_limit --rate-limit-window 60 --rate-limit-requests 120 \
    --rate-limit-keys ip --rate-limit-action rate_limit \
    --description "Phase 5 D17: public search, 120/min/IP" --yes
  vercel firewall diff
  vercel firewall publish --yes
  ```

- **Verify on production** (from one IP; it uses that IP's allowance for a minute): `vercel firewall rules inspect "Public search rate limit"`, then

  ```bash
  for i in $(seq 1 130); do curl -s -o /dev/null -w "%{http_code}\n" "https://<production host>/explore?q=important"; done | sort | uniq -c
  ```

  expects about 120 × `200` and the rest `429`. Explore without `?q=`, language pages and the landing page aren't limited.

Signed-in writes are limited in the app, per learner, in PostgreSQL (`request_limits`): 60 saves and removals a minute, and 30 review answers a minute (429 with `Retry-After`).

### Account email check

Production sends verification and password-reset email through Resend and refuses to start without `RESEND_API_KEY` and `EMAIL_FROM` (`src/server/env.ts`). `EMAIL_FROM` is the sender address (`Lexora <account@your-domain>`), consumed by the Resend sender (`src/server/email`). It must be on a domain verified in Resend: the test sender `onboarding@resend.dev` delivers only to the Resend account owner, so other learners would receive nothing. To check: Vercel → Project → Settings → Environment Variables → Production → `EMAIL_FROM`, and Resend → Domains for that domain's status. Then request a password reset for an inbox that isn't the Resend owner's and confirm it arrives.

### Environments

| Environment | Database                 | Auth URL                                    | Auth secret |
| ----------- | ------------------------ | ------------------------------------------- | ----------- |
| Local       | Docker PostgreSQL        | `http://localhost:3000` (`.env.local`)      | its own     |
| Preview     | Neon `preview` branch    | Vercel's preview address, set automatically | its own     |
| Production  | Neon production database | `BETTER_AUTH_URL`                           | its own     |

Git pushes deploy only `main` (`vercel.json`), so Vercel creates no Preview deployments from branches or PRs. The Preview environment stays isolated for a deployment made by hand (`vercel deploy`).

**Preview variables** (Vercel → Environment Variables, Preview only): `DATABASE_URL` and `DATABASE_URL_UNPOOLED` from the Neon `preview` branch, a separate `BETTER_AUTH_SECRET`, and `RESEND_API_KEY` and `EMAIL_FROM` with the Resend test sender (`onboarding@resend.dev`), which only delivers to the Resend account owner. Keep the Neon integration connected to Production only. Don't set `BETTER_AUTH_URL` for Preview; it is ignored there. Migrate and import content into the `preview` branch the same way as production, with that branch's connection strings.

Lexora doesn't use Better Auth Infrastructure. If Better Auth's website asks for `BETTER_AUTH_API_KEY`, it's for that separate hosted product; Lexora neither reads nor needs it.

## Documentation

- [docs/ROADMAP.md](docs/ROADMAP.md): phases and current status
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): stack, auth, database, environment, security, boundaries
- [docs/DESIGN.md](docs/DESIGN.md): the design system (visual source of truth)
- [docs/UX_PRINCIPLES.md](docs/UX_PRINCIPLES.md): product and interaction principles
- [docs/WORKFLOW.md](docs/WORKFLOW.md): branching, commits, and phase reviews
- [docs/audits/](docs/audits/): dated project audits, starting with the post-Phase-3 audit (9 October 2026)
- [docs/specs/](docs/specs/): phase specifications, final audits and release runbooks (Phase 5: [spec](docs/specs/phase-5-retrieval-loop.md), [final audit](docs/specs/phase-5-final-audit.md), [release runbook](docs/specs/phase-5-release-runbook.md))
- [CLAUDE.md](CLAUDE.md): working agreement for AI-assisted development
