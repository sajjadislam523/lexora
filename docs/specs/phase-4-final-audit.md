# Phase 4 — Final audit: Search Depth and context gaps

Written: 20 October 2026 · Audited: `phase/4-search-depth` at `e131486` (PRs #16–#34 merged) · Status: **audit only, awaiting owner review**

Nothing in the code, content, schema, tests or UI changed during this audit. Probe scripts ran outside the repository against the published content, in memory and on the local Docker PostgreSQL.

## 1. Executive summary

**Phase 4 as approved is not ready to close.** The context-gap slice is ready, with minor follow-ups. The rest of the approved scope was never built.

- **The context-gap slice (Steps 3–4.6, F3) is ready, with minor follow-ups.** It is deterministic, explained, isolated from ordinary search, at parity between memory and Postgres, within its performance budget, accessible and responsive. It has one small UI wording follow-up and one small precision repair worth doing before closure (§16).
- **Approved scope that hasn't been built.** Measured against ROADMAP's Phase 4 exit criteria, these are missing:
  - search rate limiting (Step 6);
  - privacy-first unmatched-query feedback (Step 7);
  - latency measured on a warm Preview (Step 8);
  - the ranking corrections review (Step 9);
  - the sentence-level check (part of Step 5b);
  - Wave 2 content (at least 140 published items; there are 40).

  Topics exist in the model but no sense is tagged yet. The Step 4.x work (the owner's re-numbering of the parent spec's Steps 5a/5b) never covered these items.

- **The owner's choice:** build the remaining scope, or formally re-scope Phase 4 and move it to a later phase. Both are workable; nothing in the audited code blocks either.

## 2. Phase 4 scope audited

| Area                                            | PRs                | Status              |
| ----------------------------------------------- | ------------------ | ------------------- |
| Step 0 — specification and docs                 | #16                | Merged              |
| Step 1 — regression baseline (golden, snapshot) | #17                | Merged              |
| Step 2 — topics and functions model             | #19                | Merged              |
| Step 3a/3b — filter engine and filter/browse UI | #20, #22           | Merged              |
| Step 4.0 — context-gap specification            | #24                | Merged              |
| Step 4.1 — gap reader and honest fallback       | #25                | Merged              |
| Step 4.2 — candidates                           | #26                | Merged              |
| Step 4.3 — verdicts                             | #27                | Merged              |
| Step 4.4 — context coverage (+ follow-up)       | #28–#30            | Merged              |
| Step 4.5 — context-gap extensions               | #31, #32           | Merged              |
| Step 4.6 — context-tool UI                      | #33                | Merged              |
| F3 — countability content                       | #34                | Merged              |
| CI automation, preview isolation                | #15, #18, #21, #23 | Merged              |
| Steps 6–9, the sentence-level check, Wave 2     | —                  | **Not built** (§17) |

## 3. Verification results

On `e131486`, with the local Docker PostgreSQL:

| Check                                    | Result                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| Format (`prettier --check`)              | Pass for every tracked file (two untracked owner snippet files flagged) |
| Lint, typecheck                          | Pass                                                                    |
| Content check                            | 40 items, 42 senses, 8 intents, 1 source                                |
| Content import (twice)                   | Release imported; the second run finds nothing to import                |
| Schema drift                             | None                                                                    |
| Unit + integration (`CI=true pnpm test`) | **944 / 944** in 46 files                                               |
| E2E / browser (`pnpm test:e2e`)          | **205 / 205** in 9 files, including the HTML accessibility suite        |
| Build                                    | Pass                                                                    |
| Golden suite (71 cases)                  | Pass, memory and Postgres                                               |
| Ranking snapshot (73 blocks)             | Pass. Every change since Step 1 is explained in its PR; the last was F3 |

## 4. Context-gap behaviour verified

About 130 probe sentences on the real content (scripts outside the repository).

**Reader (Step 4.1):**

- Underscores are always blanks.
- An ellipsis is a blank only between words: "responsible … the project" is a gap; "however…", "important........" and "There is growing concern about ..." are ordinary searches.
- A query with underscores treats any ellipsis as punctuation.
- More than two blanks → ordinary search with `gapNote: too_many_gaps`.
- A comma between blanks ends each window ("responsible ___ pollution, ___ cities" reads blank 2 as a linker slot).
- Blanks with no words ("__**", "**_ ___") → no answer: the page shows the Explore introduction, as for punctuation-only input.

**Candidates and verdicts:** all candidate kinds behave as specified, the five verdicts follow the 4.3 precedence, and the 4.4/4.5 guards hold.

- prepositions by base, by authored inflected forms ("poses a threat ___") and after a verb frame's object ("allocated money ___");
- collocations by any content word ("___ a threat"), with authored first-word inflections ("took / rose / plays");
- linkers by punctuation (always _Depends_);
- the protected verb frames, unchanged;
- pairs from one authored structure;
- "It is ___ that" (_Likely fits_ at best);
- the five verdicts: mistakes → _Unlikely_; unauthored frame objects → _Not supported_; checked → _Fits_; one unchecked part → _Likely fits_; undecidable → _Depends_;
- learner-word and inflection leakage blocked ("take ___ measures", "raise ___ awareness");
- an unchecked side hedged (R-1 _be_/_have_, R-2 a content word after, function words before);
- punctuation boundaries respected ("There was a ___, increase" → nothing).

## 5. False-positive findings

| #    | Query (real content)                                                                                          | Actual                                                              | Why it matters                                                                                                                                                                                                                                                              | Class                                 | Action                                                                                                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| FP-1 | A substantial ___ to the budget · It had a significant ___ in health · There was a significant ___ on cycling | _evidence_ / _impact_ / _difference_… **Fits**                      | A collocation ending at the blank is followed by a preposition the engine doesn't check. Yet 23 of 39 collocations author what follows them ("a significant impact on + noun", "substantial evidence that + clause"). False Fits backed by evidence the content already has | **Fix before Phase 4 closes** (small) | Precision repair "R-3": when the authored `pattern` says what follows and the learner's next word differs, at most _Likely fits_. Lowers only |
| FP-2 | The main focus ___ the report · The result ___ the policy · ___ a result ___ the new policy (F4)              | _on_ **Fits** · _from_, _in_ **Fits** · gap 2 _from_, _in_ **Fits** | A noun use of a verb pattern's base is read as the verb. This is wider than F4: any base that is also a noun                                                                                                                                                                | Future engine/model work (word roles) | Record as a known limitation. A heuristic would just move the error, and word roles are authored data                                         |
| FP-3 | A ___ amount of people (F3)                                                                                   | _considerable_, _substantial_ **Fits**                              | The mistake is the learner's "amount", outside the gap. The CC-D9 rule counts a mistake only against the word in the gap                                                                                                                                                    | Future engine/model work (narrow)     | Optionally show surrounding-text mistakes in _Mistakes to avoid_ without changing verdicts. Needs an owner decision on CC-D9                  |
| FP-4 | A sharp rise ___ prices · The policy ___ rise ___ protests (gap 2)                                            | _sharply_… _Likely fits_                                            | A wrong role (noun "rise"), but already hedged by R-2                                                                                                                                                                                                                       | Intentional limitation                | None                                                                                                                                          |
| FP-5 | Prices ___ sharply · Plastic waste ___ a threat                                                               | _rise_ / _pose_ Fits, in base form                                  | Fills are base forms, so the agreement the sentence needs ("rises", "poses") isn't checked. Lexora describes the pattern, not the grammar                                                                                                                                   | Intentional limitation                | None (copy says "pattern", never "grammar")                                                                                                   |
| FP-6 | There is ___ a threat (after the 4.4 follow-up)                                                               | _pose_ _Likely fits_                                                | Was a false Fits; fixed                                                                                                                                                                                                                                                     | False alarm / no action               | —                                                                                                                                             |

## 6. False-negative / conservative-result findings

| #    | Query                                                                          | Actual                         | Why                                                                                               | Class                    | Action                      |
| ---- | ------------------------------------------------------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------ | --------------------------- |
| FN-1 | There is ___ debate · There is ___ evidence · Campaigns aim to ___ awareness   | _Likely fits_ for correct uses | The left-side rule (4.4 follow-up, R-1) hedges after function words and _be_/_have_ forms         | Intentional limitation   | None: precision over recall |
| FN-2 | It is ___ to consider the costs · It's ___ that … · Their interest ___ history | Nothing                        | No authored structure ("it is important to", contractions, "interest in")                         | Separate content PR      | Wave 2 content              |
| FN-3 | important ___ John · responsible ___ parents                                   | _to_ _Depends_                 | Only closed-class pronouns are read as persons (OQ-C)                                             | Intentional limitation   | None                        |
| FN-4 | The plan failed, ___.                                                          | Nothing                        | Sentence-final linkers deferred (OQ-D)                                                            | Intentional limitation   | None                        |
| FN-5 | Students are responsible ___ of the project                                    | _for_ _Likely fits_            | A preposition after the blank isn't recognised as contradicting a noun complement; already hedged | Future engine/model work | Fold into R-3 if it's built |

## 7. Two-gap audit

**Valid pairs, each one authored structure with one shared verdict:**

- **Verb frames:** "Governments should ___ more money ___ public transport" → invest … in/into, allocate … to/for (_Likely fits_); "Schools should ___ more time ___ the curriculum" → five pairs, _Fits_; "People should ___ more attention ___" → devote … to; "Governments ___ billions ___ research" → invest … in/into.
- **Patterns on a phrase:** play … in, pose … to, raise … of/about, take … against, give … to, have … on, as … of.

**Correctly not paired:**

- a comma between the blanks;
- words between the object and blank 2 ("money each year ___");
- a collocation variant ("a serious threat ___");
- an object the frame doesn't author ("___ land ___");
- a stopword head ("___ contrast ___");
- two independent structures ("responsible ___ pollution and depend ___ oil");
- more than two blanks.

**Shared verdict and order:**

- Mistakes are checked with both blanks filled.
- The pair group comes first; the independent groups keep their order.
- The left side of blank 1 is hedged ("We need to ___ …" → _Likely fits_).

## 8. Mistake intelligence

- **What works:** authored mistakes become negative evidence only when the candidate itself is the wrong word, with its authored neighbours ("important **for** me" → _Unlikely_; "result **in** smoking" → _Unlikely_). Patterns' linked mistakes are shown with their candidates.
- **F3:** the content PR (#34) adds the countability mistake to _considerable_ and _substantial_, so ordinary searches show the correction. The gap answer is unchanged (FP-3).
- **The remaining limitation:** the engine ties mistake evidence to the word in the gap, so a mistake in the learner's surrounding text doesn't lower the candidate.
  - **Scope:** this is a **narrow, known limitation** of the deliberately conservative CC-D9 rule, not an architectural flaw.
  - **Reach:** of 56 mistakes, 40 have a wrong word that is never a candidate. Those already serve ordinary search and language pages, where the learner types the wrong form.
  - **Classification:** future engine/model work, a display-only notice at most.

## 9. F4 / word-role findings

- **F4 is still present:** "___ a result ___ the new policy" → gap 2 _from_ / _in_ _Fits_.
- **The same class elsewhere:** "The main focus ___ the report" → _on_ _Fits_; "The result ___ the policy" → _from_, _in_ _Fits_. Gap 2 of "The policy ___ rise ___ protests" is the same kind of error, but hedged at _Likely fits_.
- **Cause:** every preposition pattern whose base is also a noun is exposed (focus, result, rise).
- **Classification:** future engine/model work. The fix is authored word-role data (a pattern's base is a verb or adjective) plus an engine rule that uses it, not another lexical exception.

## 10. UI audit

**What renders correctly:**

- **Verdicts:** all five labels render as text with an icon, in the server's order. There are no scores or percentages, and a disclosure explains the labels.
- **Reasons:** the engine's own sentences, never raw evidence codes.
- **Pairs:** the group comes first; _invest … in_ is one answer that fills both blanks; independent groups carry "for one gap each" and no connector. An end-to-end test checks that no pairing is suggested when none exists.
- **Mistakes:** only the response's authored mistakes, as corrections.
- **Fallback:** an info callout for `too_many_gaps` above the unchanged ordinary results. The empty state says Lexora has no pattern "yet", never that no answer exists.

**Problems:**

- **Protected Phase 3 wording (UI-1):** the engine labels a verb-frame group "Fits this sentence", and in a one-blank sentence it can hold an _Unlikely_ row (allocate … to, for "… into public transportation"). In a two-blank sentence every row in it is _Likely fits_. A heading that contradicts its rows is **misleading, not just awkward**.
  - **Recommended fix:** a UI-only relabel in the context tool, for example "Verbs for this gap" / "Other verbs", keeping the engine label so the golden suite is untouched. **Fix before closure (small UI PR).**
- **One-blank verb sentence:** the preposition the engine read is shown as a second slot that the chosen verb fills (Phase 3 behaviour). Acceptable; it's the original interaction. Intentional.
- **Duplicate-looking rows (UI-2):** "The weather depends ___" lists _on_ twice, once per sense of _depend on_, with different reasons. Optional polish in the same UI PR: show the sense label.

**Accessibility and responsiveness:**

- The HTML accessibility suite and the context-tool end-to-end tests pass: headings, lists, named toggle buttons with `aria-pressed`, numbered blanks for screen readers, verdict text.
- Keyboard and focus were verified in Chrome in Step 4.6.
- **Overflow:** none on any of 11 page states × 7 widths (320, 375, 390, 640, 768, 1024, 1440) on the production build. The "Search as" chip row scrolls on purpose.

## 11. Filter audit

- **Order of work:** filters run after reading and verdicts. They never change the reading, `gaps` or a verdict; they keep or remove whole pairs by sense. This is pinned for every single filter value in tests.
- **Combined filters:** AND ("kind=word & use=writing" on the pair query) is consistent.
- **Empty and reset:** an empty result says "found N, none match these filters", with a way back.
- **URLs:** in canonical order, with 307 redirects from other orders. Signed-out visitors use `/explore`; `/finder` redirects them to sign-in.
- **Topic filter:** every topic filter is empty today, because no sense has a topic (§15).

## 12. Parity audit

- **Coverage:** 176 queries (every probe, plus 54 ordinary queries) × 10 filter sets, including two-filter combinations: 1,760 comparisons between Postgres and memory.
- **Context gaps:** **0 differences**.
- **The 30 differences:** all in three ordinary queries that fall back to full text ("increase", "give an example", "words for a serious problem"). This is the known difference recorded in Step 1: the test-only memory repository approximates Postgres full-text search. It's a test artifact, not a bug. Production uses Postgres.

## 13. Performance

Local Postgres, statements logged by Drizzle, the median of 5 warm runs:

| Case                                 | Statements  | Median          | Max             |
| ------------------------------------ | ----------- | --------------- | --------------- |
| Ordinary · typo · full-text fallback | 7 · 12 · 11 | 17 · 28 · 22 ms | 24 · 31 · 29 ms |
| Protected verb frame                 | 5           | 8 ms            | 9 ms            |
| One gap: preposition · after object  | 14 · 15     | 25 · 30 ms      | 26 · 33 ms      |
| One gap: collocation · linker        | 14 · 10     | 29 · 18 ms      | 30 · 19 ms      |
| Two gaps: independent                | 15          | 34 ms           | 36 ms           |
| Two gaps: frame pair · pattern pair  | 16 · 15     | 34 · 28 ms      | 35 · 30 ms      |
| It is ___ that                       | 14          | 26 ms           | 28 ms           |
| Two-gap pair + 2 filters             | 17          | 31 ms           | 33 ms           |
| Unreadable gap                       | 9           | 16 ms           | 18 ms           |

These match Step 4.5 (≤ 16 unfiltered). There are no per-candidate queries and no N+1 loops.

- **Filtered queries:** they add one read (Step 3a's facets), so the filtered pair query uses 17. That's a documentation note, not a regression.
- **The p95 budget is unverifiable as written (OPS-1):** the Step 8 budget (p95 ≤ 150 ms on a **warm Preview**) can't be measured, because Vercel now deploys `main` only and Previews are off (decision #65). The owner should decide where to measure: production after merge, or a manual Preview.

## 14. Security / SEO / routing

- **SQL:** every value is bound, and every `LIKE` input is escaped (`escapeLike`). No learner text reaches SQL or a regular expression unescaped; the one client regex escapes its engine-supplied preposition. Queries are capped at 200 characters.
- **Bounded reads:** the reads are bounded by query (≤ 16 words, ≤ 4 between blanks) and by content size (frames, linkers, pair patterns).
- **Output:** React escapes all output (a `<script>` probe renders inert). No debug output. Authored evidence ids travel in the RSC payload but are public content ids, not internal identifiers. No saved data is read on public pages.
- **SEO:** every gap, fallback and filtered page is `noindex, follow` with the canonical set to `/explore`. The sitemap contains no Explore URLs; `robots.txt` disallows the personal routes.
- **Production readiness (OPS-2):** merging Phase 4 to `main` deploys production, which needs **migration 0004** (topics/functions, expand-only) run against Neon's direct URL **before** the deploy, then a reviewed production content import (it brings the F3 mistakes). That is a manual owner step today; ARCHITECTURE §Production rollout documents it.
- **Infrastructure:** search rate limiting is not in place (Step 6). There's no monitoring beyond Vercel's defaults (Phase 10).

## 15. Content coverage

Content has 40 items and 42 senses:

- **Kinds:** word 11, linker 11, preposition pattern 7, collocation 6, functional expression 2, sentence pattern 2, phrase 1.
- **Structures:** 29 preposition patterns, 39 collocations (23 with a `pattern` continuation), 6 frames (3 usable as gap verb frames), 11 linkers, 56 mistakes, 103 examples, 99 forms.

**Gaps that limit Phase 4 (content-model limits, not bugs):**

- **Topics:** **0 of 42 senses tagged**, so every topic filter is empty (criterion 9 is met for the model only).
- **Functions:** the Step 2 additions (comparison, decrease, opinion, hedging) have **no senses**. Linkers cover addition 5, contrast 5, and concession, example and result 1 each; there is no comparison or cause linker.
- **Verb frames:** 3, all verb + object + preposition. There are no -ing, clause, person or infinitive frames (OQ4), and common frames are missing ("pay attention to", "spend money on").
- **Word roles:** none on collocations or pattern bases (FP-2, FP-4).
- **Persons:** there's no noun-or-person complement (`depend on + noun / person` is stored as noun).
- **Countability:** authored only as mistakes (F3); collocation `pattern` continuations exist but are unused (FP-1).
- **Forms:** collocations have no contractions ("it's"), and only items have inflected forms.
- **Overall:** Wave 2 (≥ 140 items) hasn't started; the coverage targets aren't met.

## 16. Classified findings

### Fix before Phase 4 closes

1. **UI-1:** relabel the Phase 3 verb-frame group headings in the context tool so a heading never contradicts its rows' verdicts. UI only; the engine labels and golden suite are unchanged. A small `fix/` PR. Optionally include UI-2 (sense labels on same-word rows).
2. **FP-1 / R-3:** use the authored collocation `pattern` continuation. When the learner's next word after a collocation that ends at the blank differs from what its pattern says follows, the verdict is at most _Likely fits_. It lowers only, uses evidence that's already authored, and is a small engine PR with tests.
3. **The remaining approved Phase 4 scope, unless the owner re-scopes it:**
   - Step 6: rate limiting (verify Vercel Firewall first);
   - Step 7: unmatched-query feedback;
   - Step 8: the performance budget, including the measurement question (OPS-1);
   - Step 9: ranking corrections (could close quickly: no ordinary-search failures were found);
   - the sentence-level check (5b);
   - Wave 2 content;
   - topic tagging.
4. **OPS-2:** a written production rollout for the Phase 4 → `main` merge (migration 0004, then the reviewed import), and the owner runs it.

### Separate content PR

- **Topic tagging** of existing senses (unblocks the topic filter).
- **Wave 2 batches:** comparison/cause linkers, the new functions, more frames ("pay attention to"), "it is important to", and more preposition mistakes that can act as negative evidence.
- **More `pattern` continuations** on collocations, if R-3 is built.

### Future engine/model work

- **Word roles for pattern bases and collocations** (FP-2 / F4 and similar).
- **Surrounding-text mistakes** shown with gap answers, without changing verdicts (FP-3 / F3; an owner decision on CC-D9).
- **A noun-or-person complement and an authored person-noun list** (OQ-C).
- **Sentence-final linkers** with structured punctuation (OQ-D, OQ6).
- **Collocation-variant pairs** (G5-D7); contractions in collocations.
- **A preposition after a noun-complement blank** recognised as contradicting it (FN-5).

### Intentional limitation

- Fills shown in base form (FP-5).
- Hedging after function words and _be_/_have_ (FN-1); persons as pronouns only (FN-3).
- Linkers always _Depends_; "It is ___ that" capped at _Likely fits_.
- Wrong-role matches that are already hedged (FP-4).
- A blanks-only query shows the introduction.
- The one-blank verb sentence fills the preposition slot (Phase 3 interaction).
- The ±4-word window; at most two gaps.

### False alarm / no action

- Memory/Postgres full-text fallback differences (a test artifact).
- The filtered pair query at 17 statements (filters' known extra read).
- "There is ___ a threat" (fixed in Step 4.4).
- The "Search as" chip row scrolling horizontally (intended).
- Ordinary search isolation: the pre-Step-4.1 engine (`1dbe724`) and today's engine give **identical** answers on 54 ordinary queries with the same content. The only difference with today's content is "amount of people", the intended F3 change.

## 17. Phase 4 closure recommendation

**Don't close Phase 4 yet.** Decide first between:

- **(a) Finish Phase 4 as approved.** Do UI-1 and R-3, then Steps 6–9, the sentence-level check, topic tagging and Wave 2, then the phase review.
- **(b) Re-scope Phase 4 to "Search depth: filters + context gaps".**
  - Do UI-1 and R-3 (the two small fixes).
  - Record an owner decision moving Steps 6–8, the sentence-level check and Wave 2 to a named later phase. Close Step 9 with "no demonstrated ordinary-search failures".
  - Run OPS-2, and open the phase PR to `main`.

**Recommendation: (b).** The context-gap slice is complete and reliable. Steps 6–8 are independent infrastructure and privacy work, and Wave 2 is a large editorial stream. Holding a working, audited search slice off `main` (and off production) for them adds risk, not quality. Either way, the two small fixes come first.

## 18. Recommended next direction

After the owner's choice:

1. the two small fixes;
2. then either the remaining Phase 4 steps, or the re-scope decision and the phase PR to `main`.

**Content is the main next lever:** most remaining context-gap limits (FN-2, FP-2, topics, functions) are content and content-model gaps, not engine gaps. Wave 2 and authored word roles would raise usefulness more than further engine heuristics. Phase 5 (Personal Learning) can start once Phase 4 is on `main`.
