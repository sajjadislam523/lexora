# Lexora

**Find the right English. Use it naturally. Remember it when it matters.**

Lexora is a language-retrieval workspace for IELTS Academic candidates. It helps them find the right word, synonym, preposition, linker, collocation, or sentence pattern for what they want to say, then practise it until it comes naturally.

> Status: **Phase 0 — Foundation.** Only the technical and design foundation exists. See [docs/ROADMAP.md](docs/ROADMAP.md).

## Getting started

Requirements: Node.js 20.9+ (developed on Node 26) and pnpm.

```bash
pnpm install
pnpm dev
```

- <http://localhost:3000> is the placeholder home.
- <http://localhost:3000/design-system> is the design system playground.

## Scripts

| Command                             | Purpose                                |
| ----------------------------------- | -------------------------------------- |
| `pnpm dev`                          | Development server (Turbopack)         |
| `pnpm build` / `pnpm start`         | Production build / serve               |
| `pnpm lint`                         | ESLint                                 |
| `pnpm typecheck`                    | Route type generation + TypeScript     |
| `pnpm format` / `pnpm format:check` | Prettier (with Tailwind class sorting) |

## Documentation

- [docs/ROADMAP.md](docs/ROADMAP.md): phases and current status
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): stack, boundaries, data model, intelligence layer
- [docs/DESIGN.md](docs/DESIGN.md): the design system (visual source of truth)
- [docs/UX_PRINCIPLES.md](docs/UX_PRINCIPLES.md): product and interaction principles
- [docs/WORKFLOW.md](docs/WORKFLOW.md): branching, commits, and phase reviews
- [CLAUDE.md](CLAUDE.md): working agreement for AI-assisted development

## Principle

The core product works **without any external AI API**. AI is an optional layer for later.
