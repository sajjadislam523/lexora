@AGENTS.md

# Lexora — working agreement for Claude Code

Lexora is an IELTS Academic language-retrieval SaaS. Promise: **Find the right English. Use it naturally. Remember it when it matters.**

## Read before any significant change

1. [docs/ROADMAP.md](docs/ROADMAP.md): which phase we are in and what is in or out of scope.
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): boundaries, folder layout, data and intelligence layers.
3. [docs/DESIGN.md](docs/DESIGN.md): the visual source of truth (tokens, components, states).
4. [docs/UX_PRINCIPLES.md](docs/UX_PRINCIPLES.md): how the product should feel and behave.
5. [docs/WORKFLOW.md](docs/WORKFLOW.md): branches, commits, and how a phase reaches `main`.

"Significant" means a new route, component, dependency, data model, or visual pattern, or anything that touches more than one feature.

## Non-negotiable rules

- **Phase discipline.** Work only on the current phase in ROADMAP.md. Don't start the next phase without the owner's explicit approval. When a phase is done, stop and report.
- **No AI dependency.** The core product must work fully without any external AI or LLM API. AI is an optional adapter behind the interfaces described in ARCHITECTURE.md → Intelligence layer. Never make a feature depend on it.
- **No fake functionality.** If something is a visual prototype, label it in the UI and in code comments. Don't simulate behaviour that looks real but isn't (such as fake search results presented as real ones).
- **Tokens only.** Never hard-code colours, font sizes, radii, shadows, or durations in components:
  - Use the semantic Tailwind utilities generated from `src/styles/tokens.css` (`bg-card`, `text-muted-foreground`, `border-border`, `shadow-xs`, `duration-120`, `ease-standard`, `type-body`, …).
  - Don't use raw hex/rgb/oklch values or arbitrary visual values such as `text-[13px]`, `bg-[#fff]`, `rounded-[10px]`.
  - Arbitrary _variants_ and selectors (`[&_svg]:…`, `data-[state=open]:…`) are fine, as are transition property lists (`transition-[border-color,box-shadow]`) and a few structural `calc()` sizes inside `src/components/ui`.
  - If a value is missing, add it to `tokens.css` **and** document it in DESIGN.md first.
- **Use type roles.** Use the `type-*` utilities from `src/styles/typography.css` instead of composing size, weight, and tracking by hand.
- **Accessibility is part of done.** Every component needs a visible keyboard focus state and labelled controls, colour can't be the only signal, contrast must meet WCAG AA, and `prefers-reduced-motion` must be respected.
- **Dependencies.** Don't add a dependency without a clear need. Note the reason in ARCHITECTURE.md → Decision log.

## Security rules (auth and data)

- **Authorise on the server, every time.** Every protected page and server action calls `requireSession()` from `@/server/auth/session`; route handlers call `getRequestSession(request)` and answer 401, and check `isSameOrigin()` for cookie-authenticated writes. The proxy only checks that a cookie exists; never rely on it for authorisation.
- **Ids come from the session.** Use `session.user.id`; never accept a user id from form data, params or the client. Repositories take the user id explicitly.
- **Public pages stay public.** Routes in `src/app/(public)/` and the public features (`discovery`, `finder`, `language`) never import `@/server/*` or read the session on the server, and never render user data. Account actions they offer go through endpoints that authenticate each request themselves (see docs/ARCHITECTURE.md → Route boundary). Don't move a personal-learning page into `(public)` to make it reachable.
- **Server-only code stays server-side.** Modules under `src/server/` start with `import "server-only"`. Only `SafeUser` (`id`, `name`, `email`) may be passed into client components. ESLint blocks runtime imports of server code from `components`, `lib` and `demo`.
- **Secrets.** Read env only through `serverEnv()` (`src/server/env.ts`). Never prefix a secret with `NEXT_PUBLIC_`, never log or echo values, never commit `.env*` files except `.env.example`.
- **Don't hand-roll auth.** Password hashing, sessions, cookies and CSRF are Better Auth's. Configure them in `src/server/auth/auth.ts`; don't write custom crypto or session code.
- **Validate input with Zod** in server actions, even when the client also validates.
- **Product data lives outside the auth tables.** `src/server/db/schema/auth.ts` is generated (`pnpm auth:generate`) — don't edit it by hand. New product tables reference `users.id` with `onDelete: "cascade"`.

## Where things go

| What                                         | Where                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Routes and layouts                           | `src/app/`                                                                                  |
| shadcn/ui primitives (restyled)              | `src/components/ui/` (add with `pnpm dlx shadcn@latest add <name>`, then restyle to tokens) |
| Lexora product components                    | `src/components/lexora/`                                                                    |
| Design tokens / type roles                   | `src/styles/tokens.css`, `src/styles/typography.css`                                        |
| Design playground                            | `src/app/design-system/` (keep in sync when components change)                              |
| Screen composition                           | `src/features/<screen>/` (features don't import each other)                                 |
| Server-only code: env, auth, db, data access | `src/server/` (`env.ts`, `auth/`, `db/`, `repositories/`)                                   |
| Database schema / migrations                 | `src/server/db/schema/` → `pnpm db:generate` → `drizzle/` (commit the SQL)                  |
| Language engine (repository, search)         | `src/language/` — read language only through it (`index.ts` server-only)                    |
| Public discovery frame / save flow           | `src/components/site/`, `src/components/language/`                                          |
| Prototype content                            | `src/demo/` (behind `PrototypeLanguageRepository`; replaced in Phase 3)                     |
| Future: domain logic, curated content        | See ARCHITECTURE.md → Target structure                                                      |

## Git workflow

- Never commit to `main`. Each phase has an integration branch `phase/<n>-<slug>` cut from `main`.
- Do the work on `feat/<n>-<slug>`, `fix/…`, `docs/…`, or `chore/…` branches cut from the phase branch, and merge them back with a merge commit.
- A phase reaches `main` only through a PR that the owner approves.
- Use Conventional Commits (`feat(finder): …`).
- Full details are in [docs/WORKFLOW.md](docs/WORKFLOW.md).

## Commands

```bash
pnpm dev            # dev server (Turbopack)
pnpm build          # production build
pnpm lint           # ESLint
pnpm typecheck      # route typegen + tsc --noEmit
pnpm format         # Prettier (sorts Tailwind classes)
pnpm test           # Vitest: unit + Postgres integration tests (needs the local DB)

pnpm db:up          # start local Postgres (Docker)       pnpm db:down / db:reset (wipes data)
pnpm db:generate    # schema change → new SQL migration in drizzle/
pnpm db:migrate     # apply migrations                     pnpm db:studio (browse data)
pnpm auth:generate  # regenerate Better Auth tables after changing the auth config
```

First run: `cp .env.example .env.local`, set `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), then `pnpm db:up && pnpm db:migrate && pnpm dev`.

Before reporting work as done, run `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Schema changes always ship with a generated migration.

## Next.js version note

This project uses **Next.js 16** (App Router, Turbopack by default, async request APIs, `proxy.ts` replaces `middleware.ts`). Check `node_modules/next/dist/docs/` before relying on older conventions (see AGENTS.md).
