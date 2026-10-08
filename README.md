# Lexora

**Find the right English. Use it naturally. Remember it when it matters.**

Lexora is a language-retrieval workspace for IELTS Academic candidates. It helps them find the right word, synonym, preposition, linker, collocation, or sentence pattern for what they want to say, then practise it until it comes naturally.

> Status: **Phase 3 — Language Engine (in progress).** Anyone can search and read the 40 published language pages from PostgreSQL. Learners save meanings, verify their email and reset their password. See [docs/ROADMAP.md](docs/ROADMAP.md).

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
   DATABASE_URL_UNPOOLED="<neon direct url>" DATABASE_URL="<neon pooled url>" pnpm db:migrate
   ```

   Keep migrations backwards-compatible with the running version (add first, remove later).

4. **Content:** import the language content into Neon after migrating and before the new code goes live. Run it from the commit being deployed, with a clean `content/` folder:

   ```bash
   git checkout main && git pull && git status --short content   # must print nothing
   DATABASE_URL_UNPOOLED="<neon direct url>" DATABASE_URL="<neon pooled url>" pnpm content:import
   ```

   - The import validates first and writes everything in one transaction: it either succeeds completely or changes nothing.
   - It is safe to re-run. Unchanged content prints `nothing to import`; changed content records a new release in `content_releases` (with the git commit, content checksum and counts).
   - It refuses to run, and changes nothing, if a published item or sense has been deleted from `content/`, a published item is set back to draft, or a slug changed without keeping the old one. Retire content instead (see [content/README.md](content/README.md)).
   - To roll content back, check out the earlier commit and import again. IDs never change, so saved language survives in both directions.

5. **Deploy:** merge to `main` after the phase PR is approved. Vercel builds with `pnpm build`.

Preview deployments need their own `BETTER_AUTH_URL` and ideally their own Neon branch — see the open decisions in [docs/ROADMAP.md](docs/ROADMAP.md).

## Documentation

- [docs/ROADMAP.md](docs/ROADMAP.md): phases and current status
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): stack, auth, database, environment, security, boundaries
- [docs/DESIGN.md](docs/DESIGN.md): the design system (visual source of truth)
- [docs/UX_PRINCIPLES.md](docs/UX_PRINCIPLES.md): product and interaction principles
- [docs/WORKFLOW.md](docs/WORKFLOW.md): branching, commits, and phase reviews
- [CLAUDE.md](CLAUDE.md): working agreement for AI-assisted development
