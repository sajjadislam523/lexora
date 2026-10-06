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

## Where things go

| What                                        | Where                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Routes and layouts                          | `src/app/`                                                                                  |
| shadcn/ui primitives (restyled)             | `src/components/ui/` (add with `pnpm dlx shadcn@latest add <name>`, then restyle to tokens) |
| Lexora product components                   | `src/components/lexora/`                                                                    |
| Design tokens / type roles                  | `src/styles/tokens.css`, `src/styles/typography.css`                                        |
| Design playground                           | `src/app/design-system/` (keep in sync when components change)                              |
| Future: feature modules, domain logic, data | See ARCHITECTURE.md → Target structure                                                      |

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
```

Before reporting work as done, run `pnpm lint && pnpm typecheck && pnpm build`.

## Next.js version note

This project uses **Next.js 16** (App Router, Turbopack by default, async request APIs, `proxy.ts` replaces `middleware.ts`). Check `node_modules/next/dist/docs/` before relying on older conventions (see AGENTS.md).
