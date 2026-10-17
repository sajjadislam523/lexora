# Lexora — Phase 4 (Search Depth): specification and readiness audit

Written: 17 October 2026 · Baseline: `main` at `026d9a5` (PR #15 merged) · Status: **approved by the owner on 17 October 2026** · Branch: `phase/4-search-depth`

This is the approved Phase 4 specification and the readiness audit it was based on. It is the reference for every Phase 4 step; [ROADMAP.md](../ROADMAP.md) carries the summary. Decisions are recorded in §17: those the owner approved, and those still proposed, which are confirmed at the step that needs them (nothing marked _proposed_ is decided). Approval covers the specification, not implementation in one go: each step is built, reviewed and merged on its own, in the order of §15, and the phase reaches `main` only through the owner's `owner-approved` checkpoint.

Sections 3–4 describe the code as it stood at `026d9a5`, before any Phase 4 work.

---

## 1. Sources read

CLAUDE.md, AGENTS.md, docs/ROADMAP.md, ARCHITECTURE.md, DESIGN.md, UX_PRINCIPLES.md, WORKFLOW.md, docs/audits/2026-10-09-post-phase-3-audit.md, content/README.md, all of `src/language/**`, `src/server/repositories/language`, `src/server/content/{build,import,validate}.ts`, `src/server/db/schema/*`, `drizzle/0000–0003`, all 40 item files and 8 intents (inventoried by script), `test/search-golden.yaml` + runner, `src/features/finder/*`, `src/app/(public)/explore`, `src/app/(app)/finder`, `sitemap.ts`, `robots.ts`, `proxy.ts`, `next.config.ts`, `src/server/auth/auth.ts` (rate limits), `src/lib/analytics-privacy.ts`, the `FilterChip` and context-tool components.

Baseline checks run during the audit: `pnpm content:check` ✓ (40 items, 42 senses, 8 intents, 1 source); in-memory golden suite + `src/language` unit tests ✓ (127 tests). PostgreSQL integration and e2e suites were not run (they need the local database).

Behaviour probes: ~25 queries run through `LanguageSearchService` over the in-memory repository built from `content/` (the same harness as the in-memory golden suite). The in-memory full-text fallback approximates PostgreSQL's; probe results on the fallback path must be re-checked against PostgreSQL before anything is changed because of them.

---

## 2. What Phase 4 is, verified against the repository

The six workstreams in the brief match ROADMAP.md → Phase 4, and the exclusions (AI, semantic search, AI explanations, Language Bank screen, practice, writing/speaking analysis) match "Explicitly deferred". Differences between the planning text and the code:

| #   | Planning text                                                                                    | Repository reality                                                                                                                                                                                             | Consequence                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | Function filter values include "comparison"                                                      | `DISCOURSE_FUNCTIONS` has 10 values: addition, cause, concession, contrast, emphasis, example, importance, increase, problem, result. No comparison, decrease, opinion                                         | Adding values is an enum migration + vocabulary change (content model step)                                       |
| 2   | "Search endpoint", "unmatched-query endpoint"                                                    | There is **no search API**. Search runs inside the Server Components of `/explore?q=` and `/finder?q=` (`loadFinderState` → `languageSearch.search`). The landing page and command palette only navigate there | Rate limiting must target page routes; unmatched recording happens server-side in the render, not via an endpoint |
| 3   | Roadmap exit criteria 7 and 9: "Repeated searches are cached", "cache invalidation after import" | Nothing measured yet; content is tiny (42 senses); search pages are dynamic per request                                                                                                                        | Replaced by a measured latency budget (§9), approved as D6                                                        |
| 4   | "Phase 3 focuses primarily on verb gaps"                                                         | Gap search supports **only** verb frames with an object slot that has fillers. 3 such frames exist (allocate, devote, invest). Only the first `___` is read                                                    | Every non-verb gap returns nothing today (§7)                                                                     |
| 5   | "Search as" chips                                                                                | They change the placeholder and the example searches only; they never filter                                                                                                                                   | Filters are genuinely new; must not be confused with the mode chips                                               |
| 6   | ARCHITECTURE.md                                                                                  | Header still says "Status: Phase 2"; §6 "draft, finalised in Phase 3"; §7 "Search strategy (Phase 4)" describes what Phase 3 built; stack table lists FTS/trigram as "Phase 4"                                 | Documentation debt — fix in Step 0                                                                                |
| 7   | Topic taxonomy "proposed"                                                                        | No topic field anywhere: not in YAML schema, Zod, DB, or UI. The 40 items are topic-neutral academic/functional language                                                                                       | Topics land as a new optional field; most existing senses stay untagged (§6)                                      |

Nothing else has drifted: the public/private boundary, sense-level saving, retire-not-delete, Preview isolation (decision #60) and the no-AI rule all hold.

---

## 3. The current search engine (Phase 3), precisely

### 3.1 Pipeline

`LanguageSearchService.search(input)` (`src/language/search/service.ts`):

1. **Normalise** (`normaliseQuery`): NFKC, lower case, straight apostrophes, keep letters/digits/`'`/`-`/`+`/`?`, every gap marker (`__+`, `…`, `...`) becomes the token `___`, collapse spaces, cut at 200 characters. Punctuation-only queries → `null`.
2. **Classify** (`classify.ts`): any `___` → `CONTEXT_GAP`. Otherwise an ordered list of 22 regex rules, first match wins: PREPOSITION (4), STRONGER (2), WEAKER (1), ALTERNATIVE (3), SYNONYM (4), COLLOCATION (3), LINKER (1), SENTENCE_PATTERN (2), PHRASE (1), CONTEXTUAL_EXPRESSION ("I want to …", "how do I …") last. No match → `LOOKUP`. Qualifier words become **modifiers** (writing, speaking, formal, academic, informal, natural); linker/phrase captures may name a **discourse function** via `FUNCTION_WORDS`.
3. **Resolve the term**: exact form (`item_forms.normalized`, includes inflections and spelling variants) → variant (with a note, US spellings never errors) → typo correction: trigram candidates (`%`, pg_trgm default threshold) from forms, collocations and pattern bases, then optimal-string-alignment distance ≤1 (4–7 chars) or ≤2 (8+); terms under 4 chars and stopwords never corrected; a tie returns "Did you mean A or B" instead of guessing.
4. **Retrieve by intent** (repository lookups, all published-only):
   - relation questions → senses of the item → `relations` of the asked types → one group per sense;
   - PREPOSITION → `preposition_patterns.base_normalized` = term, else patterns of the item's senses, else typo over bases; plus preposition mistakes;
   - COLLOCATION → collocations of the senses + `component_of` relations;
   - LINKER/PHRASE/SENTENCE_PATTERN/CONTEXTUAL_EXPRESSION → `listIntents()` (all intents loaded) → exact trigger, else best trigger by stemmed content-word coverage ≥ 0.6, else intent by function; LINKER also appends "Other linkers" with the function; no intent → senses with the function → else LOOKUP;
   - CONTEXT_GAP → `readGap` (first non-skip word after the gap = object, next preposition) → `listGapFrames()` (all frames loaded) → `frameFit`: object must equal a filler (stemmed); preposition must be one the frame accepts → fits / different_preposition / unlikely;
   - LOOKUP cascade: exact form → exact collocation phrase or pattern base → stored mistake (equal, or for multi-word queries _contained in_ the mistake text) → typo → longest known form inside the query (1–5-word n-grams) → full text (`plainto_tsquery('english')` over label, definition, best_when, avoid_when, skill_note and examples; top 10 by `ts_rank`), labelled `fallback` → `none`.
5. **Rank** (`rank.ts`): a fixed tuple — tier (1 exact term · 2 exact phrase · 3 intent/relation · 4 variant/typo · 5 collocation · 6 related/full text) → editorial relation weight (3–1) → modifier fit count → IELTS relevance (core > high > useful) → relation type priority → authored position → term A–Z. A skill modifier filters to that skill unless that empties the list. Dedup by key. Intent results keep authored order. Gap results: fits → different_preposition → unlikely, then **headword A–Z**.
6. **Shape**: interpretation summary, optional term resolution, groups (empty groups dropped), fit guide (from relation notes or intent fit notes), mistakes, gap reading, outcome `results | fallback | none`. Every result has a `reason` (asserted by the golden runner).

### 3.2 Storage, indexes and query cost

- Indexes (migration 0002): btree on every `normalized`/`base_normalized`/`wrong_normalized`; GIN trigram on forms, collocations, pattern bases, mistakes, intent triggers; GIN on `senses.search_vector`; `relations(from_sense_id, type)`; `senses(item_id, position)`; `examples(sense_id, position)`; `language_items(status)`.
- Per search: a LOOKUP miss walks up to ~8 sequential round trips (forms → collocations+patterns → mistakes → trigram candidates → forms again → n-gram forms → full text) and `getSenseSummaries` costs 4 more (senses + examples + collocations + patterns in parallel). Expression and gap queries load **all** intents / frames per request (3 parallel queries; tiny today).
- Data volume: 40 items, 42 senses, 103 examples, 39 collocations, 29 patterns, 54 mistakes, 32 authored relations, 8 intents. At 150 items roughly ×4. Every table stays far below the size where these indexes matter; the cost of a search is round trips and cold starts, not scans.

### 3.3 Caching, rate limiting, public vs signed-in

- **Caching:** none for search. `/explore` and `/finder` are dynamic per `?q=`. The landing page is static (hourly ISR); language pages are ISR hourly + on demand; the sitemap revalidates hourly.
- **Rate limiting:** only Better Auth's database-backed limits on `/api/auth/*` (sign-in 5/min, sign-up 3/min, email endpoints 3/min, reset 5/min, others 100/min). Search and the save endpoints are unlimited (open item 5 of the post-Phase-3 audit).
- **Public vs authenticated:** identical engine, identical results. `/explore` is public (noindex for `?q=` pages, canonical `/explore`); `/finder` is inside the app shell (proxy + `requireSession`). No personal signal touches ranking. Search text never reaches analytics (`sanitizeAnalyticsEvent` drops `q`). It does appear in Vercel's request logs because it is in the URL; that exposure exists today.

### 3.4 Golden suite

`test/search-golden.yaml`, 23 cases: the 12 agreed Phase 3 scenarios (+2 typo cases folded in), 2 owner scenarios, 7 pinned behaviours. Run twice: in memory (`pnpm test`, no DB) and against PostgreSQL (integration). Assertions: intent, outcome, `top`, `only`, `includes`, `excludes`, group labels, term resolution, mistakes, gap fits, guide presence, and "every result has a reason". Additionally every `EXAMPLE_SEARCHES` entry must return `results`.

### 3.5 Probe findings (defects and gaps found during this audit)

| Query                                                                               | Today                                                            | Why                                                                                                                                       |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `Cars are largely responsible ___ air pollution`                                    | none; summary "Verbs for the gap, checked against “air”"         | Preposition gap read as a verb gap; patterns exist (`responsible for`) but gap search never consults them                                 |
| `Many families depend ___ one income`                                               | none                                                             | Same; `depend on` exists                                                                                                                  |
| `Obesity is associated ___ heart disease`                                           | none                                                             | Same; `associated with` exists                                                                                                            |
| `There was a ___ increase in cycling` / `There has been a ___ rise in house prices` | none                                                             | Adjective gap; collocation `a significant increase` exists                                                                                |
| `Public transport plays a ___ role`                                                 | none                                                             | Adjective gap; `play a crucial role`, `play a significant role` exist                                                                     |
| `Teachers ___ a crucial role`                                                       | none; object read as "crucial"                                   | `crucial` not in the skip list; no frame for `play`, although the collocation item exists                                                 |
| `Governments should take ___ to reduce emissions`                                   | none                                                             | Noun gap; `take measures` exists                                                                                                          |
| `Schools could raise ___ of the dangers`                                            | none                                                             | Noun gap; `raise awareness` exists                                                                                                        |
| `___, it is often slow and crowded`                                                 | none; "checked against “it”"                                     | Linker slot not recognised; linker positions/punctuation exist                                                                            |
| `Governments should ___ more money ___ public transport`                            | allocate fits, invest fits                                       | Second gap ignored, so the preposition check silently disappears                                                                          |
| `a significant`                                                                     | "“a significant” is a common mistake — here is the correct form" | **False statement.** Multi-word queries match any mistake that _contains_ them; `a significant amount of people` contains `a significant` |
| `linkers`, `environment`, `climate change`, `describe a graph`                      | none / full-text fallback with loosely related items             | No browse, no topic concept; fallback quality (re-check on PostgreSQL)                                                                    |

The first nine rows are the strongest argument for Phase 4: the content needed to answer them is already authored. The engine just doesn't look in the right tables.

### 3.6 Current → desired

| Area                    | Current behaviour                                     | Phase 4 desired                                                                                                                                             | What must change                                                                        | Must remain unchanged                                                         |
| ----------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Normalisation           | NFKC, gap token, 200 chars                            | Same, plus recognising sentence-initial gap + comma                                                                                                         | Gap reader keeps punctuation context (comma/full stop next to the gap) before cleaning  | `normaliseQuery` output for every non-gap query (golden + importer share it)  |
| Classification          | 22 ordered rules; gap → CONTEXT_GAP                   | + TOPIC rule (exact topic names, "words for <topic>", "<topic> vocabulary"); gap sub-typing inside CONTEXT_GAP; long gapless sentences get a sentence check | New rules appended **after** all existing ones (topic) or inside gap handling only      | First-match result for all 23 golden queries and all example searches         |
| Term resolution / typos | Exact → variant → one clear typo                      | Unchanged                                                                                                                                                   | —                                                                                       | Thresholds, never-silent corrections, ambiguity behaviour                     |
| Relations / senses      | Sense-to-sense, grouped per sense                     | Unchanged; optionally filtered                                                                                                                              | Post-filter applies to groups                                                           | Group structure and order                                                     |
| Context gap             | Verb frames only, first gap only, object filler match | Preposition, adjective, noun, verb, linker gaps; up to two gaps; whole-sentence anchors; honest "can't read this gap"                                       | New gap reader + analysers; `GapFit` gains one value; response carries per-gap readings | Existing verb-frame verdicts (golden cases 11 and 17: invest/allocate/devote) |
| Ranking                 | Fixed tuple; gaps A–Z within verdict                  | Gap candidates ordered by evidence strength then IELTS relevance then A–Z; mistake containment requires word-boundary + minimum length                      | `rank.ts` gap ordering, `findMistakes` containment rule                                 | Tuple for every non-gap intent; all 23 golden cases                           |
| Filters                 | None (Search-as chips are cosmetic)                   | Kind, function, IELTS use (skill+task), topic; post-filter on search; browse without a query                                                                | Service API `search(query, filters)` + `browse(filters)`; URL parsing                   | Unfiltered responses byte-identical to today                                  |
| Unmatched               | Not recorded                                          | `none`/`fallback` outcomes counted, normalised, weekly buckets, 13-week retention                                                                           | New table + recorder behind `@/language` + report command                               | Public pages never read the session; nothing user-linked                      |
| Performance             | Uncached, ~5–12 round trips                           | Measured; budget enforced; cache only if budget missed                                                                                                      | Bench script                                                                            | Determinism; no stale results after import                                    |
| Rate limiting           | Auth endpoints only                                   | Edge rule on search page requests                                                                                                                           | Vercel Firewall rule (config)                                                           | Auth limits; no new DB writes per request for limiting                        |

---

## 4. Data model audit

| Concept              | Exists today | Where                                                                                                                                                                               |
| -------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LanguageItem         | ✅           | `language_items` (id, slug, kind, headword, status, provenance, release) + `item_forms`, `item_slug_history`                                                                        |
| Senses               | ✅           | `senses` (pos, definition, cefr, registers[], skills[], ielts_relevance, ielts_tasks[], strength, functions[], best_when, avoid_when, skill_note, standalone_reason, search_vector) |
| Relations            | ✅           | `relations` sense→sense, typed, weight 1–3, note, context_note, inverse rows written by importer                                                                                    |
| Examples             | ✅           | `examples` (highlights jsonb, skill, ielts_task, collocation/pattern link, source)                                                                                                  |
| Collocations         | ✅           | `collocations` (phrase, normalized, pattern, note, registers, skills, optional full item)                                                                                           |
| Preposition patterns | ✅           | `preposition_patterns` (base, preposition, pattern, complement, mistake link)                                                                                                       |
| Frames               | ✅           | `frames` (parts jsonb with head/slots/fillers/also, display, head_normalized)                                                                                                       |
| Mistakes             | ✅           | `mistakes` (wrong, right, type, explanation)                                                                                                                                        |
| Intents              | ✅           | `intents`, `intent_triggers`, `intent_entries`                                                                                                                                      |
| Linker details       | ✅           | `linker_details` (connects, positions[], punctuation)                                                                                                                               |
| IELTS task / skill   | ✅           | `senses.ielts_tasks[]`, `senses.skills[]` (sense-level)                                                                                                                             |
| Kind                 | ✅           | `language_items.kind` (item-level, 7 values)                                                                                                                                        |
| Topics               | ❌           | —                                                                                                                                                                                   |
| Search metadata      | Partial      | `search_vector` (FTS); `content_releases` (checksum, counts, git sha)                                                                                                               |
| Unmatched queries    | ❌           | —                                                                                                                                                                                   |

Classification per Phase 4 requirement:

| Requirement                              | Class                      | Notes                                                                                                  |
| ---------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------ |
| Filter by kind                           | **A**                      | Item-level enum                                                                                        |
| Filter by function                       | **A** (B for new values)   | Sense-level array. New values (comparison, decrease, opinion…) are an enum extension                   |
| Filter by IELTS task / skill             | **A**                      | Sense-level arrays                                                                                     |
| Filter by topic                          | **B**                      | New enum + `senses.topics topic[] not null default '{}'` + Zod field + importer mapping                |
| Facet counts                             | **A**                      | One grouped query over published senses                                                                |
| Preposition gaps                         | **A**                      | Patterns + forms (inflections) + mistakes already authored                                             |
| Adjective / noun / verb-collocation gaps | **A**                      | Collocations + collocation-item forms; quality depends on Wave 2 content                               |
| Linker gaps                              | **A**                      | `linker_details.positions` and `punctuation`                                                           |
| Multiple gaps                            | **A**                      | Engine only                                                                                            |
| Whole-sentence fit / sentence check      | **A**                      | Forms, patterns, mistakes; no new storage                                                              |
| Unmatched-query feedback                 | **C + D**                  | New table; first write path in the language engine (architecture decision on where the recorder lives) |
| Caching                                  | **D** (deferred)           | Only if the budget is missed                                                                           |
| Rate limiting                            | **D**                      | Vercel Firewall (configuration, no schema) vs app-level (would need storage)                           |
| Ranking changes                          | **A**                      | Code only                                                                                              |
| Wave 2 content                           | **A** (B if new functions) | YAML format unchanged except optional `topics`                                                         |

---

## 5. Browse and filter model

### 5.1 Dimensions and values

| Dimension | URL param  | Values                                                                                                                                                | Level | Matching                                                     |
| --------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------ |
| Kind      | `kind`     | `word`, `phrase`, `collocation`, `preposition-pattern`, `linker`, `sentence-pattern`, `functional-expression` (URL uses kebab-case; maps to the enum) | item  | `item.kind = v`                                              |
| Function  | `function` | the `DISCOURSE_FUNCTIONS` values (10 today; more if approved in Step 2)                                                                               | sense | `v = any(sense.functions)`                                   |
| IELTS use | `use`      | `writing`, `writing-1`, `writing-2`, `speaking`, `speaking-1`, `speaking-2`, `speaking-3`                                                             | sense | `writing`/`speaking` → `skills`; task values → `ielts_tasks` |
| Topic     | `topic`    | the approved topic list (§6)                                                                                                                          | sense | `v = any(sense.topics)`                                      |

Skill and task are **one control** ("IELTS use"). Two independent controls would allow contradictions (speaking + Writing Task 2 → always empty), and a learner thinks in one step: "Task 1" or "Speaking Part 3". Register is not a filter (it is already a search modifier, and Lexora shows it on every card).

### 5.2 Rules

- **One value per dimension; dimensions combine with AND.** At 40–150 items, multi-select within a dimension adds little and multiplies URL permutations. It can be added later without breaking URLs (`kind=linker,phrase`).
- Results are **senses** (as in search), so a two-meaning word appears only with the meaning that matches.
- **Filters never change ranking.** With a query, filters are a post-filter on the engine's response (groups, fit guide rows and mistakes trimmed to visible results; group order and in-group order untouched). The golden suite therefore stays valid by construction, and a property test asserts it: for every golden query, filtered results are an order-preserving subsequence of unfiltered results.
- Without a query and with ≥1 filter: **browse mode** — published senses matching the filters, ordered by IELTS relevance (core → high → useful), then headword A–Z, then sense position. Deterministic and explainable ("Core IELTS language first").
- Without a query and without filters: today's intro (unchanged).
- Context-gap responses: filters apply to candidates, but the "Doesn't fit" group is never filtered to look like "Fits" — verdicts are untouched.
- Facet counts: each option shows the number of senses it would return **given the other active filters** (with a query: within the query's results). Zero-count options stay listed, shown as "(0)" and disabled, so the set of options never jumps around.

### 5.3 URL representation and canonical form

- `/explore?q=…&kind=…&function=…&use=…&topic=…&page=…` and the same on `/finder`. All state lives in the URL, so back/forward, refresh and sharing work.
- Canonical form, enforced on the server: fixed parameter order (q, kind, function, use, topic, page); lower-case values; unknown parameters and invalid values dropped; `page=1` omitted; empty values dropped. A request whose URL isn't canonical is redirected (307) to its canonical form, so each state has one URL. Parsing and serialising live in one pure, client-safe module (`src/language/filters.ts`) shared by the server and the view.

### 5.4 Pagination

Browse lists use `page` with **30 rows per page** (compact rows, §13). Search results are not paginated (the engine returns small, ranked sets; at 150 items the largest result set is a function or linker query of ~25). Out-of-range pages redirect to the last page. Pagination is server-rendered links (Previous / "Page 2 of 4" / Next), not infinite scroll.

### 5.5 Indexing, canonical tags and sitemap — resolution of "browse URL params/indexing"

**Recommendation: filtered and paginated views are not indexed and are not in the sitemap. Language pages remain the only indexed unit. Indexable browse pages, if ever wanted, are separate, curated, path-based pages added as their own decision after Wave 2.**

| Option                                                                       | Consequence for Lexora                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Index every parameter combination                                            | 7 × 11 × 8 × 11 ≈ 6,800 combinations (× pages) over ≤150 items. Almost all are thin or near-duplicate lists, many empty. Wastes crawl budget, competes with the language pages, and risks being treated as low-quality |
| Index single-dimension param pages (`?kind=linker`)                          | Parameter URLs are weak landing pages, and ranking for "IELTS linkers" needs editorial text that a filter view doesn't have. At 40 items the lists are thin (3 functional expressions, 2 sentence patterns)            |
| **Noindex all filtered/paginated views; follow links** ✅                    | Crawlers still discover every language page through the rows. Nothing thin is indexed; nothing to maintain                                                                                                             |
| Curated path pages later (`/explore/linkers`, `/explore/topics/environment`) | Right shape for SEO: stable path, one canonical page per collection, written intro, in the sitemap. Worth it only when a collection has enough items (≈ ≥12) — after Wave 2                                            |

Tag details:

- Filtered or paginated `/explore` views: `robots: noindex, follow`, **self-referencing canonical** to the normalised URL (not `/explore`). Google documents `noindex` and a canonical pointing at a _different_ URL as contradictory signals. The existing `?q=` pages already combine `noindex` with canonical `/explore`, and they should switch to the same self-canonical pattern (a one-line change; proposed decision D13).
- `robots.txt` must **not** disallow these URLs: a disallowed URL can't be crawled, so its `noindex` is never seen, and it can still be indexed from links.
- Sitemap unchanged: `/`, `/explore`, language pages.
- `/finder` is private (already disallowed in robots, behind auth).

### 5.6 Empty states

| Situation                                            | Copy (draft)                                                                                   | Action                                           |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Filters leave nothing (browse)                       | "No language matches these filters yet." + which filters are active                            | "Clear filters" and "Remove ‹last filter›"       |
| Filters hide all results of a query that has results | "Your search found 6 results, but none match these filters."                                   | "Show all 6 results" (clears filters, keeps `q`) |
| Topic chosen, few results                            | Caption: "General language such as _however_ works for every topic and isn't tagged with one." | —                                                |
| No match (unchanged)                                 | Existing NoMatch state                                                                         | Existing examples                                |

### 5.7 Search ↔ browse interaction

One page, one URL model: a query narrows by meaning, and filters narrow by metadata. Typing a new query keeps active filters (they are visible and clearable), while clearing the query keeps filters and switches to browse. The "Search as" chips stay as they are (they help phrase a query); the filter row is labelled "Show only" so the two can't be confused. The TOPIC classifier rule turns "words about the environment" into the topic browse view with an "Understood as: language for the topic Environment" line, instead of the full-text fallback.

---

## 6. Topic taxonomy — resolution of "topics: multiple or single?"

### 6.1 Evidence from the 40 items

- Every published item is **topic-neutral** academic or functional language (significant, however, responsible for, play a crucial role). Tagging _however_ with a topic would be false.
- Topics appear in the **examples**: transport dominates (cycle lanes, public transport, congestion, car use in roughly a quarter of examples), then environment, education, technology/social media, health, housing/cities, work, economy/budgets, government policy. Many examples straddle two topics ("Public investment is crucial to reducing traffic congestion": government + transport).
- So topic value arrives with **Wave 2 topic vocabulary** (carbon emissions, remote working, tuition fees), and that vocabulary crosses topics just as the examples do.

### 6.2 Decision

**Multiple, optional, sense-level, capped at 3.**

- _Multiple_, because real topic language crosses topics (carbon emissions → environment + transport; screen time → technology + health). A single topic forces arbitrary choices and makes the filter miss correct items.
- _Optional_, because general academic language has no topic. Untagged means general-purpose, never "missing".
- _Sense-level_, because filters, results and saving are all sense-level (decision #46), and a word's topical sense may differ from its general one.
- _Cap 3_, because a sense tagged with everything carries no information.

### 6.3 Model

- Closed vocabulary `TOPICS` in `src/language/schema/vocabulary.ts`, shared with a Postgres enum `topic` — the same pattern as `DISCOURSE_FUNCTIONS`. Labels in a client-safe map.
- `senses.topics topic[] not null default '{}'`. No index needed at this size (a GIN index only past ~10k senses).
- A separate topics table is **not** needed now. If curated topic pages are approved later, a `content/topics.yaml` (label, description) can be added then without changing sense data.

Proposed first list (10, IELTS Academic's recurring themes, each with content already hinted at in examples):

| ID            | Label                 | Scope note for authors                                |
| ------------- | --------------------- | ----------------------------------------------------- |
| `education`   | Education             | schools, universities, learning                       |
| `environment` | Environment           | climate, pollution, energy, nature                    |
| `health`      | Health                | medicine, fitness, diet, wellbeing                    |
| `technology`  | Technology and media  | internet, social media, devices, science applications |
| `work`        | Work and careers      | jobs, employment, remote working                      |
| `economy`     | Economy and business  | money, trade, tourism as industry, consumption        |
| `government`  | Government and policy | laws, public spending, regulation                     |
| `cities`      | Cities and housing    | urbanisation, housing, rural vs urban                 |
| `transport`   | Transport             | travel, traffic, infrastructure                       |
| `society`     | Society and culture   | family, generations, crime, tradition, globalisation  |

### 6.4 Authoring, validation, import, display

```yaml
- key: emissions
  pos: noun_phrase
  topics: [environment, transport] # optional, 1–3, from the topic list; omit for general language
```

Validator: known values, unique, max 3; warn (not error) when a published `word`/`collocation` sense in a topical batch has no topic, so reviewers notice. Importer: maps to `senses.topics`; the checksum change triggers a normal re-import. Display: on the language page, one neutral `TagBadge` row per sense ("Environment · Transport"); in browse rows, no topic badge (the filter already says it). Topics are **editorial metadata** used by the filter and the TOPIC query rule. They are not a ranking signal.

Existing content: a small tagging PR in Step 2 is expected to tag only a handful of the 42 senses (for example `invest.money` → economy, `take-measures.act` → government). The rest stay general on purpose.

---

## 7. Richer context-gap analysis

Deterministic and structured throughout. No parser, tagger or model is involved: the engine aligns the learner's words against **authored structures** (patterns, collocations, frames, linker details) and reports which structure matched.

### 7.1 Gap reading (replaces `readGap`)

For each gap (max 2) the reader produces a window: up to 3 tokens left (`L1` nearest), up to 3 tokens right (`R1` nearest), plus position flags: `atStart` (sentence start or after `.`/`?`), `commaAfter`, `commaBefore`, `otherGapNear`. Punctuation next to the gap is captured **before** normalisation strips it. The skip list (determiners, quantifiers) is used only to find the right-hand noun anchor, as today.

### 7.2 Analysers (each pure, each returns typed candidates with evidence)

| Gap type                                     | Trigger signals                                                                                                                                                                                                       | Content used                                                                       | Candidate                                                                                                      | Fit verdict                                                                                                                                                                                                                                              |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preposition**                              | `L1` (or `L2 L1`) + some preposition `p` forms a known form or pattern base: test `"${L1} ${p}"` against `item_forms` (catches inflections: _depends on_) and `L1` against `preposition_patterns.base_normalized`     | patterns, forms, mistakes                                                          | the preposition, with the pattern                                                                              | `fits` when the complement agrees (R1 ends in _-ing_ → `ing`/`noun_or_ing` only; otherwise noun patterns); patterns of the same base with another complement shown as `different_preposition`. The base's known mistakes are listed ("responsible of" ✗) |
| **Adjective / noun / verb in a collocation** | The window aligns with a published collocation phrase or collocation-item form with **exactly one token in the gap** and ≥1 content anchor adjacent to the gap matching (inflection-tolerant via the existing `stem`) | `collocations.normalized`, forms of `collocation`/`phrase` items, owning sense POS | the token that lands in the gap (_significant_, _measures_, _play_)                                            | `fits` = all aligned tokens match an authored collocation. No "possible" guesses: related words (synonyms of the fill) appear in a separate "Related — check the meaning" group without a fit badge                                                      |
| **Verb (frame)**                             | Existing frame logic, now checking every anchor in the window rather than only the first noun                                                                                                                         | `frames`                                                                           | head verb + its preposition                                                                                    | existing `fits` / `different_preposition` / `unlikely`                                                                                                                                                                                                   |
| **Linker**                                   | `atStart` and `commaAfter`, or `commaBefore` mid-sentence                                                                                                                                                             | `linker_details`, functions                                                        | linkers grouped by function                                                                                    | `fits` when the position and punctuation agree; new verdict **`different_position`** when they don't (_whereas_ at sentence start). Lexora does not guess the relationship (contrast vs addition): it groups by function and says so                     |
| **Two gaps**                                 | Two `___`                                                                                                                                                                                                             | all of the above                                                                   | joint candidates first (one structure covering both gaps: `invest … in`, `allocate … to`), then per-gap groups | joint fit = both parts fit                                                                                                                                                                                                                               |

### 7.3 Whole-sentence fit

Two meanings. The sentence-level check is approved (D9); the exact scope of item 2 is proposed (D18):

1. **For gap queries:** a candidate is checked against every anchor it covers on both sides, not just the first noun after the gap. _Governments should ___ more money ___ public transport_ checks object and preposition together.
2. **For gapless sentences** (≥ 6 words, no classifier rule matched): a sentence check that reports what Lexora _recognises_. Known items used with their authored pattern get ✓; authored mistakes found inside the sentence (reverse containment: the mistake text inside the query) get ✗ with the correction. A pattern base followed by a preposition Lexora doesn't list is flagged as "not a pattern Lexora knows". It is shown as an addition above today's results (the contained-term behaviour is kept, so `depend on public transport` still leads to _depend on_). Copy says plainly: "This is not a grammar check."

### 7.4 Ordering and ambiguity

- Candidate order: evidence (structure covering both sides > one side > anchor-only) → verdict → IELTS relevance → authored position → A–Z. Today's A–Z-within-verdict becomes the last tie-break.
- When two gap types both have evidence (rare: _the results ___ the trend_), both groups are shown, labelled by type, with the stronger evidence first. Lexora never silently picks one.
- No structure detected: outcome `none` with an honest summary: "Lexora couldn't read this gap. Include the word before and after it, or try one of these." Recognised items elsewhere in the sentence are still offered (existing contained-term step). The misleading "Verbs for the gap, checked against “air”" summary disappears.

### 7.5 Worked examples (target behaviour, to become golden cases)

| Query                                                         | Read as                              | Results                                                                                                                                                |
| ------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cars are largely responsible ___ air pollution                | Preposition after _responsible_      | **for** (fits: _be responsible for + noun / -ing_); **to** (different complement: + person); mistake _responsible of_                                  |
| Many families depend ___ one income                           | Preposition after _depend_           | **on** (fits); mistake _depend of_                                                                                                                     |
| Young people are interested ___ following traditional careers | Preposition after _interested_, -ing | **in** (fits, + -ing)                                                                                                                                  |
| There was a ___ increase in cycling                           | Adjective before _increase_          | **significant** (fits: _a significant increase_); related group: considerable, substantial (no badge)                                                  |
| Public transport plays a ___ role in reducing congestion      | Adjective in _play a … role_         | **crucial** (_play a crucial role_), **significant** (_play a significant role_)                                                                       |
| Teachers ___ a crucial role                                   | Verb in _play a crucial role_        | **play** (fits)                                                                                                                                        |
| Governments should take ___ to reduce emissions               | Noun in _take measures_              | **measures** (fits)                                                                                                                                    |
| Schools could raise ___ of the dangers                        | Noun in _raise awareness_            | **awareness** (fits)                                                                                                                                   |
| ___, it is often slow and crowded                             | Linker at sentence start, comma      | grouped by function: _However_, _On the other hand_, _Nevertheless_ (contrast) · _Furthermore_, _Moreover_ (addition) … _whereas_ → different position |
| Governments should ___ more money ___ public transport        | Two gaps: verb + preposition         | joint: **invest … in**, **allocate … to**, **devote … to** (object fit checked)                                                                        |
| The government ___ funding to schools                         | Verb frame (unchanged)               | allocate fits; invest different preposition; devote unlikely                                                                                           |

### 7.6 UI

The context tool's fixed title "Which verb fits this sentence?" becomes engine-driven: "Which preposition fits after “responsible”?", "Which word fits this gap?". The interpretation line names the gap type. Two gaps render as one sentence with two slots and joint options. `FitBadge` gains **Different position** (warning tone, documented in DESIGN.md §9.6 before use). Nothing else visual changes.

### 7.7 Content model needs

None structural. Coverage needs (Wave 2): more verb frames with fillers (target ≥ 15), more noun-bearing collocations (verb + noun, adjective + noun; target ≥ 60 more), and noun items (0 today). The reviewer checklist gains one line: "Collocations a learner would gap are authored as collocations."

---

## 8. Unmatched-query feedback

Goal: learn which searches the content doesn't satisfy, **without** building a record of what any person searched.

| Question                   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What counts as unmatched   | Outcome `none` (incl. a gap Lexora couldn't read) and outcome `fallback` (full-text only), recorded separately. "Did you mean" is not unmatched. Filter-only empty states are not recorded                                                                                                                                                                                                                                                                              |
| What is stored             | `query` (normalised, ≤ 80 chars), `outcome` (`none`/`fallback`), `intent` (the classifier's reading), `week` (ISO week start date, UTC), `count`. Primary key (`week`, `query`, `outcome`)                                                                                                                                                                                                                                                                              |
| What is never stored       | IP or IP hash, user ID, session, cookie, user agent, referrer, surface (`/explore` vs `/finder` would reveal signed-in status), exact timestamp, filters, the raw query                                                                                                                                                                                                                                                                                                 |
| Not recorded at all        | Queries over 8 words or containing a gap (sentences are where personal text appears, and they say little about missing items); queries containing `@`, a URL, or 4+ consecutive digits; queries shorter than 2 letters                                                                                                                                                                                                                                                  |
| Normalisation              | `normaliseQuery`, then cut to 80 chars at a word boundary. No stemming (the report should show what people typed)                                                                                                                                                                                                                                                                                                                                                       |
| Aggregation and duplicates | `insert … on conflict (week, query, outcome) do update set count = count + 1`. A repeat in the same week only increments                                                                                                                                                                                                                                                                                                                                                |
| Retention                  | **13 weeks** (≈ 90 days). Older weeks are deleted                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Cleanup                    | Opportunistic: each recording first deletes weeks older than the cutoff (indexed, cheap). `pnpm search:report` and `pnpm search:prune` also prune. Proposed decision D14 covers whether a strict daily Vercel Cron is also wanted; without one, data older than 13 weeks can only outlive the cutoff while nobody searches and nobody runs the report                                                                                                                   |
| Abuse bound                | A hard cap of 5,000 distinct rows per week: past it, existing rows still increment and new ones are dropped. Plus the rate limit (§10)                                                                                                                                                                                                                                                                                                                                  |
| When it runs               | After the response (`after()` from `next/server`), never blocking or failing the search; errors logged as cause only. Must not fire on router prefetch (verified by test)                                                                                                                                                                                                                                                                                               |
| Where the code lives       | The recorder is a language-engine port (`SearchFeedback` interface in `src/language/search/`), implemented in `src/server/repositories/search-feedback.ts`, composed in `src/language/index.ts`. Public features keep importing only `@/language` (the lint boundary holds). **Proposed architecture decision D15:** the language engine gains its first write path, to a table that holds no user data                                                                 |
| Report                     | `pnpm search:report [--weeks 4] [--min 2] [--limit 50] [--outcome none                                                                                                                                                                                                                                                                                                                                                                                                  | fallback]`prints query, total count, weeks seen, outcome, intent, sorted by count. The default`--min 2`hides one-off queries (the ones most likely to be personal). Production use follows the same owner-only procedure as`content:import` |
| Disclosure                 | One sentence beside the coverage caption on Explore and the Finder: "Searches that find nothing are counted anonymously so we know what to add." (proposed, D16)                                                                                                                                                                                                                                                                                                        |
| Migration                  | One additive migration: `search_misses` table + index on `week`. No changes to existing tables                                                                                                                                                                                                                                                                                                                                                                          |
| Tests                      | Unit: eligibility rules (length, digits, `@`, URL, gap, word count), normalisation, 80-char cut. Integration (Postgres): upsert increments, separate outcomes, weekly bucketing, prune boundary at exactly 13 weeks, row cap, no column can hold an identifier (schema assertion). e2e: an unmatched search on a production build creates/increments exactly one row; a matched search creates none; prefetch creates none; `/finder` and `/explore` record identically |

Known exposure outside this design: Vercel request logs already contain `?q=` for their retention period. That is unchanged by Phase 4, and should be noted in the privacy text when a privacy page exists.

---

## 9. Performance and caching — resolution of "cache repeated searches"

**Recommendation: do not implement result caching now. Measure first; cache only if the measured budget is missed; and if needed, cache static datasets in process before caching results.**

Reasons:

1. Data is tiny (42 senses → ~170 at 150 items). Index work is negligible; the cost is round trips (5–12 per search) and serverless/Neon cold starts. A result cache doesn't help a cold start, and with a long tail of unique queries most requests would be cache misses.
2. Caching keyed by arbitrary query text gives anyone a way to fill the cache with junk.
3. Invalidation is awkward: `content:import` runs from a CLI against Neon, outside Next. `revalidateTag` would need a new authenticated revalidation endpoint or a deploy hook, which is new attack surface and a new secret for a speculative gain.
4. A stale cache would break the promise that a reviewed import is what learners see.

What to do instead (Step 8):

- `pnpm search:bench`: runs the golden queries plus ~150 representative queries against a database (local and the Preview Neon branch), reporting p50/p95 per intent and round-trip counts. No query text leaves the machine.
- **Budget:** p95 ≤ 150 ms server-side search time on Preview with a warm function and warm database; no query path above 12 round trips.
- If the budget is missed: first cut round trips (merge the LOOKUP cascade's early probes into one query; fold `getSenseSummaries`' four queries into two). Second, memoise the static datasets (intents, gap frames, collocation templates, linker details) in process, keyed by the latest `content_releases.id`, so invalidation is automatic after import (one cheap query per search instead of three to five). Result caching with `use cache` is a last resort and a separate owner decision.
- PostgreSQL indexing: nothing new needed for the current or Wave 2 volume. Filters on sense arrays run as sequential scans over a few hundred rows, which is faster than a GIN lookup at this size.

Vercel/serverless: in-process memoisation survives only as long as an instance (Fluid compute reuses instances, so hit rates are reasonable). That is acceptable precisely because it is keyed by release ID and costs one query to validate. ROADMAP.md exit criteria were rewritten accordingly in Step 0 (D6).

---

## 10. Search rate limiting

Facts: search is page rendering on `/explore?q=` and `/finder?q=` (no endpoint); the proxy deliberately never touches the database and doesn't run on `/explore`; Better Auth's limiter covers `/api/auth/*` only.

**Recommendation: a Vercel Firewall (WAF) rate-limit rule, configured in the project, not in code.**

- Scope: path `/explore` or `/finder` **and** query parameter `q` present (filters and browse without `q` are cheap and not limited initially).
- Limit: **120 requests per 60 s per IP**, fixed window, action rate-limit (429).
  - Generous because of shared addresses: a classroom behind one NAT, or mobile carrier NAT.
  - A human searching fast makes ~10 searches a minute.
  - 120/min still stops scripted scraping and junk-writing into the unmatched table at scale.
- Why: enforced at the edge before the function runs, so it saves compute and database load. It adds no new database writes, no IP storage in Lexora, no dependency and no code.
- Authenticated users: same rule (the edge can't validate sessions, and there's no reason to treat them differently at this level).
- Unmatched recording: no separate endpoint exists; it's protected by the same rule plus its row cap.
- Must verify before relying on it (Step 6): that the project's Vercel plan includes WAF rate-limit rules, and whether the rule applies to Preview deployments. **If the Firewall is not available, Step 6 stops and reports the constraint to the owner; no alternative is implemented automatically.** One possible alternative, for that discussion only: an in-page check in `loadFinderState` backed by a small counter table keyed by an HMAC of the IP with a daily rotating key (no raw IPs). It would need its own migration and a separate owner approval.
- Documentation: the rule is recorded in ARCHITECTURE.md §4.7 and the README production section, exported as JSON (`vercel firewall rules inspect --json`) into `docs/` so it is reviewable.
- Save endpoints (`/api/bank/saved*`) are authenticated and owner-scoped. A separate rule (e.g. 60/min per IP on `/api/bank/`) is cheap and closes audit open item 5. Proposed as optional (D12).

---

## 11. Ranking — resolution of "ranking tuning vs expanded golden suite"

**Recommendation: expand the golden suite first, add a ranking snapshot, then change ranking only to make a documented failing case pass. No "tuning" without a failing case.**

Problems Phase 4 should actually solve:

1. False mistake match: multi-word queries matching inside longer mistakes (`a significant`). Fix: containment counts only when the query is ≥ 3 words or covers ≥ 60% of the mistake's words, on word boundaries.
2. Gap ordering: A–Z within a verdict becomes arbitrary once there are 15+ frames. Fix: evidence → verdict → relevance → position → A–Z (§7.4).
3. Misreported gap summaries and wrong gap typing (fixed in §7, pinned by golden cases).
4. Full-text fallback noise (`climate change`). First confirm on PostgreSQL (the probe used the in-memory approximation). If confirmed, require that the fallback match the definition/best_when, or ≥2 examples, before showing a sense. TOPIC queries will also take many of these queries off the fallback path.

Signals to **add**: evidence strength for gap candidates; IELTS relevance as a gap tie-break. Nothing else.

Signals **not** to add: click or popularity data, unmatched-query counts, saved counts, personal history, learned weights, recency, embeddings. They are unexplainable, privacy-relevant, or AI. Phase 4 is AI-free, and every placement must stay explainable by its reason line.

Validation:

- **Golden suite 23 → ~70** before any behaviour change (Step 1):
  - +14 gap cases (§7.5, plus negative ones)
  - +8 filter/browse cases (including the subsequence property)
  - +5 topic-query cases
  - +8 false-positive guards (`a significant`, `significant amount`, stopword-only, 200-char input, numbers, mixed scripts)
  - +4 multi-gap and sentence-check cases
  - +~8 added by Wave 2 batches (each batch adds 2–3 cases for what it introduces)
  - Cases for not-yet-built behaviour are committed as `todo` and switched on by the step that builds it.
- **Ranking snapshot:** `test/search-snapshot.json`, the top 5 result terms + intent + outcome for ~150 representative queries. It is regenerated by a script, and **any diff must be explained in the PR description**. Golden cases assert what must be true; the snapshot makes every other movement visible.
- Regressions are detected by CI: golden (memory + Postgres), snapshot diff, the filter subsequence property, and the existing example-search check.
- Policy for content PRs: a Wave 2 batch may legitimately change `only:` expectations (a new _stronger_ relation for _important_). Such changes need a line in the PR explaining why the new result is right; the owner approves them with the content.

---

## 12. Wave 2 content

### 12.1 Where the current 40 are weak

| Dimension      | Coverage today                                                                                                     | Gap                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Part of speech | 0 nouns, 4 verbs, 12 verb phrases, 8 adjectives                                                                    | Noun gaps and topic vocabulary impossible                   |
| Functions      | concession 1, cause 2, increase 2; no decrease, comparison, opinion/stance, hedging, purpose, sequence, conclusion | Task 1 (trends, comparison) and Task 2 (stance) underserved |
| Tasks          | writing-2 38, speaking-3 22, writing-1 13, speaking-1 7, speaking-2 6                                              | Task 1 and Speaking Parts 1–2 thin                          |
| Register       | informal 1                                                                                                         | Natural speaking language thin                              |
| Gap structures | 3 verb frames, 39 collocations                                                                                     | §7 needs more of both                                       |
| Topics         | none (transport-heavy examples)                                                                                    | All 10 topics                                               |
| Kinds          | phrase 1, functional_expression 2, sentence_pattern 2                                                              | Browse by kind looks empty for three kinds                  |

### 12.2 Size and pace

~110 more items (to ~150) remains sensible, and is the minimum that makes browse, topics and gap analysis non-thin. But the exit criterion should be **coverage**, not a raw count (D5):

- every topic ≥ 8 senses; every function ≥ 5 senses; every IELTS task ≥ 20 senses; every kind ≥ 5 items
- ≥ 15 verb frames with fillers; ≥ 100 collocations in total; ≥ 15 noun or noun-phrase items
- total published items ≥ 140

**Batches of 20–25 items, one content PR each, 5 batches:**

1. Task 1 data language: trends, decrease, comparison, proportion
2. Task 2 argument: stance, concession, cause/result, hedging
3. Topic vocabulary A: environment, transport, cities
4. Topic vocabulary B: education, work, technology, health
5. Topic vocabulary C + speaking naturalness: society, government, economy; speaking-1/2 and informal register

Batches 1–2 depend on the new function values (Step 2).

### 12.3 Workflow

- Content PRs are separate from feature PRs, one batch each, cut from and merged into `phase/4-search-depth`, following Phase 3's content-PR convention (#9, #10). Feature PRs never contain content; content PRs never contain code.
- Each content PR: `pnpm content:check` green; golden + snapshot run, with diffs explained; 2–3 new golden cases for what the batch introduces; the reviewer checklist (content/README.md) plus the new topic and collocation lines; owner review and `reviewer`/`on` filled in before `status: published`.
- Production: content reaches production only when the phase merges to `main` and the owner runs `pnpm db:migrate` then `pnpm content:import` against Neon (existing procedure). The import's safety checks (no published ID disappears, retire-not-delete) are unchanged.

---

## 13. UI/UX

Principles: extend, don't redesign. One new control row, one new list mode, one new badge state, engine-driven copy. No new colours, no dashboards, no extra pill rows, no motion beyond existing tokens, nothing that looks like AI.

| Surface                     | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Explore / Finder header     | Unchanged hero field, Search-as chips and examples. Below them, a **"Show only"** row of four labelled **native selects** (Kind · Function · IELTS use · Topic), each defaulting to "Any", with counts in option text ("Linker (11)"). Pills are deliberately avoided: four dimensions × ~35 values as chips would be exactly the pill clutter the brief rules out, and `NativeSelect` already exists, is accessible, and gives mobile users the platform picker |
| Active filters              | A one-line caption under the row: "Showing linkers for contrast · Clear filters" (text link). No removable chips                                                                                                                                                                                                                                                                                                                                                 |
| Browse mode                 | A compact list of `LanguageRow`s (term in serif, category dot, one usage line, chevron) in one bordered card, max-w-reading, with a results header "12 linkers for contrast" and "Core IELTS language first" as the order note. No result cards here (cards stay for search, where reasons matter). Pagination links below                                                                                                                                       |
| Search results with filters | Unchanged cards and groups, trimmed. The results header adds "· filtered" and the clear action                                                                                                                                                                                                                                                                                                                                                                   |
| Context gap                 | Engine-driven title and interpretation; two-slot sentences; `FitBadge` "Different position"; a "Related — check the meaning" subgroup without badges                                                                                                                                                                                                                                                                                                             |
| Sentence check              | A quiet bordered panel above results: "What Lexora recognises in your sentence" with `MistakeRow`s and ✓ rows, and the line "This is not a grammar check"                                                                                                                                                                                                                                                                                                        |
| Topic                       | Language page: neutral `TagBadge`s per sense. Filter option labels. No topic colours                                                                                                                                                                                                                                                                                                                                                                             |
| Empty / no-match            | §5.6 copy, using the existing dashed EmptyState                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Unmatched disclosure        | One caption sentence next to the coverage caption                                                                                                                                                                                                                                                                                                                                                                                                                |

DESIGN.md additions before implementation: the filter row (§10.2), browse list mode, the `different_position` FitBadge state, and the sentence-check panel. `/design-system` gets the same.

---

## 14. Responsive behaviour and accessibility

### 14.1 Per breakpoint

| Width    | Filter row                                                                                                                                                                         | Browse list                                                                                                 | Context gap                                                         | Sentence check                                               |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------ |
| **390**  | Collapsed behind a full-width "Filters" disclosure button showing the active count ("Filters · 2"). Expands inline (not a sheet, no focus trap) to four full-width stacked selects | Full-width rows, usage line wraps to 2 lines max; pagination as two full-width buttons + "Page 2 of 4" text | Options single column (existing); two-slot sentence wraps naturally | Full width; rows stack                                       |
| **430**  | Same as 390                                                                                                                                                                        | Same                                                                                                        | Same                                                                | Same                                                         |
| **768**  | Always visible; 2 × 2 grid of selects (`sm`+); disclosure gone                                                                                                                     | Single column, max-w-reading                                                                                | Options 2 columns (existing `sm:grid-cols-2`)                       | Full width                                                   |
| **1024** | Explore: one row of 4 selects within max-w-3xl. Finder (sidebar ≈ 248px visible): content ≈ 712px, so still 2 × 2                                                                  | Same                                                                                                        | Same                                                                | Same                                                         |
| **1280** | One row of 4 (both surfaces)                                                                                                                                                       | Same; no side column in browse                                                                              | Same                                                                | Above the results grid; fit guide stays in its sticky column |
| **1440** | One row of 4                                                                                                                                                                       | Same                                                                                                        | Same                                                                | Same                                                         |

No horizontal page scroll at any width ≥ 320 (DESIGN §5.4). Touch targets ≥ 44px for the disclosure button and pagination on mobile; native selects use the platform height (`h-control` tokens).

### 14.2 Keyboard and focus

- **Order:** search field → Find → Search-as chips → example pills → (mobile: Filters button) → Kind → Function → IELTS use → Topic → Clear filters → results header → results → pagination.
- Changing a select applies immediately (results update in place; focus stays on the select; the live region announces "12 results: linkers for contrast"). This is a content update, not a change of context, so WCAG 3.2.2 is met. A visually hidden "Apply" submit keeps the form usable without JavaScript (`<form method="get">`).
- **Requirement:** `FinderView` is currently keyed by `query` and remounts on every navigation. Filter changes must **not** remount it (key on `q` only, and sync select values from props), or focus would be lost.
- Pagination: `<nav aria-label="Pagination">`; current page `aria-current="page"`; links named "Next page, page 3 of 4". After a page change, focus moves to the results heading (`tabIndex=-1`) so keyboard and screen-reader users start at the top of the new page.
- Disclosure: `aria-expanded`, `aria-controls`; Escape closes it and returns focus to the button.
- Context gap: the choice group is labelled by gap ("Choose a preposition for gap 1"). The new badge state has a visible label (colour never alone).

### 14.3 Screen-reader labelling

- Each select has a visible `<label>`. Option text includes counts. Disabled zero options read "Phrase (0), dimmed".
- The live region (existing pattern: mounted empty, then filled) announces filter outcomes and empty states.
- Browse rows are links named by term + usage line. Topic badges are prefixed "Topics:" (visually hidden).
- Sentence-check rows reuse `MistakeRow`'s "Instead of …, use …" announcement.

### 14.4 URL and state

All filter and page state is in the URL; back/forward restore exactly. Selects reflect the URL after navigation. Invalid params redirect to the canonical URL. `rememberSearch` ("Back to search") stores the full canonical URL including filters.

---

## 15. Implementation order

The proposed order is right in spirit, with three evidence-based changes:

1. **Regression protection moves first.** Every later step changes search behaviour, so the expanded golden suite and snapshot must exist before any of it.
2. **Rate limiting comes before unmatched recording.** Recording adds a public write path; it should only ship behind the limit.
3. **Function vocabulary is added in the same content-model step as topics.** Wave 2 batches 1–2 need it, and it keeps the enum migrations together.

| Step                                    | Objective                                                                                                                                         | Likely files / areas                                                                                                                                                                                                              | Schema                                                                                                 | Tests                                                                                                              | Acceptance                                                                                                  | Depends on                                | Rollback / safety                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **0** Spec + doc reconciliation         | Approved spec committed; stale docs fixed                                                                                                         | `docs/specs/` (this file), ROADMAP Phase 4 section and exit criteria, ARCHITECTURE stale Phase 2/3 wording, README status. DESIGN.md is untouched: its additions (§13) are written at the start of Step 4, before the UI is built | —                                                                                                      | Formatting check                                                                                                   | Docs merged into the phase branch; no code, schema or content change                                        | Owner approval                            | Docs only                                                                                                                   |
| **1** Regression baseline               | Golden 23 → ~60 (future behaviour as `todo`); ranking snapshot + generator; filter subsequence property harness; fix the false mistake match      | `test/search-golden.yaml`, `test/golden.ts`, `test/search-snapshot.*`, `scripts/`, `repositories/language` + memory repo (`findMistakes`)                                                                                         | —                                                                                                      | The suite itself; all 23 originals unchanged and green                                                             | 23 originals pass untouched; snapshot committed; `a significant` no longer claims a mistake                 | 0                                         | Test-only, plus a one-rule fix behind a golden case                                                                         |
| **2** Content model: topics + functions | `topics` field; new function values (proposed: comparison, decrease, opinion, hedging; final list owner-approved); tag existing senses where true | `schema/vocabulary.ts`, `schema/content.ts`, `content/validate.ts`, `content/build.ts`, `content/import.ts`, `db/schema/language.ts`, `drizzle/0004_*`, `content/README.md`, small content PR                                     | **B**: enum `topic`, `senses.topics topic[] default '{}'`, `ALTER TYPE discourse_function ADD VALUE …` | Validator (unknown/duplicate/>3), import round-trip, idempotent re-import, Postgres integration                    | `content:check` green; import writes topics; second import "nothing to import"; drift check green           | 1                                         | Additive migration (expand only). Enum values can't be dropped easily in Postgres, so add only approved values              |
| **3** Browse/filter engine              | `search(query, filters)` post-filter; `browse(filters, page)`; facet counts; canonical URL module; TOPIC classifier rule                          | `src/language/filters.ts` (client-safe), `search/service.ts`, `search/repository.ts`, `classify.ts`, `repositories/language`, memory repo                                                                                         | —                                                                                                      | Unit (parse/serialise/canonical), service (both repos), subsequence property, topic golden cases                   | Unfiltered responses identical to before (snapshot unchanged); filters correct on both repositories         | 2                                         | Pure addition; filters default to none                                                                                      |
| **4** Browse/filter UI                  | Filter row, browse list, pagination, empty states, metadata (noindex + self-canonical), redirect to canonical                                     | `features/finder/*`, `(public)/explore/page.tsx`, `(app)/finder/page.tsx`, `components/lexora/` (pagination if needed), DESIGN.md, `/design-system`                                                                               | —                                                                                                      | e2e: URLs, redirects, robots meta, canonical, sitemap unchanged, no-JS form; accessibility e2e (labels, landmarks) | Browser pass at all six widths; keyboard order; no remount on filter change                                 | 3                                         | UI-only; feature can be hidden by not rendering the row                                                                     |
| **5a** Gap depth I                      | Gap reader; preposition + collocation-template analysers; summaries; ordering                                                                     | `search/match.ts` (→ `search/gap/*`), `service.ts`, `types.ts`, `context-tool.tsx`, `fit-badge.tsx`                                                                                                                               | —                                                                                                      | §7.5 golden cases; unit tests per analyser with fixtures; existing gap cases unchanged                             | Golden cases 11 and 17 unchanged; new cases pass on memory + Postgres                                       | 1                                         | Analysers are additive; old verb path untouched                                                                             |
| **5b** Gap depth II                     | Linker gaps, two gaps, sentence check                                                                                                             | as 5a + `findings` UI                                                                                                                                                                                                             | —                                                                                                      | Golden + unit; snapshot diff explained                                                                             | As above; "not a grammar check" copy present                                                                | 5a                                        | Sentence check is additive above results                                                                                    |
| **6** Rate limiting                     | WAF rule on search pages (+ optional save-endpoint rule); documented and exported                                                                 | Vercel project config; `docs/`                                                                                                                                                                                                    | —                                                                                                      | Manual: burst test on Preview returns 429 at the limit; normal use unaffected                                      | Rule active on Production (and Preview if supported); docs updated                                          | Plan check                                | Disable the rule in one click; no code                                                                                      |
| **7** Unmatched-query feedback          | Recorder port + repository, `after()`, eligibility, cap, prune, report + prune scripts, disclosure copy                                           | `src/language/search/feedback.ts`, `src/language/index.ts`, `src/server/repositories/search-feedback.ts`, `db/schema/search.ts`, `drizzle/0005_*`, `scripts/`, `features/finder` (caption), `load-finder-state.ts`                | **C**: `search_misses`                                                                                 | §8 test list                                                                                                       | Only eligible misses recorded; no identifier column; prune at 13 weeks; report works locally and on Preview | 6                                         | Proposed kill switch (confirm at Step 7): env flag `SEARCH_FEEDBACK=off`; table can be truncated without affecting anything |
| **8** Performance                       | Bench script; budget check on Preview; round-trip reduction / in-process memo only if needed                                                      | `scripts/search-bench.mts`, `repositories/language`                                                                                                                                                                               | —                                                                                                      | Bench in CI (local DB) as a non-blocking report; snapshot unchanged                                                | p95 ≤ 150 ms warm on Preview, ≤ 12 round trips                                                              | 5b, 3                                     | Memo keyed by release ID; removable                                                                                         |
| **9** Ranking corrections               | Only failing documented cases: gap ordering refinements, fallback guard (if confirmed on PG)                                                      | `rank.ts`, `service.ts`, repository                                                                                                                                                                                               | —                                                                                                      | Golden ~70 + snapshot diff explained                                                                               | All golden green; every snapshot movement justified                                                         | 1–8                                       | Each fix is its own PR                                                                                                      |
| **W1–W5** Wave 2 content                | 5 batches (§12) in parallel from Step 2 onward                                                                                                    | `content/items`, `content/intents`, golden additions                                                                                                                                                                              | —                                                                                                      | `content:check`, golden + snapshot per PR                                                                          | Coverage targets met; owner-reviewed                                                                        | 2 (batches 1–2), 5a helps review gap fits | Content PRs only; retire-not-delete                                                                                         |
| **10** QA                               | Responsive (390–1440), keyboard, screen reader, reduced motion, full CI, Preview smoke                                                            | —                                                                                                                                                                                                                                 | —                                                                                                      | Full suite + e2e + browser pass                                                                                    | §16 criteria                                                                                                | all                                       | —                                                                                                                           |
| **11** Phase review                     | Phase report, PR `phase/4-search-depth` → `main`, then stop                                                                                       | `docs/`                                                                                                                                                                                                                           | —                                                                                                      | CI                                                                                                                 | Owner adds `owner-approved`                                                                                 | 10                                        | Never self-merged                                                                                                           |

Production order at release: `pnpm db:migrate` (0004, 0005: additive) → merge/deploy → `pnpm content:import` → WAF rule confirmed → smoke test. Every migration is expand-only, so the previous deployment keeps working during rollout.

---

## 16. Phase 4 exit criteria (measurable)

1. **Search correctness:** all original 23 golden cases pass unchanged on memory and PostgreSQL; the expanded suite (≥ 65 cases, no `todo` left) passes on both; every result has a reason.
2. **Regression protection:** ranking snapshot committed; every diff since Step 1 explained in a PR; filter subsequence property passes for every golden query.
3. **Browse/filter:** four dimensions work alone and combined, on `/explore` and `/finder`. Canonical URLs: non-canonical input redirects, back/forward restore state, refresh preserves it. Filtered/paginated pages are `noindex, follow` with self-canonicals; the sitemap lists only `/`, `/explore` and language pages.
4. **Context gaps:** each §7.5 example passes as a golden case. Non-verb gaps never produce a "Verbs for the gap" summary. An unreadable gap gives the honest message. Two gaps are supported; three or more gaps give the "fill the others in" message.
5. **Unmatched queries:** only eligible misses are stored; no identifier column exists (schema test); rows older than 13 weeks are pruned (integration test at the boundary); the report runs locally and against Preview; the disclosure line is present.
6. **Rate limiting:** a scripted burst of 130 requests in 60 s from one IP against Preview/Production receives 429 after 120; a normal manual session never does.
7. **Performance:** `search:bench` p95 ≤ 150 ms warm on Preview, no path above 12 round trips; no result cache unless the owner approved one.
8. **Content:** ≥ 140 published items, all owner-reviewed. Coverage targets from §12.2 met: every topic ≥ 8 senses, function ≥ 5, task ≥ 20, kind ≥ 5 items; ≥ 15 gap frames; ≥ 100 collocations.
9. **Responsive:** browser pass at 390, 430, 768, 1024, 1280, 1440 on Explore, Finder, browse, gap, sentence check and language pages: no horizontal scroll, controls reachable.
10. **Accessibility:** keyboard-only pass of every new flow; screen-reader announcements for filter changes, page changes and gap verdicts; visible focus everywhere; contrast AA for the new badge state; `prefers-reduced-motion` respected; accessibility e2e green.
11. **Preview isolation:** Phase 4 migrations and imports tested on the Preview branch first; Production has zero Preview users and saves after release (same checks as the PR #15 verification).
12. **Production safety:** migrations expand-only; import dry run on Preview; rollback notes in the phase report; nothing personal in any new table.
13. **Tests/build:** `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build` and `pnpm test:e2e` green in CI on the phase branch.
14. **Documentation:** ARCHITECTURE (header, structure, §6, §7 rewritten as built, decision log entries for filters, topics, gap analysis, unmatched queries, WAF, caching decision), DESIGN (filter row, browse list, FitBadge state, sentence check), content/README (topics, new functions, gap authoring guidance), ROADMAP (Phase 4 marked done, open decisions updated).

---

## 17. Decision register

Status as of 17 October 2026. **Approved** decisions were approved by the owner with this specification. **Proposed** decisions are not decided: each is confirmed by the owner at the step named, before that step is built.

| #   | Decision                     | Status                        | Approved / proposed position                                                                                                                                                                                                                             | Reason                                                                                           | Confirm at |
| --- | ---------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------- |
| D1  | Unmatched-query privacy      | **Approved**                  | Store only the cleaned query (≤ 80 characters), outcome, ISO week and count. Never IP, user, session, user agent or surface. Exclude long sentences, gaps, digit runs, `@` and URLs. 13-week retention. A report command; no admin UI                    | Useful for content planning without becoming tracking; weekly buckets make retention enforceable | —          |
| D2  | Browse URL params / indexing | **Approved**                  | Query parameters on `/explore` and `/finder` in one canonical order; non-canonical forms redirect. Filtered and paginated views are `noindex, follow` with a self-referencing canonical and stay out of the sitemap. Indexable topic/kind pages deferred | Avoids thousands of thin duplicate pages; language pages stay the indexed unit                   | —          |
| D3  | Filter model                 | **Approved**                  | Kind, function, IELTS use, topic; one value per dimension initially; AND across dimensions; with a query, filters restrict results without changing ranking; without a query, fixed ordering; controls are dropdowns                                     | Small, explainable, reversible; keeps golden expectations valid                                  | —          |
| D4  | Topics                       | **Approved**                  | 1–3 optional topics per meaning (sense); a closed initial list of 10 (§6.3)                                                                                                                                                                              | Topic language crosses topics; general language has none; filters and saves are sense-level      | —          |
| D5  | Wave 2 size and pace         | **Approved**                  | About 110 more items in five batches of roughly 20–25; coverage-based exit criterion; at least 140 published items; content separate from feature work                                                                                                   | Coverage is what makes browse, topics and gaps non-thin                                          | —          |
| D6  | Caching                      | **Approved**                  | Deferred. Measure first; target p95 ≤ 150 ms on warm Preview. Any cache needs a separate owner decision                                                                                                                                                  | No evidence of need; invalidation would add attack surface                                       | —          |
| D7  | Search rate limiting         | **Approved** (to be verified) | Verify Vercel Firewall availability first; target 120 requests/minute/IP on search page requests. If the Firewall is unavailable, stop and report; no alternative is built automatically                                                                 | Edge enforcement, no code, no IP storage                                                         | Step 6     |
| D8  | Ranking                      | **Approved**                  | Expand the golden suite (to ~65–70 cases) and add a ranking snapshot first; change ranking only to fix demonstrated failures; no popularity, click or personal signals                                                                                   | Correctness and explainability over cleverness                                                   | —          |
| D9  | Gap analysis                 | **Approved**                  | Preposition; collocation (adjective, noun, verb); verb frame; linker; at most two gaps; an honest fallback when a gap can't be read; a sentence-level check labelled as not a grammar check                                                              | Deterministic, uses authored data only                                                           | —          |
| D10 | Implementation order         | **Approved**                  | §15: Step 0 → 1 → 2 → 3 → 4 → 5a → 5b → 6 → 7 → 8 → 9 → 10 → 11; Wave 2 in parallel from Step 2                                                                                                                                                          | Regression protection before behaviour change; rate limit before a public write path             | —          |
| D11 | New discourse functions      | **Approved** (2026-10-17)     | Add comparison, decrease, opinion, hedging; all four chosen by the owner                                                                                                                                                                                 | Task 1 and Task 2 coverage; enum values are hard to remove                                       | Step 2     |
| D12 | Save-endpoint rate limit     | Proposed (optional)           | A Firewall rule on `/api/bank/`, 60/min/IP                                                                                                                                                                                                               | Closes post-Phase-3 audit item 5                                                                 | Step 6     |
| D13 | `?q=` page canonical         | Proposed                      | Switch today's `noindex` + canonical `/explore` to `noindex, follow` + self-canonical, matching D2                                                                                                                                                       | Removes contradictory signals                                                                    | Step 4     |
| D14 | Retention enforcement        | Proposed                      | Prune on write plus prune in the report and prune scripts; a strict daily cron only if wanted                                                                                                                                                            | Avoids a new secret and route unless required                                                    | Step 7     |
| D15 | Recorder location            | Proposed                      | Port in `src/language`, implementation in `src/server/repositories`, composed in `src/language/index.ts`: the language engine's first write path, to a table without user data                                                                           | Keeps the public-boundary lint rule intact                                                       | Step 7     |
| D16 | Disclosure copy              | Proposed                      | One caption sentence on Explore and the Finder                                                                                                                                                                                                           | Honesty about recording                                                                          | Step 7     |
| D17 | Unmatched-recording details  | Proposed                      | 5,000 new rows per week cap; report hides counts below 2 by default; `SEARCH_FEEDBACK` kill switch                                                                                                                                                       | Abuse bound and privacy margin                                                                   | Step 7     |
| D18 | Gapless sentence-check scope | Proposed                      | §7.3 item 2 (≥ 6 words, recognised items and authored mistakes only)                                                                                                                                                                                     | Defines the approved sentence-level check precisely                                              | Step 5b    |
| D19 | TOPIC query rule (§5.7)      | Deferred (2026-10-17)         | Not in Step 3: "words about the environment" keeps today's reading until the owner decides                                                                                                                                                               | It would change the pinned golden case `environment`                                             | Later      |

---

## 18. Risks and deferred decisions

| Risk                                                            | Mitigation                                                                                     |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Wave 2 content changes golden `only:` expectations              | Policy in §11: explained, owner-approved expectation changes inside content PRs                |
| Collocation-template matching over-matches as content grows     | Require exactly one gap token and ≥ 1 adjacent content anchor; golden negative cases; snapshot |
| Unmatched table filled with junk                                | WAF limit, weekly row cap, eligibility rules                                                   |
| Personal text in recorded queries                               | Sentences/gaps/digits/`@`/URLs excluded; 80-char cut; report threshold; 13 weeks               |
| Enum values can't be removed easily                             | Add only approved values; topics and functions reviewed in Step 2                              |
| WAF unavailable on the current plan                             | Verified first in Step 6; documented fallback needs separate approval                          |
| Prefetch double-counting misses                                 | e2e test; record only on the actual render                                                     |
| Filter row clutter on mobile                                    | Disclosure below `sm`; native pickers                                                          |
| Wave 2 effort dominates the phase                               | Batches run in parallel from Step 2; features don't block on content                           |
| Probe findings on fallback quality came from the in-memory repo | Re-check on PostgreSQL before acting (Step 9)                                                  |

Deferred (not in Phase 4): result caching (unless the budget fails), curated indexable browse pages, multi-select filters, register filter, topic landing pages, strict retention cron, privacy page, custom domain/EMAIL_FROM (separate track), anything AI.
