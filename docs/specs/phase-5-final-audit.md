# Phase 5 — Final audit: Retrieval Loop

Written: 24 October 2026 · Audited: `phase/5-retrieval-loop` at `b93843a` (PRs #39–#48 merged) · Status: **code-complete; ready for owner approval, subject to the owner actions in §9**

This records the final read-only audit of Phase 5 and what remains before production. The release procedure is in [phase-5-release-runbook.md](phase-5-release-runbook.md). The approved specification is [phase-5-retrieval-loop.md](phase-5-retrieval-loop.md); each step's _As built_ notes there record where the implementation differs from it.

## 1. Summary

Phase 5 closes the learning loop: **find → understand → save → review → learn from mistakes → review again.** Saved meanings get a review card; they come back on a five-box Leitner schedule as exercises built only from authored content; answers are checked on the server; repeated mistakes become personal evidence; and Home, the bank and the save flow say only what is true.

There are **no release blockers** in the code. Production still needs the owner-run steps in §9, above all applying migrations 0005–0007 before the merge to `main` deploys.

## 2. Steps

| Step                                                             | PR      | Merge commit |
| ---------------------------------------------------------------- | ------- | ------------ |
| Specification                                                    | #39     | `338b60d`    |
| 0 — hardening (search fixes, write limits, local-database guard) | #40     | `4349b69`    |
| 1 — scheduler and review data model (spec Steps 1–2)             | #41     | `9ce50fb`    |
| 3a — deterministic exercise generator                            | #42     | `7067d9e`    |
| 3b — authored accept lists                                       | #43     | `704e63c`    |
| 4 — language bank                                                | #44     | `113de01`    |
| 5 — review session                                               | #45     | `b2cbf6e`    |
| 6 — personal mistake evidence                                    | #46     | `b79067b`    |
| 7 — honest Home                                                  | #47     | `5feea1a`    |
| 8 — save and review copy                                         | #48     | `b93843a`    |
| 9 — this audit and the release runbook                           | this PR | —            |

## 3. What was built (verified in code)

- **Scheduler** (`src/learning/scheduler.ts`, pure): box 0 is new and due when saved; correct → one box up (at most 5); wrong → box 1. The next review is the answer time plus 1, 3, 7, 14 or 30 days, as fixed 24-hour multiples. `isDue` is `dueAt ≤ now`, the same rule the bank, queue and evidence SQL use. Statuses (new, due, learning, known, retired, no exercise yet) are derived in `status.ts`, never stored.
- **Cards and history:** `review_cards` is one per saved sense (`unique (user_id, sense_id)`, composite FK to `saved_senses` with cascade, so removing a save deletes its card). Saving again keeps the schedule (`on conflict do nothing`). `review_log` is append-only with `unique (card_id, review_number)` and no FK to the card, so a learner's history survives removing a save; a later re-save starts a new card at box 0.
- **Answers** (`POST /api/review/answers`): same origin → session → 30 a minute per learner → strict Zod body (≤ 2 KB; `userId`, verdicts and card ids are refused). In one transaction with the card locked: not saved (404), retired, duplicate or stale, not due (409), then the exercise regenerated for the review number (`exercise_changed`), the answer checked by `evaluateAnswer` (`invalid_answer`), scheduled and logged once. A retry returns the stored result; refusals record nothing.
- **Exercises** (`src/learning/exercises.ts`, `answers.ts`, pure): complete the sentence, type the preposition and which is correct, generated at request time from authored examples, patterns and mistakes. Order and option order are deterministic. Keys never reach the browser, and typed prompts omit the headword. An answer is correct only as the expected answer, another authored form or an authored `accept` value; normalisation is case, apostrophes, spaces and end punctuation only.
- **Mistake evidence** (`recurringMistakes`, D14): no table. The same wrong response (the matched authored mistake, otherwise the exact normalised typed answer) on one sense at least twice in the 30 days before `now`, exclusive, unless the sense's two latest answers are correct and after it. Read from `review_log` only, so only recorded answers count.
- **Bank** (`/bank`): every saved meaning with its definition, pattern, example, status and next review, in three sections and a deterministic order, 50 per page; recurring mistakes and "Missed n times"; _Start review_ when something is ready.
- **Practice** (`/practice`): up to five due meanings with an exercise; feedback only from the server's recorded answer and authored text.
- **Home** (`/home`): counts, readiness and next review, the four latest saves and up to three recurring mistakes, all from the learner's data. `src/demo/` is gone; Progress is out of the navigation, and `/progress` stays an honest placeholder.
- **Save flow:** the save response says `review: "ready"` only when the card is due now; the notice says so and links to the bank; removing says the review history is kept, which it is. The save gate and landing promise only a bank and review when it's due.
- **Boundaries:** `/`, `/explore`, `/language/*` and the auth pages stay public and import no server code (ESLint, route-boundary E2E). Saving is the only sign-in gate. Every personal page calls `requireSession()`; every write authenticates itself and checks the origin; ids come from the session.
- **Database safety:** migrations, the content import and the tests refuse any non-local database unless `LEXORA_ALLOW_REMOTE_DB` names its host for that one command (`scripts/database-target.ts`). Only `.env.example` is committed.

## 4. Verification (local, at `b93843a`)

All of this ran on the local Docker PostgreSQL. Nothing here verifies production.

| Check                                                | Result                                                                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `CI=true pnpm test`                                  | 1187/1187 in 62 files                                                                                      |
| `pnpm test:e2e` against `pnpm build` + `pnpm start`  | 236/236 in 13 files                                                                                        |
| `pnpm content:check`                                 | 40 items, 42 senses; 178 exercises: 77 complete the sentence, 45 type the preposition, 56 which is correct |
| `pnpm content:check --practice`                      | every accepted answer reaches its key; accept lists on 31 exercises, 33 accepted answers                   |
| Content status                                       | 40 of 40 items published; no drafts or retired items                                                       |
| `pnpm lint`, `pnpm typecheck`, `pnpm build`          | pass                                                                                                       |
| `pnpm format:check`                                  | passes on every tracked file (two untracked personal notes are outside the repository's files)             |
| Golden suite and ranking snapshot                    | byte-identical to `main`; Step 0's cases are separate (`test/step-0-cases.ts`)                             |
| Schema drift (CI: fresh migrate, then `db:generate`) | no drift                                                                                                   |
| CI on every Phase 5 PR                               | `verify` and GitGuardian green                                                                             |

**Browser (Chrome, local production build):** no horizontal overflow at 390, 430, 768, 1024, 1280 and 1440 px on `/`, `/explore?q=important`, `/language/significant`, `/sign-up`, `/home`, `/bank`, `/practice`, `/finder`, `/progress` and `/settings`. The save gate fits at 390 px and takes focus; keyboard focus rings are visible; Progress is absent from the sidebar and command palette; a real recurring mistake shows its authored text and count.

**Latency** (20 warm runs, full HTTP round trips including render; budget: server time p95 ≤ 100 ms):

| Request                  | p50     | p95     |
| ------------------------ | ------- | ------- |
| `GET /home`              | 34.8 ms | 57.5 ms |
| `GET /bank`              | 37.6 ms | 51.1 ms |
| `GET /practice`          | 28.1 ms | 33.5 ms |
| save + remove (a pair)   | 43.2 ms | 47.7 ms |
| answer (duplicate retry) | 29.2 ms | 32.7 ms |

## 5. Statements per request

Spec §32 set statement targets; the built counts are higher because statuses and feedback read authored content, as the steps' _As built_ notes record. Every list is bounded, nothing scans the review history, there is no N+1, and latency is well inside the budget. The query-count assertions §29 planned were not written.

| Request          | Target | Built                                                                                                      |
| ---------------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| Home             | ≤ 3    | 9: counts, next review, recent saves, recurring mistakes; practice material (4) and slugs                  |
| Bank page        | ≤ 3    | 7: counts, one page of rows, practice material (4), recurring mistakes                                     |
| `/practice`      | ≤ 5    | 5: selection, practice material (4); 2 more only when nothing is due                                       |
| Submit an answer | ≤ 8    | 10–11: limit, material (4), slug and best-when, card upsert, lock, update, log; evidence on a wrong answer |
| Save a sense     | ≤ 4    | 5: limit, published check, save and card (one transaction), the card's due state                           |

## 6. Intentional and accepted

- Routes stay as built: `/` is the public landing, `/home` the learner's Home, `/explore` public search, `/finder` the signed-in Finder, `/bank` the bank, `/practice` review, `/language/[slug]` the content. Progress is unlisted (D20).
- Owner-approved: the statement counts above; "Welcome to Lexora" for a first-time learner; the bank's "n due" counted by schedule; readable authored ids in the page; typed exercises focusing their input; evidence derived from the log, with repeated typed answers counting.
- Per the spec: recurring mistakes and recently saved are hidden when empty; practice renders without a skeleton so the exercise is in the checked HTML.
- An answer that isn't one (`!!!`) creates the card it would have created anyway, and records nothing else.
- "Its review history is kept" also shows for a meaning never reviewed (its history is empty).
- `/design-system` shows labelled static sample data.

## 7. Known non-blocking issues

1. The query-count assertions from §29 don't exist (§5).
2. `NavEntry.prototype` and the top bar's Prototype badge are no longer used by any screen.
3. `src/lib/analytics-privacy.ts` still allows `?step=` on `/practice`, which nothing produces any more.
4. The design-system sidebar and palette specimens still list Progress.
5. Editorial items from Step 3b, for a content pass: "growing concern for" marked wrong; "very crucial" and "very essential" marked wrong (a prescriptive rule); the `for instance` mistake whose correction uses "such as".

None affects correctness, security or learner data.

## 8. Definition of done (spec §39)

Items 1–13, 16, 17 and 19 are met in code and verified locally. Item 14 is met in the app (per-learner limits on saves, removals and answers); its public search limit at the edge is an owner action. Items 15 and 18 depend on the owner: the email status and following the runbook.

## 9. Owner actions before and around production

Not done and not verified by this audit. The [runbook](phase-5-release-runbook.md) gives the commands.

1. **Identify the Neon branch** affected by the 21 October incident and run the read-only checks (runbook §2).
2. **Apply migrations 0005–0007** to production with the direct Neon URL, before the merge to `main` (runbook §3). Required: saving writes a review card, and the bank, Practice and Home read the review tables, so code deployed before the schema would break them.
3. **Import the content** from the release commit (runbook §4).
4. **Confirm `EMAIL_FROM` and Resend** (O2, runbook §5).
5. **Confirm the Vercel Firewall** public search rule (D17, runbook §6).
6. **Approve the phase PR** with `owner-approved`, then run the **smoke test** (runbook §8).
