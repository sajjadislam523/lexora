# Lexora Development Workflow

> How code moves from an idea to `main`. Phases are defined in [ROADMAP.md](ROADMAP.md).

## Branch model

```text
main                         ← approved phases only (always releasable)
 └── phase/1-visual-prototype     ← integration branch for one phase
      ├── feat/1-app-shell        ← one feature / unit of work
      ├── feat/1-language-finder-mock
      └── fix/1-sidebar-focus-ring
```

| Branch             | Cut from                              | Merges into                 | Purpose                                       |
| ------------------ | ------------------------------------- | --------------------------- | --------------------------------------------- |
| `main`             | —                                     | —                           | Approved, stable work. Never commit directly. |
| `phase/<n>-<slug>` | `main`                                | `main` (PR, owner approval) | Integrates all work for one roadmap phase     |
| `feat/<n>-<slug>`  | current phase branch                  | phase branch (PR)           | A feature or component                        |
| `fix/<n>-<slug>`   | phase branch (or `main` for hotfixes) | same                        | Bug fixes                                     |
| `docs/<n>-<slug>`  | phase branch                          | phase branch                | Documentation-only changes                    |
| `chore/<n>-<slug>` | phase branch                          | phase branch                | Tooling, dependencies, config                 |

`<n>` is the roadmap phase number. Slugs are short and kebab-case, e.g. `feat/4-fuzzy-search`.

## Lifecycle of a phase

1. **Start.** Create `phase/<n>-<slug>` from the latest `main` and push it.
2. **Build.** Work on feature branches cut from the phase branch. Open a PR into the phase branch for each one. CI must pass. Merge with a merge commit (`--no-ff`) so the feature boundary stays visible.
3. **Review.** When the phase's exit criteria in ROADMAP.md are met, open a PR **phase → main** with the phase report: what was built, decisions, and what remains.
4. **Approve.** The product owner reviews and approves. Only then is the phase merged into `main`. The next phase can't start before this.
5. **Close.** Tag the merge (`v0.<n>.0`, e.g. `v0.1.0` for Phase 1) and delete merged feature branches.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<scope>): <summary in imperative mood>

feat(finder): add intent matching for contrast queries
fix(ui): restore focus ring on outline buttons
docs(design): document practice card states
chore(deps): add zod for env validation
refactor(search): extract query normaliser
test(srs): cover lapse scheduling
```

- **Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`.
- **Scopes (suggested):** `ui`, `design`, `tokens`, `shell`, `finder`, `bank`, `practice`, `writing`, `speaking`, `domain`, `db`, `auth`, `deps`, `ci`.
- Keep commits small and focused. Each commit should build.

## Before opening a PR

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm build
```

CI (`.github/workflows/ci.yml`) runs the same checks on every push and PR. Also confirm:

- Visual changes are reflected in `/design-system` and `docs/DESIGN.md`.
- Architectural changes are recorded in `docs/ARCHITECTURE.md` → Decision log.
- Prototype-only UI is labelled as such.

## Hotfixes

For an urgent fix to `main`, cut `fix/<n>-<slug>` from `main`, open a PR into `main`, then merge `main` back into the active phase branch.
