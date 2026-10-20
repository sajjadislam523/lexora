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
2. **Build.** Work on feature branches cut from the phase branch. Open a PR into the phase branch for each one. When CI passes, CI merges it with a merge commit (`--no-ff`) so the feature boundary stays visible; open it as a draft to hold it for review (see [Feature auto-merge](#feature-auto-merge)).
3. **Review.** When the phase's exit criteria in ROADMAP.md are met, open a PR **phase → main** with the phase report: what was built, decisions, and what remains.
4. **Approve.** The product owner reviews the phase PR and approves it by adding the `owner-approved` label. That label is the final checkpoint: CI runs the full suite again on exactly that commit and, only if it passes, merges the PR into `main` (see [Merge checkpoint](#merge-checkpoint)). The next phase can't start before this.
5. **Close.** CI tags the merge (`v0.<n>.0`, e.g. `v0.1.0` for Phase 1; `v0.2.1` for Phase 2.1). Then delete merged feature branches.

## Merge checkpoint

Nothing reaches `main` without the owner's explicit approval, recorded on the PR as the `owner-approved` label. The `merge` job in `.github/workflows/ci.yml` does the rest:

1. The owner adds `owner-approved` to a `phase/*` → `main` PR.
2. CI runs the complete `verify` job (format, lint, typecheck, migrations, drift check, tests, build, end-to-end) on that commit.
3. If it passes, CI merges with a merge commit and creates the release tag.

Safeguards:

- **Owner only.** The job runs only when the label is added by the repository owner, on a branch of this repository, from a `phase/*` branch into `main`.
- **Exact commit.** The merge is pinned to the commit that was labelled (`--match-head-commit`). Anything pushed afterwards isn't merged: remove and re-add the label to approve the new commit.
- **Claude Code never adds this label.** It runs with the owner's GitHub credentials, so this is a working rule (also in `CLAUDE.md`), not something GitHub can enforce. Claude Code opens the PR, reports, and stops.
- If a merge conflict appears, the job fails and nothing is merged. Merge `main` into the phase branch, push, and label again.

## Feature auto-merge

Feature, fix, docs and chore PRs into a phase branch need no label. The `merge-feature` job in `.github/workflows/ci.yml`:

1. A `feat/*`, `fix/*`, `docs/*` or `chore/*` PR into a `phase/*` branch is opened, pushed to, reopened or marked ready for review.
2. CI runs the complete `verify` job on its latest commit (the PR merged with the current phase branch).
3. If it passes, CI merges it into the phase branch with a merge commit. There is no tag: only the phase PR into `main` releases.

Safeguards:

- **Drafts wait.** A draft PR is checked but never merged. Open a PR as a draft to review it first, then click _Ready for review_: CI runs again and merges it if it passes.
- **Owner's PRs, this repository only.** The PR must be opened by the repository owner (Claude Code uses the owner's credentials), from a branch of this repository.
- **Exact commit.** The merge is pinned to the commit that was tested (`--match-head-commit`). A newer push cancels the older run and starts a new one.
- **Failures merge nothing.** If a check fails, fix it and push; the next green run merges. A PR with a merge conflict gets no CI run: merge the phase branch into the feature branch and push.
- A merge made by CI doesn't trigger a second CI run on the phase branch; the PR's run already tested it merged with the phase branch.

This never touches `main`: the phase PR into `main` still waits for the owner's label ([Merge checkpoint](#merge-checkpoint)).

## Deployments

Vercel deploys from `main` only. `vercel.json` turns Git deployments off for every other branch (`git.deploymentEnabled`), so phase and feature branches and their PRs create no Preview deployments. Each merge into `main` deploys Production. CI is what checks a branch before it merges.

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
