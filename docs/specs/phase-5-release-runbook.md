# Phase 5 — Production release runbook

Written: 24 October 2026 · For: the owner, releasing `phase/5-retrieval-loop` to `main` (`v0.5.0`) · Audit: [phase-5-final-audit.md](phase-5-final-audit.md)

**Every command in this runbook is owner-run.** Claude Code never runs them, never connects to Neon and never labels the phase PR. Follow the sections in order; don't skip ahead.

The order matters because **migrations 0005–0007 must exist in production before the Phase 5 code is deployed**:

- saving a meaning now creates its review card in `review_cards` (0006), in the same transaction as the save;
- the bank, Practice and Home read `review_cards` and `review_log` (0006), and the examples' `practice_*` columns (0007);
- saves, removals and answers count against `request_limits` (0005).

Code deployed before the schema would turn saving into an error and show the error state on the bank, Practice and Home. The migrations only add tables, types and defaulted columns, so the running `v0.4.0` ignores them: applying them first is safe.

Merging the phase PR into `main` deploys production (`vercel.json`). So sections 2–6 happen **before** you add `owner-approved`.

## 1. What you need

- The Neon console for the Lexora project, and the Vercel project's environment variables.
- A clean checkout of this repository with dependencies installed (`pnpm install`).
- For each Neon command, the **direct** connection string (`DATABASE_URL_UNPOOLED`, host without `-pooler`) and the **pooled** one (`DATABASE_URL`). Paste them only into the one shell command that needs them; never into `.env.local`, a file or a chat.

`LEXORA_ALLOW_REMOTE_DB` must equal the direct URL's host exactly (`scripts/database-target.ts`, README → Local-database guard). Without it, every command below refuses to run.

## 2. Before anything: identify the branch and check it (read-only)

**The 21 October incident.** During Phase 5 Step 0, `.env.local` briefly pointed at a Neon database. Running `pnpm db:migrate` and the test suite against it applied migration **0005 (`request_limits`)** there and probably left test residue. Nothing was dropped or cleaned up. Its compute endpoint id begins `ep-cold-salad`; which branch owns it (production or preview) was never confirmed. Since then the local-database guard makes this impossible by accident.

1. In the Neon console, find the branch that owns the endpoint beginning `ep-cold-salad`. Or compare the host of `DATABASE_URL` in Vercel's Production and Preview variables.
2. On the **production** branch (and on the incident branch, if different), run these in the Neon SQL editor. They only read:

   ```sql
   -- Migration history: expect 5 rows (0000–0004), or 6 if this branch had the incident (0005).
   select hash, created_at from drizzle.__drizzle_migrations order by created_at;

   -- Whether 0005 exists here, and that nothing uses it yet (expect 0 rows if it exists).
   select to_regclass('public.request_limits');
   select count(*) from request_limits; -- only if the line above isn't null

   -- Test residue left by the incident, if any.
   select datname from pg_database where datname ~ '^lexora_it_[0-9a-f]{12}$';
   select count(*) from users where email like '%@lexora.test';
   select id, status from language_items where id ~ '^it-(draft|live|item)-[0-9a-f]{8}$';
   ```

3. Read the result:
   - **The 0005 row, if present, must have hash `3904d680b92ffa168de81b6d5df91fa9dd6566f8d312cd7061d4cf17ac3b649f`.** That is the committed file's SHA-256, so `db:migrate` will recognise it and skip it. If a 0005 row has a different hash, or `request_limits` exists without a 0005 row, **stop**: don't migrate, and raise it before going further.
   - **Residue** (`lexora_it_*` databases, `@lexora.test` users, `it-*` items) is harmless to the release: the app never reads it, and the sitemap showed no test item. Removing it is a separate, reviewed decision. This runbook doesn't remove anything, and nothing should ever touch `drizzle.__drizzle_migrations` by hand.

## 3. Apply migrations 0005–0007 (owner-run)

From the repository, at the phase PR's head commit:

```bash
git fetch origin
git checkout --detach origin/phase/5-retrieval-loop
git rev-parse HEAD   # must equal the head commit shown on the phase PR
git status --short   # must print nothing except your own untracked notes

LEXORA_ALLOW_REMOTE_DB="<neon direct host>" \
DATABASE_URL_UNPOOLED="<neon direct url>" \
DATABASE_URL="<neon pooled url>" \
pnpm db:migrate
```

Then confirm, read-only, in the Neon SQL editor:

```sql
select hash, created_at from drizzle.__drizzle_migrations order by created_at desc limit 3;
-- expect, newest first:
--   2759dc0d1b20936cc02e6c278f9110de710f415fce0020ddb4a99cab89edd45e  1792654408285  (0007)
--   950b5caa85187dc312cda24b4d6f231c70ac0b92de2a935bf8c31a9ba930f195  1792648611250  (0006)
--   3904d680b92ffa168de81b6d5df91fa9dd6566f8d312cd7061d4cf17ac3b649f  1792613449443  (0005)
select to_regclass('public.request_limits'), to_regclass('public.review_cards'), to_regclass('public.review_log');
select count(*) from information_schema.columns
 where table_name = 'examples' and column_name like 'practice_%'; -- expect 3
```

Production keeps running `v0.4.0` normally after this.

