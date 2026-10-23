# Phase 5 — Retrieval Loop: specification

Written: 21 October 2026 · Baseline: `main` at `d0b8c09` (`v0.4.0`, Phase 4 complete) · Integration branch: `phase/5-retrieval-loop` · Status: **approved** (PR #39); built step by step (§38), with each step's _As built_ notes there.

> Saved language should come back at the right time.

The decisions in §37 are **proposed**. They become approved only when the owner approves this specification. Steps are built one at a time (§38), and nothing starts before that approval.

---

## 1. Executive summary

Lexora finds the right English and explains why it fits. It doesn't yet help a learner **remember** it. A learner can save a meaning, but the language bank is a placeholder, Practice is a fixed five-question demo, and Home shows sample data.

Phase 5 closes that loop with deterministic, authored-content-only machinery:

- a **real language bank** listing saved meanings with their review state;
- **short review sessions** (5 items by default) built from the examples, preposition patterns and mistakes already authored for each meaning;
- **three exercise types**: complete the sentence, type the preposition, choose the correct version;
- a **Leitner scheduler** with five boxes (1, 3, 7, 14 and 30 days), pure and explainable: a correct answer moves an item up a box, a wrong one sends it back to box 1 (tomorrow);
- **personal mistake evidence** from the learner's own repeated wrong answers on authored exercises;
- an **honest Home** with only persisted numbers;
- a **save flow** that says what happens next;
- the small **production hardening** the post-Phase-4 review found.

There's no AI, no generated sentences and no inferred synonyms: where more than one answer is right, the content says so in an authored `accept` list.

The audit (§5) shows the current 40 items and 42 senses support this today. All 42 senses yield at least one exercise, 39 of them at least two exercise types, for 178 candidate exercises in total. One bounded editorial pass is needed: authored accept lists on the sentence-completion examples whose blank has near-synonyms.

## 2. Problem statement

The product promise has three parts. Phase 3 and Phase 4 delivered the first two, for the language Lexora covers:

1. **Find the English you mean.** Search, intents, prepositions, collocations, context gaps.
2. **Use it naturally.** Reasons, patterns, examples, mistakes, fit verdicts.
3. **Remember it when it matters.** **Not implemented.**

Today a save is stored (`saved_senses`), and then nothing happens. No screen lists it, nothing brings it back, and no answer is ever recorded.

Production copy already promises more than the product does:

- the landing page CTA: "brings it back for practice, and shows how your recall is growing";
- the save gate: "practise it later, and track your progress".

The signed-in Home shows "12 items to review" from `SAMPLE_LEARNER` beside the learner's real name.

## 3. Product goal

Every meaning a learner saves comes back as a short, authored retrieval exercise when it's due. What they get right comes back later; what they get wrong comes back sooner. Lexora tells them, truthfully, what it knows about their recall.

## 4. User outcome

After Phase 5, a signed-in learner can:

1. search "better word for important", understand the result, and save _significant_ ("having a real effect");
2. see "Saved to your language bank — ready to review" and find it in **Language bank** as _New_;
3. start a review and complete "There was a ___ increase in the number of cyclists…" (typing _significant_; _considerable_ and _substantial_ are also accepted because the content says so);
4. get immediate, authored feedback and "Next review in 1 day";
5. come back later and find it under _Due_;
6. after choosing "responsible of" twice, see "You chose _responsible of_ 2 times → responsible for" on Home and in the bank;
7. see on Home how many meanings are due, new, learning and known, with no invented numbers.

## 5. Current-state audit

Audited on `main` at `d0b8c09`. The probe scripts ran outside the repository, over the published content, with the test suite's in-memory repository.

### A. `saved_senses` (`src/server/db/schema/bank.ts`, migration `0003`)

| Property        | Fact                                                                                                                                                                                                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Columns         | `user_id text`, `sense_id text`, `saved_at timestamptz default now()`                                                                                                                                                                                                                                                                       |
| Key             | Composite primary key `(user_id, sense_id)`: a sense is saved at most once per learner. There is no surrogate id                                                                                                                                                                                                                            |
| Ownership       | `user_id → users.id` **on delete cascade**                                                                                                                                                                                                                                                                                                  |
| Content link    | `sense_id → senses.id` **on delete restrict**: the database refuses to delete a saved sense (senses are retired, never deleted, decision #40)                                                                                                                                                                                               |
| Index           | `saved_senses_user_saved_at_idx (user_id, saved_at)`                                                                                                                                                                                                                                                                                        |
| Retired content | A save made before a sense is retired is kept and can be removed; a retired sense can't be saved anew (decision #48). `listSavedSenseIds` keeps retired saves listed                                                                                                                                                                        |
| Repository      | `src/server/repositories/saved-senses.ts`: `listSavedSenseIds`, `savedAmong` (bounded batch), `countSavedSenses`, `saveSense` (checks the sense and its item are published, `insert … on conflict do nothing`), `removeSavedSense` (**hard delete**). All take `userId` explicitly                                                          |
| Endpoints       | `GET /api/bank/saved?senses=` (max 60), `PUT` / `DELETE /api/bank/saved/[senseId]`. They check `isSameOrigin` then `getRequestSession`, validate the sense id with Zod (`SENSE_ID_PATTERN`) and use `guarded` (503 on failure, without details). There's a 401 that first checks the database, so an outage isn't mistaken for "no session" |
| Client          | `SavedLanguageProvider` (`src/components/language/saved-language.tsx`): optimistic toggle, corrected by the server; a calm bottom notice ("Saved “…” to your language bank."); the save gate for visitors with a 30-minute `sessionStorage` pending save                                                                                    |

### B. Language content that can support practice

The content has 40 published items and 42 senses: word 11, linker 11, preposition pattern 7, collocation 6, sentence pattern 2, functional expression 2, phrase 1.

| Structure                    | Count                                                                          | Practice use                                               | Notes                                                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Examples                     | 103 (28 speaking)                                                              | Sentence prompts                                           | Every sense has at least 2. `highlight` phrases are converted to spans at import (`examples.highlights jsonb`). Examples can link to a collocation or a preposition pattern of the same sense |
| Item forms                   | 99                                                                             | Locating the blank; accepting inflections and US spellings | Types: lemma, inflection, spelling variant, contraction. Forms belong to the **item**, not the sense                                                                                          |
| Preposition patterns         | 29 on 23 senses                                                                | Preposition recall                                         | `base`, `preposition`, display `pattern`, `complement`, optional `mistake` (local id of the mistake it prevents)                                                                              |
| Examples linked to a pattern | 47                                                                             | Preposition recall                                         | 45 end their highlight with the pattern's preposition; 2 don't (they can't be used)                                                                                                           |
| Mistakes                     | 56 on 38 senses                                                                | "Which is correct?" and feedback                           | `wrong`, `right`, `type`, `explanation`; no link to examples. Shapes: 47 substitution, 4 extra words, 1 missing word, 4 punctuation only                                                      |
| Relations                    | 32 authored (inverses written at import)                                       | **Not used as answer acceptance** (§13)                    | Relations say two senses are related, not that one fits another's sentence                                                                                                                    |
| Collocations                 | 39                                                                             | Indirectly, through examples                               | Collocation text alone gives no sentence context                                                                                                                                              |
| Frames                       | 6                                                                              | Not used in Phase 5                                        | Verb-frame fit belongs to the protected Phase 4 engine                                                                                                                                        |
| `best_when` / `avoid_when`   | On every sense                                                                 | Feedback text                                              | Prose, not structured evidence                                                                                                                                                                |
| IDs                          | Item `kebab-case`; sense `<item>.<key>`; example and mistake `<sense>:<local>` | Stable exercise IDs                                        | Permanent once published (content/README → IDs never change)                                                                                                                                  |

**Exercise feasibility, measured with the rules in §12:**

| Exercise                             | Senses                                             | Candidate exercises |
| ------------------------------------ | -------------------------------------------------- | ------------------- |
| Complete the sentence (term)         | 34 (every sense not of kind `preposition_pattern`) | 77                  |
| Type the preposition                 | 23                                                 | 45                  |
| Which is correct? (authored mistake) | 38                                                 | 56                  |
| **Any type**                         | **42 / 42**                                        | **178**             |
| Two or more types                    | 39 / 42                                            | —                   |

- **Only one type:** _significant_ ("in statistics"), _on top of that_ and _what's more_. Each has 2 completion exercises.
- **Not usable for completion:** 4 examples where the authored form is split by another word ("take **urgent** measures", "pose a **serious** threat"). §12 explains how they're excluded.

**Verified against the post-Phase-4 review's estimate.** The estimate was "40/42 senses have at least two highlighted examples plus mistakes/relations". That was a proxy, and it's superseded by the table above: 42/42 senses can generate at least one exercise.

**Ambiguity risk:** 64 of the 77 candidate completion examples belong to the 27 senses that have a near relation (synonym, alternative, stronger, more formal). Their blanks may accept other answers. For example, "There was a ___ increase" also takes _considerable_ and _substantial_. They need the editorial accept pass in Step 3b; nothing is inferred.

### C. Practice (`/practice`)

- **What's real:** nothing is persisted. `src/features/practice/practice-session.tsx` (595 lines) renders `PRACTICE_SESSION` from `src/demo/practice.ts`: five fixed, hand-written questions with options and explanations embedded in the file, plus a `?step=` deep link.
- **What's demo:** everything. The top bar marks it "Sample session — answers aren't saved" (`navigation.ts`).
- **Reusable:** the **interaction design** and presentational components. These are `lexora/gap-sentence`, `lexora/choice-option` (with an _acceptable_ state), `lexora/progress-track`, the feedback `Callout`, number-key choice, focus on the question heading, and the summary layout (DESIGN §9.15, §10.3).
- **Not reusable:** the question data, the question types bound to sample content, and `getLanguageItem` from `src/demo/language.ts`.
- **API / schema:** there's none to keep. Practice has never had an endpoint or a table.

### D. Home (`/home`)

| Element                                                                                                  | Source                                                     |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| First name, unverified-email reminder                                                                    | Real (session)                                             |
| "n meanings saved" in Quick actions                                                                      | Real (`countSavedSenses`)                                  |
| Header badge "Sample learner data"; "This week: linkers and prepositions…"                               | `SAMPLE_LEARNER.focus`                                     |
| "12 items to review · about 8 minutes", progress 4/12                                                    | `SAMPLE_LEARNER.review`                                    |
| Needs attention (3 weak areas)                                                                           | `SAMPLE_LEARNER.weakAreas`                                 |
| Continue learning (4 rows)                                                                               | `SAMPLE_LEARNER.continueLearning` + `src/demo/language.ts` |
| Recent mistakes (3)                                                                                      | `SAMPLE_LEARNER.mistakes`                                  |
| Quick action "Practice now — Five questions, about 4 minutes"; "Review mistakes — 3 corrections waiting" | Hard-coded                                                 |

With Phase 5, the due count, new/learning/known counts, recurring mistakes and recently saved can all become real. Weekly focus, weak _categories_, minutes and percentages can't: there's no evidence model for them, and they stay out (§18).

### E. Bank (`/bank`)

`src/app/(app)/bank/page.tsx` renders `RoutePlaceholder id="bank"` ("Not built yet", Phase 5 plans). Keep the route, the nav entry, the title and `PageContainer` / `PageHeader`. The placeholder component remains for Writing, Speaking and Progress.

### F. Auth and security

| Aspect        | Fact                                                                                                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Boundary      | `proxy.ts` checks only that a cookie exists. `(app)/layout.tsx` calls `requireSession()` (database-validated). Pages and actions call `requireSession()`; route handlers call `getRequestSession(request)` and answer 401 |
| User identity | Always `session.user.id`. Repositories take `userId` explicitly. Only `SafeUser` crosses to client components                                                                                                             |
| CSRF          | Server actions: Next.js. Route handlers: `isSameOrigin()` against `APP_ORIGINS`                                                                                                                                           |
| Validation    | Zod in every action and handler (`senseIdSchema`, settings schemas)                                                                                                                                                       |
| Mutations     | Settings: server actions with typed `FormState`. Saves: a route handler (public pages can't import server code)                                                                                                           |
| Rate limiting | Better Auth only (database storage, auth endpoints). **No rate-limit utility exists for Lexora's own endpoints**, and there's no search limit (Phase 4 Step 6 was never built)                                            |

### G. Search defects in scope for Step 0

1. **"for example" is shown as a mistake.**
   - **Behaviour:** `/explore?q=for+example` → "“for example” is a common mistake — here is the correct form", showing only _such as_. Confirmed in production.
   - **Root cause:** `showsMistake` (`src/language/search/match.ts:187`). The authored mistake `such-as.example:for-example` ("such as **for example** Japan" → "such as Japan") is an _extra-words_ mistake whose differing span is exactly "for example". A query covering only that span counts as showing the mistake. The other three extra-word mistakes have one-word spans ("about", "also", "very"), already blocked by the one-word rule in `findMistakes`.
2. **Bare intent phrasings fall back.**
   - **Behaviour:** "express contrast", "describe an increase", "give an example", "show a result", "add a point" → labelled full-text fallback. Confirmed in production for "express contrast".
   - **Root cause:** all 46 authored triggers classify as `LOOKUP` (`classify.ts:205` reaches intents only behind "I want to / how to / phrase for …"). The exact-trigger branch in `matchIntent` (`trigger === phrase`) is never reached for a bare query.
   - **Golden impact:** none of the 71 golden queries or the snapshot's example searches equals a trigger (checked), so an exact-trigger route can't change a protected case.

## 6. Scope

1. A real language bank (`/bank`).
2. Deterministic review sessions (`/practice`, replacing the demo).
3. A deterministic Leitner scheduler (a pure module).
4. Personal mistake evidence from review history.
5. An honest Home: no sample data.
6. Save → review feedback in the save flow and copy.
7. Three authored exercise types, with authored accept lists.
8. Step 0 hardening: the two search fixes, rate limiting, the email status audit, stale docs.
9. Accessibility and responsive behaviour for every new screen.
10. Ownership, idempotency and rate-limit protections.
11. Documentation updates (ROADMAP, ARCHITECTURE, DESIGN, content/README).
12. Full regression protection for Phase 4 behaviour.

## 7. Explicit non-goals

Each one is classified, so attractive work doesn't drift in.

| Not in Phase 5                                                                                 | Class                                           |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| AI, LLMs, embeddings, semantic search, generated sentences or exercises                        | Deferred (Phase 9, optional)                    |
| "Which expression fits?" (choosing between related senses)                                     | Phase 6 (needs authored negative evidence, §11) |
| Typed whole-sentence correction, collocation drills, register switch, timed or other modes     | Phase 6                                         |
| Writing Lab, Speaking Lab, scanning learner text for mistakes                                  | Phase 7 / Phase 8                               |
| Official IELTS scoring, band predictions, mastery percentages                                  | Deferred (never without evidence)               |
| Streaks, badges, XP, leaderboards, confetti                                                    | Never (UX_PRINCIPLES anti-patterns)             |
| Reminders, email or push notifications                                                         | Deferred (needs the email domain and consent)   |
| Custom decks, folders, tags, sharing, imports, notes, learner-authored sentences               | Deferred                                        |
| Charts, a full Progress dashboard                                                              | Phase 6+ (`/progress` stays a placeholder)      |
| Reviewing items before they're due ("practise anyway")                                         | Phase 6                                         |
| Capping intervals before the learner's test date                                               | Phase 6 (uses `learner_profiles.test_date`)     |
| Bank state on search result cards and language pages ("next review in 3 days")                 | Phase 6                                         |
| Sense labels on same-word rows in search (UI-2)                                                | Phase 6 / polish                                |
| Context-gap engine work: word roles (F4), names, sentence-final linkers, whole-sentence checks | Future engine                                   |
| Unmatched-query logging, result caching, indexable task/function pages                         | Infrastructure / Phase 6                        |
| Wave 2 content inside feature PRs                                                              | Content (separate stream, §28)                  |

## 8. Existing architecture dependencies

| Phase 5 relies on                                 | Where                                                                                                             | How                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `saved_senses` as the source of ownership         | `src/server/db/schema/bank.ts`                                                                                    | Review cards hang off it with a composite FK (§9)                    |
| Published content in PostgreSQL                   | `src/server/db/schema/language.ts`, `content:import`                                                              | Exercises are generated from imported rows; the app never reads YAML |
| The language repository (read-only, no user data) | `src/server/repositories/language` via `@/language`                                                               | Adds one bounded read, `practiceMaterial(senseIds)`                  |
| Normalisation                                     | `src/language/normalise.ts` (`normaliseTerm`)                                                                     | Answer comparison uses the same normalisation as search              |
| Mistake span logic                                | `src/language/search/match.ts` (`mistakeWrongPart`)                                                               | Recognising the learner's wrong answer as an authored mistake (§12)  |
| Session and origin guards, JSON helpers           | `src/server/auth/session.ts`, `src/server/http/same-origin.ts`, `src/app/api/bank/saved/http.ts`                  | The review endpoint follows the save endpoint's pattern              |
| Presentational components                         | `lexora/gap-sentence`, `choice-option`, `progress-track`, `mistake-row`, `language-row`, `callout`, `empty-state` | Bank, review and Home                                                |
| E2E harness                                       | `e2e/global-setup.ts` (two learners signed up over HTTP), HTTP checks against a production build                  | Retrieval-loop E2E (§29)                                             |
| Lint boundaries                                   | `eslint.config.mjs`                                                                                               | A new rule for `src/learning/**` (§23)                               |

## 9. Data model

Three additive migrations, each generated with `pnpm db:generate`. **No existing table loses or changes a column, and no data is rewritten or backfilled.**

### 9.1 `review_cards`: scheduling state (Step 2)

One card per learner × saved sense.

| Column                     | Type                                               | Notes                                                                   |
| -------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------- |
| `id`                       | `uuid` PK, `default gen_random_uuid()`             | Survives in `review_log` after the card is gone                         |
| `user_id`                  | `text not null`                                    |                                                                         |
| `sense_id`                 | `text not null`                                    |                                                                         |
| `box`                      | `smallint not null default 0`, check `0 ≤ box ≤ 5` | 0 = new (never answered)                                                |
| `due_at`                   | `timestamptz not null`                             | New cards: the save time                                                |
| `reviews`                  | `integer not null default 0`                       | Answers recorded on this card; drives idempotency and exercise rotation |
| `lapses`                   | `integer not null default 0`                       | Wrong answers on this card                                              |
| `last_reviewed_at`         | `timestamptz`                                      |                                                                         |
| `created_at`, `updated_at` | `timestamptz not null default now()`               |                                                                         |

**Constraints:**

- `unique (user_id, sense_id)`;
- `foreign key (user_id, sense_id) references saved_senses (user_id, sense_id) on delete cascade`;
- index `(user_id, due_at)`.

There's no separate FK to `users` or `senses`. Both arrive through `saved_senses` (cascade for users; restrict for senses), so ownership isn't duplicated.

### 9.2 `review_log`: one immutable row per answer (Step 2)

| Column                    | Type                                                                            | Notes                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `id`                      | `uuid` PK                                                                       |                                                                                                         |
| `user_id`                 | `text not null → users.id on delete cascade`                                    | Needed because history outlives the card (§9.4). It's the only duplicated identity, and it's deliberate |
| `card_id`                 | `uuid not null` (**no FK**)                                                     | The card this answer belonged to                                                                        |
| `sense_id`                | `text not null → senses.id on delete restrict`                                  |                                                                                                         |
| `review_number`           | `integer not null`                                                              | 1-based (`reviews` after the answer); `unique (card_id, review_number)` is the idempotency key          |
| `exercise_id`             | `text not null`                                                                 | Stable exercise id (§11.2); no FK, because content can change                                           |
| `exercise_type`           | enum `review_exercise_type` (`term`, `preposition`, `mistake`)                  |                                                                                                         |
| `outcome`                 | enum `review_outcome` (`correct`, `incorrect`)                                  | What the scheduler used                                                                                 |
| `answer_match`            | enum `answer_match` (`expected`, `form`, `accepted`, `mistake`, `unrecognised`) | How the answer was read (§13)                                                                           |
| `answer`                  | `text` (≤ 80), nullable                                                         | The learner's normalised typed answer; `null` for choices                                               |
| `expected`                | `text not null`                                                                 | The preferred answer shown in feedback, so evidence never regenerates old exercises                     |
| `mistake_id`              | `text`, nullable (no FK)                                                        | The authored mistake the answer matched                                                                 |
| `box_before`, `box_after` | `smallint not null`                                                             | Audit trail                                                                                             |
| `due_after`               | `timestamptz not null`                                                          |                                                                                                         |
| `reviewed_at`             | `timestamptz not null default now()`                                            |                                                                                                         |

**Indexes:**

- `(user_id, reviewed_at desc)`;
- `(user_id, sense_id, reviewed_at desc)`.

### 9.3 `request_limits`: per-user write limits (Step 0)

| Column         | Type                                                  | Notes            |
| -------------- | ----------------------------------------------------- | ---------------- |
| `user_id`      | `text → users.id on delete cascade`                   | PK with `action` |
| `action`       | enum `limited_action` (`bank_write`, `review_answer`) |                  |
| `window_start` | `timestamptz not null`                                | Minute bucket    |
| `count`        | `integer not null`                                    |                  |

One row per learner per action. Rows are bounded and need no clean-up (§21).

### 9.4 Lifecycle decisions

| Event                                          | Effect                                                                                                                                                                                                                                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Save** (new app)                             | One transaction: insert `saved_senses` (on conflict do nothing), insert `review_cards (box 0, due_at = now)` (on conflict do nothing)                                                                                                                                              |
| **Saves made before Phase 5**                  | They have no card. Every read **left-joins** `saved_senses → review_cards` and treats a missing card as _New_, due since `saved_at`. The first answer inserts the card inside its transaction. So no data migration is needed, and the gap between migrating and deploying is safe |
| **Remove**                                     | Deleting the `saved_senses` row cascades to the card. `review_log` rows are **kept**: they're the learner's history and the source of mistake evidence                                                                                                                             |
| **Save again**                                 | A new card at box 0. History stays and still counts as evidence                                                                                                                                                                                                                    |
| **Sense or item retired**                      | The save and card are kept. The bank shows _No longer reviewed_ (with "Replaced by …" when `replaced_by` is set); selection skips it; an answer is refused (`409 retired`). Nothing is migrated automatically                                                                      |
| **Account deleted**                            | Cascades through `users` to `saved_senses`, `review_cards`, `review_log` and `request_limits`                                                                                                                                                                                      |
| **Duplicate save**                             | Impossible: the PK and `unique (user_id, sense_id)`                                                                                                                                                                                                                                |
| **Content edit removes an example or mistake** | The exercise disappears from generation. Old log rows keep their `exercise_id` and `expected`. A pending answer to it gets `409 exercise_changed`, and the session moves on                                                                                                        |

## 10. Scheduler design

A pure module, `src/learning/scheduler.ts`. It has no React, Next.js, database or clock access: `now` is a parameter.

### 10.1 Algorithm: Leitner, five boxes

| Box | Meaning             | Interval after reaching it    |
| --- | ------------------- | ----------------------------- |
| 0   | New, never answered | Due when saved                |
| 1   | Learning            | 1 day                         |
| 2   | Learning            | 3 days                        |
| 3   | Learning            | 7 days                        |
| 4   | Known               | 14 days                       |
| 5   | Known               | 30 days (the Phase 5 maximum) |

```ts
type CardState = { box: 0 | 1 | 2 | 3 | 4 | 5; dueAt: Date; reviews: number; lapses: number; lastReviewedAt: Date | null };
type Outcome = "correct" | "incorrect";

newCard(now) → { box: 0, dueAt: now, reviews: 0, lapses: 0, lastReviewedAt: null }
schedule(card, outcome, now) →
  correct:   box' = min(box + 1, 5);  dueAt' = now + INTERVAL[box']
  incorrect: box' = 1;  lapses' = lapses + 1;  dueAt' = now + 1 day
  always:    reviews' = reviews + 1;  lastReviewedAt' = now
```

### 10.2 Rules

- **New cards** are due immediately (box 0, `due_at` = save time), so a learner can review what they just saved. A first correct answer goes to box 1 (1 day).
- **Correct** moves up one box. **Correct by a recognised form** (an inflection, a US spelling) and **an authored accepted answer** are correct (§13).
- **Incorrect** always returns to box 1 ("Back tomorrow"). There's no extra penalty for repeated failures. They're recorded in `lapses` and as evidence (§16), which is what the learner sees.
- **Overdue cards** are scheduled from the actual answer time. An overdue correct answer still moves up only one box: no credit for lateness, no penalty beyond what a wrong answer gives.
- **Answer quality** is binary (`correct` / `incorrect`); `answer_match` records the detail. There's no numeric grade, so a learner never grades themselves.
- **Hints:** none in Phase 5 (D6). Every prompt always shows its cue (the meaning, or the pattern with the preposition hidden), so it's never a bare guess.

### 10.3 Derived states (not persisted)

`status(card, sense, now)`, in this order:

1. **No longer reviewed:** the sense or its item is retired.
2. **No exercise yet:** the sense generates no exercise (possible for future content; none today).
3. **New:** `reviews = 0` (or no card yet).
4. **Due:** `due_at ≤ now`.
5. **Known:** box 4–5.
6. **Learning:** box 1–3.

Only `box`, `due_at`, `reviews` and `lapses` are stored. A persisted status would duplicate `box` and `due_at` and go stale at midnight.

### 10.4 Time and storage

- All instants are `timestamptz` (UTC). Intervals are fixed durations (n × 24 h) from the answer instant.
- "Due" means `due_at ≤ now`, with `now` taken once per request on the server and passed to the pure functions and SQL as a parameter. There's no timezone arithmetic, so there are no calendar-day or DST bugs.
- Display is relative and timezone-free:
  - "Due now" for ≤ 0;
  - "Back tomorrow" for ≤ 24 h;
  - "Next review in n days" (n rounded up).
- There's no "today" metric (§18), because that would need the learner's timezone.

**Why this is explainable:**

- "Correct → see it in 3 days; correct again → 7 days."
- "Wrong → back tomorrow."
- The bank shows the box as Learning or Known and the next review, never a hidden score.

## 11. Exercise model

### 11.1 Types

| Type          | Name in the UI        | Retrieval                            | Source                                      |
| ------------- | --------------------- | ------------------------------------ | ------------------------------------------- |
| `term`        | Complete the sentence | Typed recall of the saved expression | Examples + item forms (+ authored `accept`) |
| `preposition` | Type the preposition  | Typed recall                         | Examples linked to a preposition pattern    |
| `mistake`     | Which is correct?     | Choice of 2, recognition             | Authored mistakes                           |

**"Which expression fits?" isn't built in Phase 5 (D7).**

- Lexora has no authored statement that a related sense **doesn't** fit a given sentence.
- Relations only say two senses are related, and "a considerable increase" fits where "a significant increase" does. Distractors would therefore be guesses.
- It moves to Phase 6, with authored per-sentence distractors.

### 11.2 Shape and identity

Exercises are **generated at request time** from imported content, by a pure function over a batched read. They're **not materialised** (D9): a stored exercise table would duplicate content and drift from it.

Stable IDs come from permanent authored IDs (D10):

```text
term:<example id>           term:significant.notable:ex1
preposition:<example id>    preposition:responsible-for.duty:ex2
mistake:<mistake id>        mistake:responsible-for.duty:of
```

```ts
type ExercisePrompt = {
  // sent to the browser
  id: string;
  type: "term" | "preposition" | "mistake";
  senseId: string;
  term: string;
  senseLabel?: string;
  sentence?: GapPart[]; // term / preposition: the example with one blank
  blankWords?: number; // term: how many words the blank holds
  cue: string; // the definition (term), the pattern with the preposition hidden (preposition), "Which is correct?" (mistake)
  options?: { id: "a" | "b"; text: string }[]; // mistake only
};
type ExerciseKey = {
  expected: string;
  forms: string[];
  accepted: string[];
  mistakes: { answer: string; mistakeId: string }[];
  correctOption?: "a" | "b";
}; // server only
```

The answer key **never leaves the server**. The server regenerates the exercise from its id when an answer arrives.

### 11.3 Choosing an exercise for a card

- The sense's exercises are ordered by type round robin: term → preposition → mistake, each list in authored order. The result is `t1, p1, m1, t2, p2, m2, …`.
- The exercise for a card is `list[card.reviews mod list.length]`. It's deterministic, varies from one review to the next, and uses no randomness.
- For a choice exercise, option order is `(card.reviews + mistake position) mod 2` with opaque ids `a` and `b`. The server recomputes it from `expectedReviews`.

## 12. Exercise generation rules

Common to all types: only published senses of published items. Text is compared with `normaliseTerm` (NFKC, lower case, straight apostrophes, collapsed spaces; leading and trailing punctuation removed for answers). An exercise that fails a rule isn't generated, and `content:check` reports it (§27).

### 12.1 `term`: complete the sentence

|                     | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source              | An example of a sense whose item kind isn't `preposition_pattern`, and whose `practice.exclude` doesn't contain `term`                                                                                                                                                                                                                                                                                                                            |
| Blank               | The **longest item form** (any type) whose words occur **contiguously, as whole words, inside a highlight span**. Ties go to the first occurrence                                                                                                                                                                                                                                                                                                 |
| Failure conditions  | No form inside a highlight (an interrupted phrase: "take **urgent** measures", "pose a **serious** threat"); the form occurs twice in the sentence; the blank would hold the whole sentence                                                                                                                                                                                                                                                       |
| Prompt              | The sentence with one blank (`blankWords` shown as "2 words" when > 1), plus the cue: the sense's definition (and its label when the item has several senses)                                                                                                                                                                                                                                                                                     |
| Expected            | The form as written in the sentence ("plays a crucial role")                                                                                                                                                                                                                                                                                                                                                                                      |
| Accepted            | (a) any other **form of the same item** → `form` (correct; feedback shows the sentence's form); (b) the example's authored `practice.accept` → `accepted` (correct)                                                                                                                                                                                                                                                                               |
| Mistake recognition | The answer equals the **wrong span** of an authored mistake of the same sense whose **right span** equals the expected text ("significance" for "significant") → `mistake` (incorrect, with that mistake's explanation)                                                                                                                                                                                                                           |
| Distractors         | None (typed)                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Feedback            | Correct: "Correct." Plus "In this sentence: _plays_" for `form`, or "Also natural here. You saved _significant_." for `accepted`. Incorrect: "Not quite. Lexora was looking for _significant_." Then the authored mistake explanation if one matched, otherwise the sense's `best_when`. For `unrecognised` it adds "Lexora checks answers only against the language it has written down." The full sentence follows, with the answer highlighted |
| Difficulty          | Hardest (free recall). Linkers and sentence patterns are easier than single words with near-synonyms                                                                                                                                                                                                                                                                                                                                              |

### 12.2 `preposition`: type the preposition

|                     | Rule                                                                                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source              | An example with a `pattern` link whose highlight **ends with the pattern's preposition**, and whose `practice.exclude` doesn't contain `preposition`                                                                                  |
| Blank               | That final preposition                                                                                                                                                                                                                |
| Failure conditions  | The highlight doesn't end with the preposition (2 linked examples today); the preposition occurs twice inside the highlight                                                                                                           |
| Prompt              | The sentence with one blank, plus the cue: the display pattern with the preposition replaced by a blank ("be responsible ___ + noun / -ing")                                                                                          |
| Expected            | `pattern.preposition`                                                                                                                                                                                                                 |
| Accepted            | The example's authored `practice.accept_preposition` (e.g. "into" beside "in" if authored)                                                                                                                                            |
| Mistake recognition | The answer equals the differing word of the pattern's linked mistake (`pattern.mistake`), or of another `preposition`-type mistake of the sense whose right span is the expected preposition ("of" for "responsible for") → `mistake` |
| Distractors         | None. Arbitrary prepositions as options would assert wrongness the content doesn't author ("responsible **to**" is itself a correct pattern)                                                                                          |
| Feedback            | The pattern display and note; the matched mistake's explanation when relevant                                                                                                                                                         |
| Difficulty          | Medium: one closed-class word, but the classic IELTS error                                                                                                                                                                            |

### 12.3 `mistake`: which is correct?

|                    | Rule                                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| Source             | Every authored mistake of the sense (all shapes: substitution, extra or missing words, punctuation)        |
| Prompt             | "Which is correct?" with two options: the authored `right` and `wrong`, both in the serif language voice   |
| Expected           | The `right` option                                                                                         |
| Wrong choice       | `answer_match = mistake`, with `mistake_id` recorded                                                       |
| Feedback           | The mistake's `explanation`, with the correct version shown                                                |
| Failure conditions | `wrong` and `right` normalise to the same text                                                             |
| Difficulty         | Easiest (recognition, a 50% guess). That's acceptable as one type among three; typed correction is Phase 6 |

## 13. Answer acceptance model

**Rule (D8):** an answer is correct only if it's the expected answer, another authored form of the item, or an answer the content explicitly accepts for that exercise. Relations never imply acceptance.

**Where `accept` lives: on the example (D8).** Acceptance is a property of a sentence-with-blank. The same sense can take _considerable_ in "a ___ increase" but not in another sentence. So it belongs with the sentence, not with the sense or a separate exercise file. It's optional, so most examples need no edit.

```yaml
examples:
  - id: ex1
    text: There was a significant increase in the number of cyclists between 2010 and 2020.
    highlight: significant increase
    skill: writing
    task: writing-1
    collocation: increase
    practice: # optional; omit for most examples
      accept: [considerable, substantial] # also correct in the term blank
      # accept_preposition: [into]        # also correct in the preposition blank
      # exclude: [term]                   # don't generate this blank (term | preposition)
```

**Validation** (Zod + cross-file checks in `content:check`):

- every list is unique and non-empty;
- `accept` must not repeat the expected form;
- `accept_preposition` must not contain the wrong word of the pattern's linked mistake;
- `exclude` values are only `term` and `preposition`;
- `practice` on an example that generates no blank of that kind is an error (stale metadata).

**Database:** three columns on `examples`, all `not null default '{}'`:

- `practice_accept text[]`;
- `practice_accept_preposition text[]`;
- `practice_exclude practice_blank[]`.

Search never reads them.

**Phase 6:** further exercise types add their own optional keys under `practice` (for example `distractors`), so the structure grows without new top-level fields.

**Answer matching order:**

1. `expected`;
2. `form`;
3. `accepted`;
4. `mistake`;
5. `unrecognised`.

The first three are `correct`.

## 14. Review selection

Up to **5 exercises per session** (§37 D11). That's about two to three minutes: short enough to repeat daily, and matching the prototype's tested rhythm.

**Eligible:** the learner's saved senses whose sense and item are published, with at least one exercise and `due_at ≤ now` (a missing card counts as due since `saved_at`).

**Order:**

1. **Reviewed and due** (`reviews > 0`): by `due_at` ascending, so the most overdue come first; then by `sense_id`.
2. **New** (`reviews = 0` or no card): by `saved_at` ascending, then by `sense_id`.

**Notes:**

- **No randomness.**
- **No early reviews** of learning items that aren't yet due (Phase 6). Reviewing early would distort the Leitner intervals.
- **One query** with `limit 10` (spare rows cover senses that generate no exercise), then the first 5 with an exercise.
- **No card twice per session.** Selection happens once per session, and an answered card is rescheduled to at least a day ahead.
- **No due items:** "Nothing is due right now. Your next review is in 2 days." Offer _Open language bank_ and _Find language_. With an empty bank: "Save language from the Finder to start reviewing it." No counts are invented.

## 15. Review session lifecycle

1. **Load.** `GET /practice` (server component, `requireSession`) → `loadReviewSession(userId, now)`:
   - selects up to 5 cards (§14);
   - reads practice material for those senses in one batched read;
   - generates prompts.

   The page receives `{ senseId, expectedReviews, prompt }[]`, with no keys and no card ids.

2. **Present.** One exercise at a time ("Review 2 of 5", progress track, _End session_).
3. **Answer.** `POST /api/review/answers` with `{ senseId, exerciseId, expectedReviews, answer }`. `answer` is typed text (≤ 80) or an option id.
4. **Server, in one transaction:**
   1. same origin → session → rate limit → Zod;
   2. the saved sense must exist for this user (else 404). If there's no card yet, insert one (box 0, `due_at = saved_at`);
   3. `select … for update` the card joined with the sense and item status. Retired → 409 `retired`;
   4. **duplicate check:** if `card.reviews ≠ expectedReviews`, look up `review_log (card_id, review_number = expectedReviews + 1)`:
      - if it exists with the same `exercise_id`, return **the stored result** (200, `duplicate: true`), recomputing nothing;
      - otherwise, 409 `stale`;
   5. not due → 409 `not_due`;
   6. regenerate the exercise for `expectedReviews`. If `exerciseId` isn't that exercise → 409 `exercise_changed`;
   7. evaluate (§13) → `schedule()` (§10) → update the card → insert the log row;
   8. commit, then return the feedback:
      - `{ outcome, match, expected, accepted[], explanation, sentence, nextReview: { box, dueAt, label }, evidence? }`;
      - `evidence` is set when this answer makes a recurring mistake (§16).
5. **Feedback** comes only from the server's response. The UI never decides correctness.
6. **Continue.** Next exercise. After the last: a summary built from the server-confirmed results ("You reviewed 5 · 3 correct"), each item with its next review and a link to its language page.
   - **More items due:** offer _Review 5 more_.
   - **Otherwise:** offer _Open language bank_.
7. **End early.** Answered items are already saved; unanswered ones are untouched. A refresh mid-session reselects: answered cards are no longer due, so nothing repeats.

**Idempotency:**

- `unique (card_id, review_number)` plus the row lock make a double submit (double click, retry, two tabs) record **one** answer and schedule **once**.
- The second request receives the first one's result.

## 16. Personal mistake evidence

There's no second mistake engine. The evidence is a query over `review_log`.

- **A wrong response key:**
  - `mistake_id` when the answer matched an authored mistake (typed or chosen);
  - otherwise `answer:<normalised answer>` for typed answers.
  - Unrecognised choices can't happen (two authored options).
- **Recurring mistake:** the same wrong response key on the same sense **at least 2 times in the last 30 days**, unless it's **resolved**. Resolved means the sense's two most recent answers are both correct and both after the latest occurrence.
- **Needs more review:** a card with `lapses ≥ 2` → "Missed n times" in the bank.

```sql
-- Recurring mistakes for one learner (bounded: index (user_id, reviewed_at), limit)
select sense_id, coalesce(mistake_id, 'answer:' || answer) as response, count(*) as times,
       max(reviewed_at) as last_at, (array_agg(expected order by reviewed_at desc))[1] as expected,
       (array_agg(answer order by reviewed_at desc))[1] as answer
from review_log
where user_id = $1 and outcome = 'incorrect' and reviewed_at > $now - interval '30 days'
  and (mistake_id is not null or answer is not null)
group by sense_id, response
having count(*) >= 2
-- then a lateral check on the sense's two latest answers excludes resolved ones;
-- order by last_at desc, limit 3 (Home) or restricted to the listed senses (bank)
```

**Shown as `MistakeRow`:**

- **Authored mistake:** its `wrong` → `right` and its explanation, plus "You chose this 2 times".
- **Unrecognised typed answer:** "You typed _at_ 2 times" → the expected answer.

Nothing classifies errors beyond the authored mistake types.

## 17. Language Bank UX (`/bank`)

**Header.** `PageHeader`: "Language bank", "Everything you've saved, and when it comes back." Primary _Start review_ (with "3 due") only when something is due.

**Summary line.** Text, not tiles: "12 meanings · 3 due now · 2 new · 5 learning · 2 known".

**Sections, in order:**

1. _Ready to review_: Due, then New.
2. _Coming up_: Learning and Known, by `due_at` ascending.
3. _No longer reviewed_: retired senses.

Within a section, the §14 order is used, and _Coming up_ is ordered by `due_at`. Each section is one bordered list (`rounded-lg border bg-card p-1`), as `LanguageRow`.

**Each row:**

- the term (serif), kind dot and sense label;
- a status badge: text plus icon, never colour alone (_New_, _Due_, _Learning_, _Known_, _No longer reviewed_);
- the next review ("Due now", "Next review in 3 days");
- an evidence note when present ("Missed 2 times");
- the row links to `/language/[slug]`;
- an icon button removes it, named "Remove “significant” (having a real effect) from your language bank". It uses the existing `DELETE` endpoint, refreshes the list after the server confirms, and posts the notice "Removed “…” from your language bank. Its review history is kept."

**Pagination.** 50 rows per page (`?page=`), sections continuing across pages. It's bounded; most learners will have one page during Phase 5.

**Explicitly not included:** filters, sorting controls, search within the bank, folders, tags, notes.

**States:**

- **Empty:** `EmptyState`: "Your language bank is empty. Save a meaning from the Finder and it will appear here, ready to review." Plus _Find language_.
- **Loading:** a Suspense skeleton of the list inside the page (never a route-level `loading.tsx`, ARCHITECTURE §11).
- **Error:** a danger `Callout`: "Your language bank isn't available right now." Plus _Try again_.
- **Remove failure:** the row is restored, with "Couldn't update “…”. Please try again."

**Mobile.** Rows wrap. The status and next review drop under the term below `sm`, and the remove button keeps a 44 px target.

## 18. Home UX (`/home`)

`SAMPLE_LEARNER`, its "Sample learner data" badge and the prototype status in `navigation.ts` are removed.

| Area                                    | Content (all persisted or derived from persisted data)                                                                                                                                                                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header                                  | "Welcome back, {first name}". Description: "3 meanings are ready to review." / "Nothing is due right now. Your next review is in 2 days." / "Save language from the Finder to start reviewing it." Actions: _Start review_ (primary, when due > 0) and _Find language_ |
| Verification reminder                   | Unchanged                                                                                                                                                                                                                                                              |
| Ready to review (the highlighter panel) | The due count (reviewed due + new), _Start review_; or the nothing-due state with the next review                                                                                                                                                                      |
| Your bank                               | One text line: "12 saved · 5 learning · 2 known" + _Open language bank_                                                                                                                                                                                                |
| Recurring mistakes                      | Up to 3 `MistakeRow`s (§16) with _Open “responsible for”_. Hidden when there are none                                                                                                                                                                                  |
| Recently saved                          | Up to 4 `LanguageRow`s with status. Hidden for an empty bank                                                                                                                                                                                                           |
| Quick actions                           | _Find language_, _Open language bank (n saved)_                                                                                                                                                                                                                        |

**Not shown:**

- weekly focus, "weak areas" by category, minutes estimates, progress bars toward a target;
- "reviewed today": this needs a timezone and adds nothing actionable (D15);
- percentages, mastery scores, streaks.

**Empty bank.** The header line above, _Find language_ and one sentence explaining what the bank does. No zeros in tiles.

## 19. Save-flow UX

- **Saving** creates a card that's due now (D3). The `PUT` response gains `{ review: "ready" }`.
  - The signed-in notice becomes "Saved “significant” to your language bank. It's ready to review." with an _Open language bank_ link.
  - No reminder is promised.
- **Removing:** "Removed “…” from your language bank. Its review history is kept."
- **The save gate** (visitors): "Create a free Lexora account to save language and review it when it's due." Replaces "…practise it later, and track your progress".
- **Landing CTA:** "A free account saves language to your own bank and brings it back for review when it's due." Replaces "…shows how your recall is growing".
- **Result cards and language pages are otherwise unchanged:** the bookmark state is as today. Showing review state there is Phase 6.

## 20. Auth and security model

| Threat                     | Control                                                                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unauthenticated access     | `/bank`, `/practice` and `/home` are under `(app)` (proxy plus `requireSession`). `POST /api/review/answers` → `getRequestSession` → 401 (after the database check, as `unauthenticated()` does today) |
| Client-supplied user ids   | No request carries a user id. Repositories take `session.user.id`, and a body containing `userId` is ignored by the strict Zod schema (and rejected as an unknown key)                                 |
| Another user's card        | Cards are addressed by `(session user, senseId)` only. Card uuids are never accepted from the client, so another learner's card can't be named                                                         |
| Retired or unowned content | 404 when the sense isn't saved by this user; 409 `retired`                                                                                                                                             |
| Forged correctness         | The answer key is server-side only, regenerated from the exercise id; the client sends only an answer                                                                                                  |
| Double submission          | Row lock plus `unique (card_id, review_number)` plus `expectedReviews` (§15)                                                                                                                           |
| Malformed input            | Zod: `senseId` = `SENSE_ID_PATTERN`; `exerciseId` = `^(term\|preposition\|mistake):[a-z0-9.:-]{1,160}$`; `expectedReviews` = int 0–100000; `answer` = string 1–80 after trim, or `a`/`b`. Body ≤ 2 KB  |
| CSRF                       | `isSameOrigin()` on the route handler (403 cross-site)                                                                                                                                                 |
| Abuse                      | Per-user write limits (§21); answers only to due cards (a natural daily bound)                                                                                                                         |
| Data exposure              | Client components receive presentation data only (prompts, statuses, labels), never keys, card ids or other users' data. Public pages are unchanged and never read review data                         |
| Logging                    | Failures log a generic message and an error class only: never answers, never the user id                                                                                                               |

## 21. Rate limiting

| Surface                                                        | Who       | Limit                       | Mechanism                                                                                                                | Response                                                                                               |
| -------------------------------------------------------------- | --------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `GET /explore?q=…`, `GET /finder?q=…` (server-rendered search) | Anyone    | 120 / min / IP (Phase 4 D7) | **Vercel Firewall rate-limit rule**, owner-applied in the dashboard after verifying it's available on the project's plan | 429 at the edge                                                                                        |
| `PUT` / `DELETE /api/bank/saved/[senseId]`                     | Signed-in | 60 / min / user             | App level, `request_limits` (`bank_write`)                                                                               | 429 `{ error: "rate_limited" }` + `Retry-After`                                                        |
| `POST /api/review/answers`                                     | Signed-in | 30 / min / user             | App level, `request_limits` (`review_answer`)                                                                            | 429, same shape; the UI keeps the answer and says "You're going a little fast. Try again in a moment." |
| Better Auth endpoints                                          | —         | Unchanged                   | Better Auth (database)                                                                                                   | Unchanged                                                                                              |

**The app-level limiter** is `src/server/http/rate-limit.ts` plus `src/server/repositories/request-limits.ts`: one statement per request, after authentication, so the key is the user rather than an IP.

```sql
insert into request_limits (user_id, action, window_start, count)
values ($1, $2, date_trunc('minute', $now), 1)
on conflict (user_id, action) do update
  set count = case when request_limits.window_start = excluded.window_start then request_limits.count + 1 else 1 end,
      window_start = excluded.window_start
returning count;
```

It works across serverless instances (the reason Better Auth uses database storage too). There's no new dependency, no IP storage, and the table holds at most one row per user per action. It supersedes Phase 4's proposed D12 (a Firewall rule on `/api/bank/`, never built), because per-user limits can be tested in CI.

**Public search.**

- **Why the edge:** search is a page render, not an API; a 429 from an RSC page isn't idiomatic; and an app-level IP limiter would write to Postgres on every anonymous search.
- **Required for Phase 5 (D17):** a public search rate limit. Vercel Firewall provides it at the edge (target 120 / min / IP). Step 0c confirms the project's current Vercel plan and configures the rule it offers (§36 O1).
- **Verification:** the Vercel connector can't read the team's Firewall settings (403 for scope `sajjadul-islams-projects`), and the Vercel CLI isn't installed, so this is an owner check.

**Tests:**

- unit tests for the window arithmetic;
- Postgres integration tests (the 61st save in a minute → 429; a new minute resets; per-user isolation);
- E2E (one learner bursting the review endpoint);
- the Firewall rule is checked with a production smoke test after it's applied.

## 22. Email status

**From the repository:**

- `src/server/env.ts:73–95`: a deployed site must use `EMAIL_TRANSPORT=resend` with `RESEND_API_KEY` and `EMAIL_FROM`, or it refuses to start.
- The production default sender in code is only a fallback for local and CI builds.

**From the post-Phase-3 audit (9 October):**

- Resend had **no verified domain**, so the test sender delivers only to the Resend account owner.
- Production still runs on `lexora-five-sigma.vercel.app` (confirmed by HTTP on 21 October). A `vercel.app` address can't carry the SPF/DKIM records Resend needs.

**Current production value: unknown.** It couldn't be read: the Vercel connector returns 403 for the team scope.

If it's unchanged, **other learners receive no verification or password-reset email**. Verification never blocks learning, but a learner who forgets their password loses their review history.

**Owner action (Step 0c; not engineering work):**

1. Vercel → `lexora` → Settings → Environment Variables → Production: read `EMAIL_FROM`.
2. If it's `onboarding@resend.dev`, or its domain isn't verified in Resend:
   1. get a domain (the audit suggests the GitHub Student Pack);
   2. add it in Resend and publish its SPF and DKIM records;
   3. set `EMAIL_FROM` to an address on it;
   4. redeploy.

   If the app also moves to that domain, update `BETTER_AUTH_URL` too (it drives `APP_ORIGINS` and the same-origin guard).

3. Smoke test: request a password reset for a non-owner inbox and confirm delivery.

Phase 5 isn't blocked on this. The definition of done requires its status to be **resolved or recorded** in the final audit.

## 23. API, server-action and module boundaries

```text
UI (features/bank, features/practice, features/dashboard; client components get props only)
  ↓ fetch / navigation
Route handler POST /api/review/answers · PUT/DELETE /api/bank/saved/[senseId] (existing)
  ↓ isSameOrigin → getRequestSession → rate limit → Zod
Server orchestration  src/server/learning/review.ts  (server-only; transactions)
  ↓                                    ↓
Repositories                           Pure modules  src/learning/*
  src/server/repositories/review-cards.ts   scheduler.ts · status.ts · exercises.ts
  src/server/repositories/request-limits.ts answers.ts · selection.ts (comparator for tests)
  @/language → practiceMaterial(senseIds)   (no React, Next, DB or clock)
  ↓
PostgreSQL
```

| Decision            | Choice                                                                                                                                                                                                 | Why                                                                                                                                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Review answers      | A **route handler**, not a server action                                                                                                                                                               | The E2E harness is HTTP-only (no browser, by owner decision). Server actions are addressed by build-specific action ids, so they can't be exercised reliably. A handler gives real status codes (401, 403, 409, 429) and matches the save endpoint's tested pattern |
| Page data           | Server components call `src/server/learning/*` directly (`requireSession` first)                                                                                                                       | No API needed for reads                                                                                                                                                                                                                                             |
| Pure logic          | New `src/learning/` with a lint rule: no `@/server`, `@/features`, `@/components` or `@/app`; may import `@/language` types and `normalise`                                                            | Mirrors the `src/language` engine boundary. ARCHITECTURE's _target_ `domain/srs` + `domain/practice` is realised as `src/learning` (recorded in the decision log on approval)                                                                                       |
| Practice material   | A new read on the **language** repository (`practiceMaterial(senseIds)`: examples with highlights and practice columns, item forms, patterns, mistakes; at most 4 statements for any number of senses) | It's language data only, so the language repository's no-user-data rule holds                                                                                                                                                                                       |
| Shared HTTP helpers | `json`, `guarded`, `unauthenticated` move from `src/app/api/bank/saved/http.ts` to `src/server/http/`                                                                                                  | Two handlers now use them                                                                                                                                                                                                                                           |

## 24. Error states

| Situation                                                | Behaviour                                                                                                                                                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Database unavailable on `/bank`, `/practice` or `/home`  | An in-page danger `Callout` with _Try again_; the `(app)/error.tsx` boundary stays the last resort                                                                                                                       |
| Answer request fails (network, 503)                      | "Your answer wasn't saved. Try again." The answer is kept, nothing advances                                                                                                                                              |
| 401 (session expired mid-session)                        | "Your session ended. Sign in to continue." with a link back to `/practice`                                                                                                                                               |
| 409 `stale` / `not_due` / `exercise_changed` / `retired` | An info notice ("This item was already reviewed" / "This item isn't due any more" / "This exercise changed, so it was skipped" / "This meaning is no longer reviewed"), then the next item. Never counted in the summary |
| 429                                                      | The answer is kept; "You're going a little fast. Try again in a moment."                                                                                                                                                 |
| A sense with no exercise                                 | Not selected; _No exercise yet_ in the bank                                                                                                                                                                              |
| An empty session after errors                            | The nothing-due state                                                                                                                                                                                                    |

## 25. Accessibility requirements

These follow WCAG 2.1 AA and DESIGN §12.

**Review session:**

- Focus moves to each new exercise's heading.
- The typed input is labelled ("Missing word in: There was a … increase"), and the blank is announced ("blank") by `GapSentence`.
- Enter checks, then continues; number keys 1–2 choose for `mistake`.
- Feedback goes in a `role="status"` region.
- Verdicts are text plus icon, never colour alone.
- There are no time limits.

**Bank:**

- Sections are `h2` with lists.
- Status is text.
- Remove buttons name the term and sense.
- The remove result is announced.
- Focus moves to the next row, or to the section heading when the last row is removed.

**Home:** counts are text; there are no charts.

**Everywhere:**

- Visible focus.
- 44 px targets on touch.
- `prefers-reduced-motion` respected (no motion is added).
- Zoom to 200% without loss.

The HTML accessibility suite (`e2e/accessibility.e2e.ts`) is extended to `/bank`, `/practice` (an exercise, feedback, the summary, nothing-due) and `/home`.

## 26. Responsive requirements

- **Widths:** 320–1440 px; the manual Chrome pass covers 390, 430, 768, 1024, 1280 and 1440, as in Phase 4.
- **Practice:** `max-w-reading`, one column; options full width; the typed input full width below `sm`.
- **Bank:** rows wrap; the status and next review drop under the term below `sm`.
- **Home:** one column below `lg`; the side column (quick actions) from `lg`, as today.
- **Overflow:** no horizontal page overflow at any width (checked as in the Phase 4 audit).

## 27. Content requirements

1. **Content model (Step 3a, a feature PR):**
   - the optional `practice` block on examples (§13): Zod schema, cross-file validation, the three `examples` columns, the importer;
   - `content/README.md` documents it.
2. **Practice-readiness report:**
   - `pnpm content:check` prints, per sense, the exercises generated and the examples skipped, with the reason;
   - it **fails** on invalid `practice` metadata and only **warns** when a sense has no exercise (future content may legitimately have none);
   - a test pins today's corpus at 42/42 senses with at least one exercise.
3. **The accept-list pass (Step 3b, a separate content PR the owner reviews; not Wave 2):**
   - for each of the 77 completion exercises, the owner sees the blank and the accepted answers from the report, then adds `practice.accept` where another answer is genuinely right, or `practice.exclude: [term]` where the blank is too open;
   - **Scope:** expected to concern mainly the 27 senses with near relations (64 examples);
   - the content is unchanged otherwise.
4. **Mistakes and patterns:** no new fields. All 56 mistakes and 45 linked examples are used as authored.

## 28. Wave 2 separation

Wave 2 runs as a **parallel editorial stream** in owner-reviewed content PRs (as in Phase 3, PRs #9 and #10). It's never mixed into feature PRs and never a Phase 5 exit criterion.

**Planning target (not a gate):** about 80 additional items over time.

**Editorial priority:**

1. Task 1 trends and comparison (decline, fluctuate, peak, remain stable, compared with, account for);
2. cause, result and core linkers (therefore, consequently, due to, lead to, in addition, although, while, despite, in conclusion, firstly, on the one hand, and _for example_ as an item);
3. opinion, stance and hedging;
4. noun + preposition patterns (impact on, increase in, reason for, lack of, attention to);
5. topic collocations with topic tags;
6. speaking language and register;
7. reporting and evidence language;
8. broader verb frames.

Every batch also adds commonly confused pairs, countability and recurring learner mistakes.

**Practice obligations for every batch:**

- it passes the practice-readiness report;
- it adds `practice.accept` where needed;
- it reviews the ranking-snapshot diff (search) and the exercise-count diff (practice).

The generator needs no change for new content.

## 29. Testing strategy

**Unit (Vitest, no database):**

- **Scheduler:** every transition (0→1, n→n+1, 5→5, any→1 on wrong), intervals, `dueAt` arithmetic, overdue handling, `lapses`, purity (same input, same output), a fixed clock.
- **Derived status:** precedence (retired > no exercise > new > due > known > learning) and boundaries (exactly at `due_at`).
- **Generation over the whole real corpus:**
  - every published sense yields exactly the expected exercises (a pinned count: 77 / 45 / 56 before Step 3b, updated with an explanation after);
  - no prompt contains its expected answer;
  - every exercise has an expected answer and feedback text;
  - no accepted answer equals a recognised mistake;
  - option ids are opaque;
  - the excluded and failure cases (interrupted forms, missing preposition) are covered.
- **Answer evaluation:** normalisation (case, apostrophes, punctuation, spaces); `expected` / `form` (an inflection, a US variant) / `accepted` / `mistake` / `unrecognised`; length limits.
- **Selection:** the order (overdue → due → new; ties by `sense_id`); the limit; skipping senses with no exercise; retired senses excluded.
- **Evidence:** grouping by response key, the threshold 2, the 30-day window, resolution by two later correct answers.
- **Exercise rotation:** deterministic, by `reviews`.

**Integration (Postgres, `test/*.integration.test.ts`):**

- **Cards:** saving creates a card in the same transaction; a pre-Phase-5 save without a card reads as _New_, and its first answer creates the card.
- **Lifecycle:**
  - remove → the card is deleted, history kept;
  - save again → a new card;
  - a retired sense → kept, not selectable, answer → 409;
  - account deletion cascades everywhere.
- **Persistence:**
  - review log rows, `box_before` / `box_after` and `due_after`;
  - idempotency: two concurrent submissions with the same `expectedReviews` → one log row, one schedule change, the same response.
- **Ownership:** learner B can't answer, list or see learner A's cards (404), and a body with `userId` is rejected.
- **Bank and Home:** bank pagination; Home counts match the data.
- **Rate limits:** see §21.
- **Query counts:** asserted with Drizzle's logger, as Phase 4 did (§32).

**Security (integration + E2E):**

- unauthenticated access (`/bank`, `/practice` redirect; `POST` → 401);
- cross-site `POST` → 403;
- malformed bodies → 400;
- duplicate submission;
- rate limiting (429).

**E2E (HTTP against a production build, `e2e/retrieval-loop.e2e.ts`).** One flow per learner from `global-setup`:

1. Sign in (an injected learner).
2. `GET /explore?q=better+word+for+important` → the result for `significant.notable`.
3. `PUT /api/bank/saved/significant.notable` → `{ review: "ready" }`.
4. `GET /bank` → the term under _Ready to review_ with _New_.
5. `GET /practice` → its exercise prompt (no answer in the HTML).
6. `POST` a correct answer → `correct`, "Next review in 1 day".
7. In the database: the card is at box 1 with `due_at` about 24 h ahead; one `review_log` row.
8. `GET /home` → the due count dropped; the saved count is right.

**Further cases:**

- **Wrong answers:** a wrong answer (box 1, `lapses` 1). Then the database moves `due_at` into the past, a second identical wrong answer is given, and `/home` shows a recurring mistake.
- **Saves:** remove the saved item (the bank no longer lists it; the log is kept).
- **Empty states:** an empty bank; the nothing-due state.
- **Other learners:** learner B can't see or answer A's card.
- **Visitors:** they still get the save gate.

**Keyboard and mobile.** No Playwright (owner decision). The HTML accessibility suite checks structure, labels and roles. A manual Chrome pass covers keyboard-only sessions and the widths in §26; it's recorded in the Step 9 audit.

**Regression (must stay green and unchanged):**

- the 71-case golden suite (memory and Postgres) and the ranking snapshot;
- context-gap, filter, canonical-URL, saved-language and route-boundary E2E suites.

Step 0 **adds** golden cases ("express contrast", "describe an increase", "for example") and leaves the existing cases and the snapshot byte-for-byte unchanged. Any change to an existing expectation is a stop-and-report, never a silent snapshot update.

## 30. Migration strategy

| Migration                   | Step | Contents                                                                                                                                     | Risk                                                                          |
| --------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `0005_request_limits`       | 0    | Enum `limited_action`; table `request_limits`                                                                                                | None: a new table                                                             |
| `0006_review_cards_and_log` | 2    | Enums `review_exercise_type`, `review_outcome`, `answer_match`; tables `review_cards`, `review_log`; indexes; composite FK to `saved_senses` | None: new tables; the FK needs `saved_senses`' existing composite PK          |
| `0007_example_practice`     | 3a   | Enum `practice_blank`; three `examples` columns, `not null default '{}'`                                                                     | Low: adding columns with constant defaults is metadata-only in PostgreSQL 11+ |

**Data considerations:**

- **Existing users and saves:** nothing is backfilled. Saves without cards read as _New_ (§9.4).
- **Duplicates:** prevented by keys.
- **Retired content:** untouched (the restrict FKs stay).
- **Deleted accounts:** cascade.

**Rollback:**

- **App:** the migrations are expand-only, so the `v0.4.0` application runs unchanged against the migrated schema. Vercel Instant Rollback to the previous production deployment is safe.
- **Data:** drop the new objects only if no learner data needs keeping. The SQL goes in the Step 9 runbook: `drop table review_log, review_cards, request_limits; alter table examples drop column practice_accept, drop column practice_accept_preposition, drop column practice_exclude;` then drop the four enums. Drizzle has no down migrations.

## 31. Deployment strategy

**What the repository actually does:**

- CI applies migrations only to its throwaway database.
- Vercel builds with `next build` and runs no migrations.
- A merge into `main` (CI, after the owner's `owner-approved` label) deploys production automatically (`vercel.json`).

**Production release procedure (owner-run; the Step 9 runbook gives exact commands):**

1. **Before labelling:** `pnpm db:migrate` against Neon's **direct** URL (`DATABASE_URL_UNPOOLED` from the Neon console, never committed). This applies 0005–0007. The running `v0.4.0` ignores them.
2. **Label the phase PR** `owner-approved`. CI re-verifies, merges, tags `v0.5.0`, and Vercel deploys.
3. **Immediately after the deploy:** run `pnpm content:import` against production from the merged `main` (it writes the Step 3b accept lists). Until it runs, exercises accept only the expected answers and item forms, which is strict but never wrong.
4. **Smoke test:**
   - sign in with a real account;
   - save → bank → review → answer;
   - Home;
   - a 401 for a signed-out `POST`;
   - Explore's ordinary search and a gap query unchanged;
   - "express contrast" and "for example" fixed.
5. **Optional:** one latency measurement on production (resolving Phase 4 OPS-1).

## 32. Performance expectations

Measured locally with Drizzle's statement log, as in the Phase 4 audit. Session validation (Better Auth, 1–2 statements) is excluded.

| Request                    | Statements (target) | Notes                                                                                                                                                                                                             |
| -------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home                       | ≤ 3                 | One aggregate over `saved_senses ⟕ review_cards` (`count(*) filter (…)` for saved / due / new / learning / known, plus the next due); recurring mistakes (limit 3); recently saved (limit 4, joined to headwords) |
| Bank page                  | ≤ 3                 | Counts; one page of rows joined to senses and items (limit 50); evidence for the listed senses                                                                                                                    |
| Start review (`/practice`) | ≤ 5                 | Selection (limit 10); `practiceMaterial` for the selected senses (≤ 4 batched reads)                                                                                                                              |
| Submit an answer           | ≤ 8                 | Rate limit (1); card upsert or lock (1–2); material for one sense (≤ 4, the same batched read); update and insert (2); evidence for this sense (1)                                                                |
| Save a sense               | ≤ 4                 | Rate limit; published check; insert save; insert card (one transaction)                                                                                                                                           |

**Constraints:**

- No N+1: material is read once per request for all selected senses.
- The scheduler and generator make no database calls.
- Every list is bounded (5 / 10 / 50 / 3 / 4).
- **Budget:** server time for each of these ≤ 100 ms locally at p95 over 20 warm runs (Phase 4 search measured 8–34 ms with up to 17 statements).
- No caching.

## 33. Observability considerations

- **Errors:** route handlers and loaders log `"<operation> failed"` plus the error message class through `guarded`, never answers, user ids or bodies. Vercel runtime logs are the only sink (monitoring stays Phase 10).
- **Analytics:** unchanged. Vercel Web Analytics counts page views, sanitised (decision #59). No review events, no answers, no query text.
- **Owner insight without an admin screen:** the Step 9 runbook includes read-only SQL for aggregate counts (cards, reviews per day, the share correct by exercise type), run on demand from the Neon console. There's no new dashboard.

## 34. Rollback considerations

- **Per step:** each step is a separate PR into `phase/5-retrieval-loop`; reverting one doesn't affect `main`.
- **Release:** application rollback via Vercel Instant Rollback (schema-compatible, §30).
- **Search fixes:** Step 0 isolates them (one function each) with their own golden cases, so they can be reverted alone.
- **Content:** a bad accept list is fixed by a content PR and a re-import. A wrong acceptance only ever makes a correct-scored answer more lenient for that exercise, and it's visible in the readiness report.

## 35. Risks

| Risk                                                          | Impact                    | Mitigation                                                                                                                 |
| ------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| A correct learner answer is marked wrong (open blank)         | Lost trust                | Authored accept lists (Step 3b); `exclude`; honest `unrecognised` copy; the owner reviews every completion blank once      |
| The bank fills fast with 42 senses                            | A thin loop               | The Wave 2 stream; the loop scales with no code change                                                                     |
| Recognition exercises (a 50% guess) inflate boxes             | Overstated "Known"        | One of three types; rotation interleaves typed recall; "Known" means box ≥ 4, which needs four consecutive correct answers |
| Leitner is less optimal than FSRS                             | Slightly more reviews     | Explainability is a product requirement; it can be swapped behind the same pure interface later                            |
| Scope drift into an LMS / dashboard                           | Phase sprawl              | §7 classification; Home limited to persisted numbers                                                                       |
| The Firewall rule isn't configured or verified before release | No public search limit    | Step 0c confirms the current Vercel plan and configures the rule (D17, O1); the release smoke test checks for a 429        |
| A Phase 4 regression from the Step 0 fixes                    | Search damage             | Exact-equality trigger routing only; a narrow mistake rule; the golden suite and snapshot unchanged; stop and report       |
| The deploy-gap saves without cards                            | Inconsistent bank         | The left-join model (§9.4): a missing card is _New_                                                                        |
| Email not deliverable                                         | Lost accounts and history | Step 0c owner action                                                                                                       |

## 36. Open questions (owner)

| #   | Question                                                                                                                                                                                                                                                                                                            | Default if unanswered                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| O1  | Vercel Firewall rate limiting is an available product capability, not an architectural unknown. The remaining question is operational: confirm the Lexora project's current Vercel plan and configure the rate-limit rule it offers for public search (Step 0c). Phase 5 requires a public search rate limit (D17). | Confirm the plan and configure the rule in Step 0c            |
| O2  | Production `EMAIL_FROM`: verified domain or test sender?                                                                                                                                                                                                                                                            | Record "unresolved" in the final audit; Phase 5 isn't blocked |
| O3  | Should the two Step 0 search fixes ship early as a hotfix to `main` (WORKFLOW → Hotfixes; the owner merges it), or with the Phase 5 release?                                                                                                                                                                        | With the Phase 5 release                                      |

Everything else is decided in §37 (proposed).

## 37. Decisions

All **proposed**. They're approved with this specification.

### D1. Scheduler: Leitner, five boxes

- **Decision:** boxes 0–5, intervals 1 / 3 / 7 / 14 / 30 days; correct +1 box, wrong → box 1 (1 day).
- **Why:** pure, small, auditable, and explainable in one sentence ("wrong → tomorrow; right → longer").
- **Alternatives:**
  - **FSRS (`ts-fsrs`):** rejected. It's a new dependency, its stability and difficulty parameters can't be explained to a learner, it needs self-graded ratings, and it has no repository-level advantage at this scale.
  - **SM-2:** rejected. Its ease factor adds a hidden numeric state and 4-point grading for little gain.
- **Consequences:** about 4 correct answers over about 25 days to reach _Known_. It can be replaced later behind the same `schedule()` signature.

### D2. Card states: derived

- **Decision:** persist `box`, `due_at`, `reviews` and `lapses`; derive New / Due / Learning / Known / No longer reviewed / No exercise yet (§10.3).
- **Why:** a persisted status would duplicate `box` and `due_at` and go stale as time passes.
- **Alternatives:** a status column (rejected: redundant and drift-prone).
- **Consequences:** status is a pure function, tested once and used everywhere.

### D3. Newly saved senses are due immediately

- **Decision:** a card at box 0 with `due_at` = the save time.
- **Why:** an early first retrieval strengthens memory; the learner can act at once; the copy stays simple and true ("ready to review").
- **Alternatives:**
  - due tomorrow (rejected: an unexplained wait, and E2E would need time travel for the basic flow);
  - no due date until the first review (rejected: a special case in every query).
- **Consequences:** new items compete with due items, but they're ordered after them (§14).

### D4. Interval progression: 1, 3, 7, 14, 30 days; maximum 30 days

- **Decision:** as stated.
- **Why:** classic Leitner spacing roughly doubles; a 30-day cap suits an exam a few months away and keeps the loop visible during Phase 5.
- **Alternatives:** a 60–120-day cap (rejected for now; Phase 6 can extend it, with a test-date cap).
- **Consequences:** a Known item returns at least monthly.

### D5. Correct / wrong

- **Decision:**
  - **correct:** the expected answer, another authored form of the item, or an authored accepted answer;
  - **wrong:** anything else, including recognised authored mistakes.
- **Why:** correctness must come from authored data; forms are authored (agreement isn't the item being learned; Lexora "describes the pattern, not the grammar").
- **Alternatives:**
  - forms counted as wrong (rejected: it punishes recall for a grammar slip);
  - partial credit (rejected: hidden numeric state).
- **Consequences:** `answer_match` keeps the detail for evidence and feedback.

### D6. No hints in Phase 5

- **Decision:** none. Every prompt includes a fixed cue (the meaning or the pattern).
- **Why:** hints would add a third outcome and scheduling rules without evidence that they're needed.
- **Alternatives:** a first-letter hint scheduled as "hard" (rejected: complexity).
- **Consequences:** a "correct with hint" outcome doesn't exist. Phase 6 can add it.

### D7. Exercise types: three

- **Decision:** `term`, `preposition`, `mistake`. "Which expression fits?" moves to Phase 6.
- **Why:** each is fully determined by authored data (§12). "Which fits?" needs authored negative evidence that relations don't provide.
- **Alternatives:** relation-based distractors (rejected: they infer that a related sense doesn't fit, which is often false).
- **Consequences:** recognition is limited to authored mistakes; typed recall dominates.

### D8. Authored accept lists on examples

- **Decision:** the optional `practice: { accept, accept_preposition, exclude }` on examples; never derived from relations.
- **Why:** acceptance depends on the sentence. It's optional (no mass rewrite), owned by the content, and extensible for Phase 6.
- **Alternatives:**
  - sense-level `accept` (rejected: it's wrong for some sentences);
  - a separate exercise file (rejected: it duplicates examples and drifts);
  - derived synonyms (rejected by the owner and by §13).
- **Consequences:** one bounded review pass (Step 3b); every Wave 2 batch follows the rule.

### D9. Exercises generated dynamically, not materialised

- **Decision:** a pure generation function over a batched read of imported content.
- **Why:** content is the single source of truth; nothing drifts; there's no new table.
- **Alternatives:** an `exercises` table filled at import (rejected: duplication, and import complexity).
- **Consequences:** generation runs per request (bounded, at most 10 senses), and IDs must be stable (D10).

### D10. Stable exercise IDs from authored IDs

- **Decision:** `term:<example id>`, `preposition:<example id>`, `mistake:<mistake id>`.
- **Why:** authored IDs are permanent; logs stay meaningful; submissions are validated.
- **Alternatives:** positional or hashed IDs (rejected: unstable when content changes).
- **Consequences:** an exercise that disappears from content → `409 exercise_changed`; history keeps `expected`.

### D11. Session and transactions

- **Decision:**
  - 5 exercises per session;
  - one transaction per answer with a row lock;
  - idempotency by `unique (card_id, review_number)` and `expectedReviews`;
  - a duplicate returns the stored result;
  - answers only to due cards.
- **Why:** short sessions; a server-authoritative state; safe retries.
- **Alternatives:** a `review_sessions` table (rejected: no requirement it would serve); client-side scoring (rejected: not authoritative).
- **Consequences:** the summary is built from server responses; a refresh resumes naturally.

### D12. Removing a saved sense

- **Decision:** the card cascades from `saved_senses`; `review_log` is kept; saving again starts a new card.
- **Why:** ownership stays with `saved_senses`; history is the learner's record and their evidence.
- **Alternatives:** archiving the card (rejected: a second ownership state); deleting the history (rejected: it loses evidence).
- **Consequences:** `review_log` has no FK to the card (it has one to users and senses).

### D13. Retired senses

- **Decision:** kept in the bank as _No longer reviewed_ (with "Replaced by" when set); excluded from selection; answers → 409.
- **Why:** honest, and consistent with decision #48; no silent migration of a learner's data.
- **Alternatives:** auto-moving to `replaced_by` (rejected: it changes what the learner saved).
- **Consequences:** the bank has a third section.

### D14. Personal mistake evidence

- **Decision:** the same wrong response key on the same sense at least twice in 30 days, unresolved (§16); computed from `review_log`.
- **Why:** narrow, explainable and truthful; no NLP.
- **Alternatives:** a `mistakes` table (rejected for now: derivable); error categories (rejected: not authored).
- **Consequences:** one bounded query; nothing is stored twice.

### D15. Home metrics

- **Decision:** due now (+ new), saved, learning, known, the next review time, recurring mistakes (≤ 3), recently saved (≤ 4).
- **Why:** every number is persisted or derived; each changes what the learner does next (UX principle 5).
- **Alternatives:**
  - "reviewed today" (rejected: it needs a timezone; low value);
  - mastery % (rejected: no evidence model).
- **Consequences:** `SAMPLE_LEARNER` and `src/demo/learner.ts` are removed.

### D16. Bank status: derived (D2), with three sections

- **Decision:** _Ready to review_ / _Coming up_ / _No longer reviewed_; 50 per page; no filters.
- **Why:** scanning by "what's next" is the job; filters are premature at this size.
- **Alternatives:** a flat sorted table with controls (rejected: the library-management feel).
- **Consequences:** filtering is Phase 6, if evidence shows it's needed.

### D17. Rate limiting

- **Decision:**
  - **Phase 5 requires a public search rate limit.** Vercel Firewall rate limiting, an available Vercel capability, provides it at the edge, configured with what the project's current plan offers (target 120 / min / IP, D7);
  - authenticated state-changing operations (saves, removals and review submissions) stay protected by application/database-level per-user limits: a per-user fixed window in Postgres (`request_limits`) at 60 / min (bank) and 30 / min (review);
  - this is an architectural decision. The exact Vercel configuration (confirming the plan, then creating and verifying the rule) is a **Step 0 operational task** (Step 0c, O1).
- **Why:**
  - search is a page render; edge enforcement needs no IP storage and no per-request write;
  - authenticated limits keyed by user are testable in CI and need no dependency.
- **Alternatives:**
  - Upstash/Redis (rejected: a new service);
  - reusing Better Auth's `rate_limits` table (rejected: owned by the library);
  - an app-level IP limiter for search (rejected: a database write per anonymous search).
- **Consequences:** one extra statement per authenticated write; the Firewall rule is an owner configuration step.

### D18. Email

- **Decision:** an operational check and fix by the owner (§22); no code change.
- **Why:** the code is correct; the risk is configuration.
- **Alternatives:** none needed.
- **Consequences:** recorded in the final audit either way.

### D19. Practice route: replaced

- **Decision:** `/practice` becomes the review session. Remove `src/demo/practice.ts`, the demo session and the `?step=` deep link. Keep the presentational components and the interaction design.
- **Why:** the demo has no persisted path to convert; incremental conversion would keep fake content alive beside real content.
- **Alternatives:** converting incrementally (rejected).
- **Consequences:** `src/demo/` becomes unused after Step 7 and is deleted, with its lint entries.

### D20. Progress: a placeholder, hidden from the primary navigation

- **Decision:** `/progress` stays an honest placeholder route (Phase 6+); the sidebar no longer lists it. Home carries the actionable numbers.
- **Why:** it reduces placeholder weight without a half-built screen.
- **Alternatives:** building it (rejected: out of scope); deleting the route (rejected: the URL is planned).
- **Consequences:** `PROTECTED_ROUTES` is unchanged; the nav entry moves out of `PRIMARY_NAV`.

### D21. Review answers through a route handler

- **Decision:** `POST /api/review/answers`.
- **Why:** HTTP-testable, real status codes, the same pattern as saves.
- **Alternatives:** a server action (rejected: the E2E harness can't call it reliably; no status semantics).
- **Consequences:** `isSameOrigin` is required; the shared HTTP helpers move to `src/server/http/`.

### D22. Pure learning modules in `src/learning/`

- **Decision:** a new lint-isolated folder.
- **Why:** keeps the scheduler and generator framework-free and testable; mirrors `src/language`.
- **Alternatives:** `src/language` (rejected: it's "content and search only"); `src/domain/` (rejected: a second convention beside the existing engine).
- **Consequences:** a new boundary rule in `eslint.config.mjs`; a decision-log entry on approval.

## 38. Step-by-step implementation plan

Every step is a PR into `phase/5-retrieval-loop`, built only after the previous one has merged. Steps that need owner review open as **drafts**.

**Always protected:** the golden suite, the ranking snapshot, the context-gap, filter and canonical-URL behaviour, and the saved-language API contract. The only exception is the additive fields stated per step.

### Step 0 — Production and search hardening

- **Goal:** fix the two live search errors, add authenticated write limits, settle the email and Firewall status, correct stale docs.
- **Work:**
  - **0a — search fixes:**
    - `showsMistake`: for an extra-words mistake, the query must include at least one word outside the differing span;
    - lookup: when the normalised query **exactly equals** an authored trigger, answer with that intent before typo correction. Exact equality only, no stems.
  - **0b — rate limiting:** `request_limits` (migration 0005), `rate-limit.ts`, applied to the save `PUT` / `DELETE`.
  - **0c — owner checks:** Firewall availability and the rule (D7); `EMAIL_FROM` (§22).
  - **0d — docs:** CLAUDE.md's current-spec pointer and the `src/demo` description; ARCHITECTURE §9–10 column names.
- **Files:** `src/language/search/match.ts`, `src/language/search/service.ts`, `test/search-golden.yaml` (new cases only), `src/server/db/schema/`, `drizzle/0005_*`, `src/server/http/rate-limit.ts`, `src/server/repositories/request-limits.ts`, `src/app/api/bank/saved/[senseId]/route.ts`, docs.
- **Tests:**
  - golden: "express contrast" / "describe an increase" / "give an example" → `CONTEXTUAL_EXPRESSION` with their intents; "for example" → no mistake lookup;
  - all 71 existing cases and the snapshot unchanged;
  - limiter unit and Postgres tests; a 429 E2E.
- **Acceptance:** both queries are fixed in memory and on Postgres; nothing protected changes; a 61st save in a minute → 429; O1 and O2 answered or recorded.
- **Risks:** trigger routing capturing a lookup. Mitigation: exact equality, and the protected-query check from §5.G.
- **Must not change:** ranking, classification of any non-trigger query, verdicts.
- **As built (22 October 2026):**
  - **Added by the owner after a database incident:** a local-database guard (`scripts/database-target.ts`) in drizzle-kit, `content:import`, the test suite and the E2E teardown. Only local hosts are allowed. A remote run needs `LEXORA_ALLOW_REMOTE_DB` set to the exact hostname in the shell. It's read before env files load, and `CI` grants nothing (README → Local-database guard).
  - **Test placement:** the Step 0 search cases live in `test/step-0-cases.ts` (run in memory and on Postgres), not in `test/search-golden.yaml`. The ranking snapshot covers every golden query, so adding golden cases would have added snapshot blocks. This way the golden file and the snapshot both stay byte for byte unchanged.
  - **Limiter clock:** the limiter takes the window from the application clock (whole UTC minutes), not the database's `now()`, so tests can pin it. The window, limits and 429 response are as §21 specifies.
  - **Firewall rule:** it can't live in `vercel.json` (`mitigate` supports only deny and challenge). The README → Search rate limit gives the dashboard and CLI configuration and the production check.

### Step 1 — Scheduler (pure)

- **Goal:** `src/learning/scheduler.ts` and `status.ts`, plus the `src/learning` lint boundary.
- **Files:** `src/learning/*`, `eslint.config.mjs`.
- **Schema:** none.
- **Tests:** §29 scheduler and status units.
- **Acceptance:** every transition and boundary is pinned; lint blocks forbidden imports.
- **Dependencies:** none.
- **Risks:** none significant.
- **Must not change:** anything outside `src/learning` and the lint config.

### Step 2 — Data model and repositories

- **Goal:**
  - `review_cards` and `review_log` (migration 0006);
  - `review-cards.ts` repository: create on save, the left-join reads, lock and update, log insert, evidence query;
  - `saveSense` creates the card in a transaction; the `PUT` response gains `review: "ready"`.
- **Files:** `src/server/db/schema/review.ts`, `drizzle/0006_*`, `src/server/repositories/review-cards.ts`, `src/server/repositories/saved-senses.ts`, the save route.
- **Tests:** the lifecycle, ownership, cascade and idempotency integration tests (§29); the existing saved-language E2E unchanged except the additive field.
- **Acceptance:** §9.4 holds in Postgres.
- **Dependencies:** Step 1.
- **Risks:** the composite FK to `saved_senses`. Mitigation: a migration test on a database with existing saves.
- **Must not change:** existing save semantics or status codes.
- **As built (22 October 2026, with Step 1 as one PR):**
  - **Combined:** the owner combined spec Steps 1 and 2 into one step. It contains `src/learning/scheduler.ts` and `status.ts` with their lint boundary, migration `0006_review_cards_and_log`, `src/server/repositories/review-cards.ts`, and the card created inside `saveSense`'s transaction.
  - **Confirmed by the owner:** the scheduler starts new cards in box 0 (§10, D3/D4), against a proposed box-1 start. Idempotency is `unique (card_id, review_number)` plus `expectedReviews` (D11), without a client-generated submission id.
  - **The answer primitive:** `recordAnswer` (`src/server/learning/review.ts`) implements §15 steps 4.2–4.5 and 4.7. Regenerating and evaluating the exercise (4.6) and the HTTP endpoint stay in Step 5.
  - **Deferred to Step 8:** the `PUT` response's `review: "ready"` field, where the save notice first uses it, so the save API is unchanged in this step.
  - **Extra checks** beyond §9: `review_cards` counts are non-negative, `review_number ≥ 1`, `box_after` is 1–5, and `answer` is at most 80 characters.

### Step 3a — Exercise generator and content model

- **Goal:**
  - `src/learning/exercises.ts` and `answers.ts`;
  - the `practice` block (Zod, validation, `examples` columns, migration 0007, importer);
  - `practiceMaterial` on the language repository (Postgres and memory);
  - the readiness report in `content:check`;
  - `content/README.md`.
- **Tests:** generation over the whole corpus, answer evaluation, validation errors, import twice (idempotent), memory/Postgres parity for `practiceMaterial`.
- **Acceptance:** 42/42 senses, 77 / 45 / 56 exercises pinned; the golden suite and snapshot unchanged (search never reads the new columns).
- **Dependencies:** Step 1.
- **Risks:** the generator rules hiding a bad blank. Mitigation: the report, then 3b.
- **Must not change:** search queries or results; existing content.
- **As built (22 October 2026):**
  - **Exact inventory:** 42 senses, 77 complete the sentence, 45 type the preposition, 56 which is correct, 178 in total, as audited.
    - Every sense has at least two exercises; by type, 3 senses have one type, 25 have two and 14 have three.
    - Six examples make no blank:
      - completion: the forms are split ("pose a serious threat", "raise public awareness", "take urgent measures") or not present ("a sharp rise");
      - preposition: the highlight runs past the preposition ("contribute to keeping", "important to me").
  - **Ambiguity, as the owner confirmed:** every safely located blank is generated (§12.1). Near-synonyms are accepted only through the Step 3b `practice.accept` review, which comes before any learner sees an exercise (Step 5).
  - **Normalisation is narrower than §12 states:** case, apostrophes, spaces and end punctuation only (`normaliseAnswer`), not `normaliseTerm`, so punctuation inside words is kept.
  - **"Which is correct?"** skips a mistake only when both versions read the same as written. §12.3's normalised comparison would have dropped the 4 punctuation-only mistakes, whose difference is the point of the exercise.
  - **Validation:** `content:check` also rejects `accept` on an excluded blank. `content:check --practice` lists every exercise for the 3b review.
  - **The database read:** `loadPracticeMaterial` (`src/server/repositories/language/practice.ts`) is asserted equal to the content-built material. `IMPORTER_VERSION` is 2, so the next import writes the new columns.

### Step 3b — The accept-list content pass (a content PR, owner-reviewed, draft)

- **Goal:** add `practice.accept`, `accept_preposition` or `exclude` to the existing examples where needed (§27.3).
- **Files:** `content/items/*.yaml` only.
- **Tests:** the readiness report; generation counts updated with an explanation in the PR.
- **Acceptance:** the owner has reviewed every completion blank.
- **Dependencies:** 3a.
- **Must not change:** example text, highlights or IDs; any other content field.
- **As built (23 October 2026, branch `fix/5-step-3b-accept-lists`):**
  - **Reviewed:** all 178 exercises. The rule: an answer is accepted only where the content already establishes that it fits the exact construction (a collocation, pattern, frame, authored note, or a linker's authored role) and it keeps the meaning, register and strength.
  - **Added:** 31 `practice` entries on existing examples.
    - 26 completion blanks gained 28 accepted answers.
    - 5 preposition blanks gained 1 each.
    - No `exclude`.
  - **Unchanged:** the inventory (77 / 45 / 56 = 178) and every exercise ID.
  - **Not done here:** no generator, validator, schema or migration change. Questionable mistakes are reported for owner review, not edited.

### Step 4 — Language bank

- **Goal:** the real `/bank` (§17): loader, sections, status, next review, evidence note, remove, empty, loading and error states; `/design-system` and DESIGN.md updated (bank row, status badge).
- **Files:** `src/features/bank/*`, `src/app/(app)/bank/page.tsx`, `src/server/learning/bank.ts`, `src/components/lexora/*` (status badge variant), `src/components/shell/navigation.ts` (bank status text), DESIGN.md.
- **Tests:** the loader's integration test, query count ≤ 3, HTML accessibility, E2E bank listing and removal.
- **Acceptance:** §17 states render; removal keeps history.
- **Dependencies:** Steps 2 and 3a.
- **Must not change:** public pages; the save endpoint contract.
- **As built (23 October 2026):**
  - **Rows show more than §17 listed:** the definition, the first authored pattern and the first authored example, as the owner asked. They come from the practice material, which also says whether the sense has an exercise, so senses with none show _No exercise yet_ under _Coming up_.
  - **The summary line counts scheduling states.** A sense with no exercise is counted by its schedule; none exist today.
  - **No _Start review_ button:** `/practice` is still the labelled prototype until Step 5, so the button would lead to sample questions. Step 5 adds it.
  - **The next review is "Due now" or "Next review in n days"** (whole days, rounded up), including "in 1 day" rather than "Back tomorrow". The bank has no timezone, so "tomorrow" could be wrong.
  - **No "Missed n times" note:** it's mistake evidence, which is Step 6.
  - **The removal notice is the save flow's current one.** Its "review history is kept" copy is Step 8.
  - **The page reads the counts before streaming the rows,** so a page past the end is a real redirect.
  - **The status badge gains Known, No longer reviewed and No exercise yet.** Mastered stays for the prototype Home until Step 7.
  - **No migration.**

### Step 5 — Review session

- **Goal:** `/practice` replaced (§15); `POST /api/review/answers` (D21) with the review limit; feedback; summary; error states (§24).
- **Files:** `src/features/practice/*` (rewritten), `src/app/(app)/practice/page.tsx`, `src/app/api/review/answers/route.ts`, `src/server/learning/review.ts`, shared `src/server/http/*`, `src/demo/practice.ts` (deleted).
- **Tests:** security (401, 403, 400, 404, 409, 429, duplicate); E2E for the full flow; accessibility; query counts.
- **Acceptance:** an answer persists, reschedules and logs exactly once; feedback is authored; no demo questions remain.
- **Dependencies:** Steps 3a and 4.
- **Must not change:** the golden suite; other routes.
- **As built (23 October 2026):**
  - **The answer is checked inside the locked transaction.** `recordAnswer` takes a pending answer whose check runs after the lock, the duplicate check and the due check, against the exercise regenerated for `expectedReviews` (§15 step 4.6). So a retired sense is `retired` and a retry is `duplicate`, never `exercise_changed`. An answer that isn't one (`!!!`, or `c` for a choice) is 400 `invalid_answer` and records nothing.
  - **Typed prompts leave out the headword.** For a completion it is the answer, and for a pattern item it holds the preposition. A "which is correct?" keeps it, since both options contain it. Sense and exercise ids are authored ids and do name the item; they're needed to answer and grant nothing.
  - **The feedback response** is `{ duplicate, outcome, match, expected, accepted, explanation, pattern, term, senseLabel, href, nextReview }`, with `nextReview` as the bank shows it ("Next review in 3 days"). Copy follows §12; the full sentence is the prompt's, filled by the client.
  - **No intro screen.** The first exercise shows at once. A typed exercise focuses its input, whose label carries the sentence; a choice focuses the heading (§25 says the heading for both).
  - **Practice renders in one pass, without a Suspense skeleton.** The exercise is then in the HTML that `e2e/accessibility.e2e.ts` checks.
  - **"Review 5 more"** appears when the session's read found more than five due exercises. It reloads, and the server reselects.
  - **The bank gets _Start review_** ("n due", counting due and new), as §17 describes.
  - **Small widenings:** `isDue` and `nextReview` take any `{ dueAt }`, a type-only change; `nextReviewText` moved into `status.ts` so the bank and practice share one wording; `guarded` logs the error class, not its message.
  - **Prototype links left alone:** the prototype Home and the design-system showcase still link to `/practice?step=n`. The parameter is now ignored, and Step 7 replaces Home.
  - **No migration.**

### Step 6 — Personal mistake evidence

- **Goal:** the recurring-mistake query (§16) surfaced in review feedback and in bank rows.
- **Tests:** evidence units and integration (threshold, window, resolution); the repeated-wrong E2E.
- **Acceptance:** two identical wrong answers produce a recurring mistake; two later correct answers resolve it.
- **Dependencies:** Step 5.
- **Must not change:** scheduling (evidence doesn't alter intervals).
- **As built (23 October 2026):**
  - **Derived from `review_log`, no table and no migration (D14, confirmed by the owner).** `recurringMistakes` in `review-cards.ts` is the §16 query, one statement for any number of senses: it uses the existing `(user_id, reviewed_at)` and `(user_id, sense_id, reviewed_at)` indexes and reads only the 30-day window. Because the log row is the evidence, it is atomic with the answer by construction, and a refused, duplicate or rate-limited request (which logs nothing) can never count.
  - **The window is the 30 days of 24 hours before `now`, exclusive:** an answer exactly 30 days earlier is out, one a millisecond later is in, and answers after `now` don't count.
  - **The response key is §16's,** including exact repeated typed answers Lexora doesn't list (`answer:<normalised answer>`), as the owner confirmed. Typing an authored mistake and choosing it share its mistake id, so they count together. Resolved (the sense's two latest answers correct, both after the latest occurrence) is derived, not stored.
  - **Feedback** gains `evidence` when the wrong answer just recorded makes a recurring mistake: computed as of that answer, so a retry gets the same result. Copy: "You've made this mistake 2 times in the last 30 days", or "You typed “at” 2 times in the last 30 days".
  - **Bank rows** show "Missed n times" when the card has at least two lapses, and each unresolved recurring mistake as a `MistakeRow` ("Your mistake": the authored wrong → right and explanation, read from content). One more statement per page.
  - **Evidence follows the log's retention:** it outlives a removed save, so it shows again if the sense is saved again within the window. Retired senses show none.
  - **No change** to the scheduler, selection, exercises, answers or content. Home's recurring mistakes are Step 7.

### Step 7 — Honest Home

- **Goal:** §18. Remove `SAMPLE_LEARNER`, `src/demo/` and its lint references; `PRIMARY_NAV` changes (Progress hidden, D20; Home and Practice lose "prototype").
- **Files:** `src/features/dashboard/*`, `src/app/(app)/home/page.tsx`, `src/server/learning/home.ts`, `src/components/shell/navigation.ts`, `src/demo/*` (deleted), `eslint.config.mjs`, DESIGN.md §10.1.
- **Tests:** the home loader's integration test (counts match), query count ≤ 3, E2E, accessibility.
- **Acceptance:** no sample data anywhere in the app.
- **Dependencies:** Steps 5 and 6.
- **Must not change:** the verification reminder; settings.
- **As built (23 October 2026):**
  - **Routes unchanged, as the owner chose over the Step 7 prompt:** Home stays `/home`, the public landing stays `/`, the Finder `/finder`. The primary navigation is Home, Language Finder, Language bank, Practice, Writing Lab and Speaking Lab. Progress moved to `HIDDEN_NAV` (out of the sidebar and command palette, D20), and `/progress` stays a placeholder whose status now says "a later phase".
  - **Data:** `loadHome` (`src/server/learning/home.ts`) reads `bankCounts`, the soonest upcoming review (`reviewQueue`), the four latest saves (`recentlySaved`) and the recurring mistakes over all the learner's senses (`recurringMistakes(…, null, …)`) in parallel. Then it loads the practice material and slugs of the senses those name (five batched statements), nine in all. The ≤ 3 target counted neither each row's real status (which needs practice material, as in the bank) nor the mistake text read from content.
  - **"Ready" is due plus new by schedule,** as in the bank. The next review is given only when nothing is ready.
  - **First use:** "Welcome to Lexora", the §18 header line, _Find language_ and one panel on what the bank does. A returning learner sees "Welcome back". A failed read shows a danger `Callout`, never stand-in data.
  - **Recurring mistakes and Recently saved are hidden when empty,** as §18 says: no empty-state message.
  - **Removed:** `src/demo/` (only the prototype dashboard used it), its ESLint patterns, the `Mastered` badge (the fixture now says Known), and the showcase's `/practice?step=3` link.
  - **No migration, content, scheduler, selection or evidence change.**

### Step 8 — Save and review UX copy

- **Goal:** the save notice with _Open language bank_; the remove notice; the save gate and landing copy (§19); DESIGN §10.7.
- **Files:** `src/components/language/saved-language.tsx`, `save-gate-dialog.tsx`, `src/app/(public)/page.tsx`, DESIGN.md.
- **Tests:** existing saved-language E2E (text updated); route-boundary checks (public pages still import no server code).
- **Acceptance:** every promise in the copy is true.
- **Dependencies:** Step 7.
- **Must not change:** save behaviour; public rendering or SEO.
- **As built (24 October 2026):**
  - **`review` on the `PUT` response is `"ready"` or `"scheduled"`.** A new save is due at once (D3), but `PUT` is idempotent: saving a meaning again leaves its schedule alone. So the handler reads the card after saving and says `"ready"` only when it's due. The notice adds "It's ready to review." only then. This costs one more statement per save, and nothing about saving changed.
  - **The notice carries the _Open language bank_ link** for every successful save, including a save completed after signing in from the gate.
  - **The removal notice** is the same everywhere, the bank included: "…Its review history is kept."
  - **The save gate and landing copy** are exactly §19's. The landing's "practise it until it comes naturally" stays: review now makes it true.
  - "Ready to review" relies on every published sense having an exercise, which `test/exercise-inventory.test.ts` pins (42 of 42).
  - **No change** to public rendering, route boundaries, migrations or content.

### Step 9 — Final audit and release

- **Goal:**
  - the full verification;
  - a security review of the new endpoints;
  - the manual Chrome pass at the six widths, keyboard-only;
  - performance (§32);
  - the Phase 5 audit document;
  - the production runbook (§31, with the rollback SQL);
  - ROADMAP and ARCHITECTURE (decision log D1–D22);
  - the phase PR to `main` (the owner labels it; never Claude Code).
- **Acceptance:** §39.

## 39. Definition of done

Phase 5 is complete only when all of these hold:

1. Saving a published sense creates a real review card (or a pre-Phase-5 save reads as _New_ and gets a card on its first answer).
2. The learner sees it in the language bank with a truthful status and next review.
3. The learner can review it in `/practice`.
4. The answer is evaluated deterministically on the server against authored data only.
5. Feedback is authored and truthful (it never claims an unrecognised answer is bad English).
6. Review state persists; the next review time changes exactly as §10 defines.
7. Wrong answers are recorded in `review_log`.
8. Repeated mistakes are surfaced (§16).
9. Home contains no sample or fake learner data.
10. Practice contains no fixed demo session.
11. The save flow communicates the real next step, and the landing and save-gate copy is true.
12. Unauthenticated users can't read or write review data.
13. No learner can read or answer another learner's cards.
14. Rate limiting is in place where §21 requires it: the Vercel Firewall public search limit, configured in Step 0c (D17), and the per-user limits on saves, removals and review submissions.
15. The production email status is resolved or recorded (O2).
16. Phase 4 search behaviour is unchanged: the golden suite and snapshot pass byte-for-byte except Step 0's added cases.
17. Unit, integration, E2E and accessibility tests pass; format, lint, typecheck, content check and build pass.
18. The production migration and deployment procedure is documented and was followed.
19. No AI is required anywhere.

**Not required:** Wave 2, Writing Lab, Speaking Lab, semantic search, gamification, reminders, a Progress dashboard, Phase 6 exercise breadth.

## 40. Explicit deferred work

| Item                                                                                  | Destination                                   |
| ------------------------------------------------------------------------------------- | --------------------------------------------- |
| "Which expression fits?" with authored per-sentence distractors                       | Phase 6                                       |
| Typed whole-sentence correction; collocation drills; writing↔speaking register switch | Phase 6                                       |
| Early review ("practise anyway"); test-date interval cap; intervals beyond 30 days    | Phase 6                                       |
| Hints and a "correct with hint" outcome                                               | Phase 6                                       |
| Bank state on result cards and language pages; UI-2 sense labels                      | Phase 6                                       |
| Bank filters and search                                                               | Phase 6 (if evidence shows need)              |
| A Progress screen                                                                     | Phase 6+                                      |
| Reminders and email digests                                                           | Deferred (needs the email domain and consent) |
| Scanning learner text for authored mistakes                                           | Phase 7 (Writing Lab)                         |
| Speaking transcripts                                                                  | Phase 8                                       |
| Wave 2 items, topic tagging                                                           | Content stream                                |
| Word roles (F4), names, sentence-final linkers, whole-sentence checks                 | Future engine                                 |
| Unmatched-query logging, caching, indexable task/function pages                       | Infrastructure / Phase 6                      |
| Error monitoring, CSP                                                                 | Phase 10                                      |
| AI explanations or exercise generation                                                | Phase 9 (optional)                            |