## 4. Import the Phase 5 content (owner-run)

The content in `content/` now carries the Step 3b accept lists. Import it from the same commit, still before labelling:

```bash
git status --short content   # must print nothing

LEXORA_ALLOW_REMOTE_DB="<neon direct host>" \
DATABASE_URL_UNPOOLED="<neon direct url>" \
DATABASE_URL="<neon pooled url>" \
pnpm content:import
```

The import validates first and writes in one transaction: it fully succeeds or changes nothing. `v0.4.0` ignores the new practice columns, so this is safe before the deploy. Then confirm, read-only:

```sql
select count(*) filter (where status = 'published') from language_items;                   -- 40
select count(*) from senses where status = 'published';                                    -- 42
select count(*) filter (where cardinality(practice_accept) > 0),
       count(*) filter (where cardinality(practice_accept_preposition) > 0),
       sum(cardinality(practice_accept) + cardinality(practice_accept_preposition))
  from examples;                                                                            -- 26 | 5 | 33
select count(*) from examples;                                                              -- 103
select count(*) from mistakes;                                                              -- 56
select id, git_sha, imported_at from content_releases order by id desc limit 1;            -- this commit
```

This order supersedes spec §31's "import immediately after the deploy": importing first means the first learner sees the full accept lists.

## 5. Confirm production email (owner check)

Production refuses to start without `RESEND_API_KEY` and `EMAIL_FROM` (README → Account email check).

- Vercel → Project → Settings → Environment Variables → Production: `EMAIL_FROM` is `Lexora <account@your-domain>` on a domain **verified** in Resend (Resend → Domains), not the test sender `onboarding@resend.dev`.
- Click and open tracking are off for that domain.
- If the domain isn't verified yet, record it as unresolved (spec O2): accounts work, but only the Resend account owner receives verification and reset emails.

## 6. Confirm the public search rate limit (owner check)

Public search must be limited to 120 requests a minute per IP at the edge (D17). The rule and its CLI equivalent are in README → Search rate limit (Vercel Firewall).

- Vercel → Project → Firewall: a published rule on paths `/explore` and `/finder` with query `q`, fixed window 60 s, 120 requests, key IP, action 429.
- Optional check from one IP after it's published: 130 requests to `/explore?q=important` give about 120 × `200` and the rest `429`.

## 7. Deploy

Add `owner-approved` to the phase PR `phase/5-retrieval-loop` → `main`. CI runs the full suite again on that commit, merges, tags the release, and Vercel deploys `main`.

## 8. Smoke test after the deploy

Use a real account on the production site. Where a step needs a database check, run the read-only query in the Neon SQL editor.

### Public

- [ ] The landing page loads and its closing call to action says a free account "brings it back for review when it's due".
- [ ] `/explore` loads; an ordinary search and a gap query ("Governments should ___ more money into public transport") return results; "express contrast" and "for example" behave as fixed in Step 0.
- [ ] A language page (`/language/significant`) loads for a visitor; nothing asks to sign in until saving.

### Authentication and saving

- [ ] Sign up and sign in work; the verification email arrives (if §5 is resolved).
- [ ] As a visitor, _Save_ opens the save gate ("…save language and review it when it's due"); signing up from it returns to the page and completes the save.
- [ ] The notice reads "Saved “term” to your language bank. It's ready to review." and _Open language bank_ opens `/bank`.

### Language bank

- [ ] The saved meaning is under _Ready to review_ as New, "Due now".
- [ ] Removing it says "…Its review history is kept." and it leaves the bank. After answering one first, its history stays:
      `select count(*) from review_log where user_id = '<your user id>';` doesn't drop after the removal.

### Practice

- [ ] `/practice` shows the due meaning's first exercise.
- [ ] A correct answer says _Correct_ and "Next review in 1 day"; the meaning moves to _Coming up_ in the bank.
- [ ] For a wrong answer, the card goes to box 1 (`select box, reviews, lapses from review_cards where user_id = '<your user id>';`).
- [ ] A double click on _Check_ records one answer (`review_log` gains one row, not two).
- [ ] Revisiting `/practice` after answering shows "Nothing is due right now" (the answered card isn't due again).

### Mistake evidence

This needs two reviews of one meaning, at least a day apart.

- [ ] The same wrong answer on the same meaning twice shows "You've made this mistake 2 times in the last 30 days" in the feedback, with the authored explanation.
- [ ] The bank row shows it as "Your mistake", with "Missed 2 times".

### Home

- [ ] `/home` shows the real saved count, "n meanings are ready to review" or the next review, the latest saves and, when present, the recurring mistake.
- [ ] No sample data, percentages, streaks or "Prototype" badge appear anywhere; Progress isn't in the sidebar.
- [ ] A signed-out `POST /api/review/answers` answers 401.

## 9. Rollback

- **Application:** use Vercel Instant Rollback to the last `v0.4.0` deployment. The Phase 5 schema stays: it is additive, and `v0.4.0` ignores it, so no schema rollback is needed and none is provided.
- **Content:** check out the earlier commit and import again (README → Content). IDs never change, so saved language survives either way.
- **Never** drop tables, reset branches or edit `drizzle.__drizzle_migrations` to roll back. A later re-deploy would need them, and editing migration history breaks every future migration.
