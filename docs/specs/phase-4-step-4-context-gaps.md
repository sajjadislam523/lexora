# Phase 4 · Step 4 — Context-gap intelligence: audit and specification

Written: 17 October 2026 · Baseline: `phase/4-search-depth` at `967aa61` (Steps 0–3 merged) · Status: **proposal, awaiting owner approval** · Parent: [phase-4-search-depth.md](phase-4-search-depth.md) §7

Step 4.0 is this document only. Nothing in the engine, schema, content, UI or tests changed while writing it.

**Numbering.** The parent specification's §15 calls this work Steps 5a and 5b; its Step 4 (the filter UI) shipped as Step 3b. This document follows the owner's current numbering: **Step 4 = context gaps**, implemented as Steps 4.1 onward (§22). Its decisions are numbered **CG-D1 … CG-D18** so they don't collide with the parent register's D1–D19. Where it refines the parent's §7, this document is the more detailed reference; anything not restated here stands as approved there (D9: preposition, collocation, verb-frame and linker gaps, at most two gaps, an honest fallback, a sentence-level check labelled as not a grammar check).

---

## 1. Executive summary

Lexora already has one kind of context gap: a **verb frame** (`invest money in`), with three frames in the content. Every other gap type the product wants is missing, even though much of the content to answer it exists: 29 preposition patterns, 39 collocations, 11 linkers with structured positions.

Step 4 adds a deterministic **gap reader** and four **analysers**: preposition, collocation, verb frame, linker. Each analyser aligns the learner's words around a blank with an authored structure, and reports a candidate only when that structure is authored. There is no parser, no part-of-speech tagger, no model and no AI.

Three findings shape the design:

1. **The honest fallback is broken today.** Any `...` or `…` makes a query a gap query with no way back. "however..." and "There is growing concern about ..." (an item's own display text) return nothing. The fix: an ellipsis counts as a gap only between words. A query with no readable gap is answered by ordinary search.
2. **The data can't tell collocation subtypes apart.** Collocation tokens carry no part of speech, and there are no noun + verb collocations at all. So one structure-agnostic collocation analyser is designed. "Adjective/noun/verb gap" labels are not claimed.
3. **Verb frames are thin.** There are 3 frames, all `verb + object + preposition`; no frame with `-ing`, `that`-clause or person slots; and no infinitive slot type. "___ someone to do something" isn't representable yet. That's a small content-model extension (no migration), decided separately (OQ4).

Protected behaviour: ordinary search, the 71 golden cases and the ranking snapshot stay byte-for-byte unchanged. The six protected gap cases keep their verdicts and order. An analysis of the snapshot shows the proposed ordering changes none of them (§9).

## 2. Current architecture audit

### 2.1 Pipeline today

| Stage          | Where                                                                                   | What happens                                                                                                                                           |
| -------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Normalise      | `src/language/normalise.ts` `normaliseQuery`                                            | NFKC, lower case, straight quotes; every `__+`, `…`, `...` → the token `___`; punctuation removed (commas included); ≤ 200 characters                  |
| Classify       | `src/language/search/classify.ts` `classify`                                            | **Any `___` token → `CONTEXT_GAP`**, before every other rule; else 22 ordered rules; else `LOOKUP`                                                     |
| Retrieve (gap) | `service.ts` `gapSearch` → `match.ts` `readGap`, `frameFit`; repository `listGapFrames` | First gap only. Object = first non-skip word after it; preposition = next preposition. All frames loaded and checked: filler match → preposition match |
| Rank (gap)     | `gapSearch`                                                                             | Verdict (`fits` → `different_preposition` → `unlikely`), then headword A–Z                                                                             |
| Group / reason | `gapSearch`, `gapReason`                                                                | "Fits this sentence" / "Doesn't fit this sentence" (only when something fits); reason per verdict; guide "Why each verb does or doesn't fit"           |
| Response       | `types.ts` `SearchResponse`                                                             | `interpretation.intent = CONTEXT_GAP`, `gap: { object?, preposition? }`, results with `fit` and `fill: { word, preposition? }`, key `${senseId}:gap`   |
| Filters        | `service.ts` `restrict` (Step 3a)                                                       | Server-side, after the answer: results whose sense matches; reading, groups, order and verdicts unchanged                                              |
| UI             | `src/features/finder/context-tool.tsx`                                                  | "Which verb fits this sentence?" — fixed copy; fills gap 1 with the word and the preposition after the object                                          |

**Where Step 4 fits.** Behind the same `CONTEXT_GAP` classification, inside `gapSearch`: classification stays a one-line structural rule (a blank is present), and everything new happens in the gap module, which either produces a gap answer or hands the query back to ordinary search (§11). No other classifier rule changes.

### 2.2 Contracts Step 4 must not break

- **Ordinary search**: every non-gap query's response, incl. the 65 non-gap golden cases and their snapshot blocks.
- **The six protected gap cases** (golden + snapshot): `Governments should ____ more money into public transportation`, `… ___ more money to public transport`, `We need to ___ more resources to healthcare`, `Companies ___ billions into research`, `The city should ___ more funds in cycle lanes`, and `Governments should ___ to public transport` (intent `CONTEXT_GAP`, outcome `none`). Their verdicts, order, keys (`${senseId}:gap`), group labels and guide must stay identical.
- **Pinned wording**: "Verbs for the gap, checked against “money” and “into”" (two e2e tests). Verb-frame summaries keep today's wording.
- **Normalisation**: `normaliseQuery` and its tests unchanged (mid-sentence `…`/`...` stay gap tokens; tests pin `"should … more" → "should ___ more"`).
- **Filters**: never change the reading (Step 3a); `filters: { before, after }` semantics.
- **Determinism**: same input → same response; no time, randomness or database row order in results.
- **URL contract**: `q, kind, function, use, topic, page`; D13 deferred.

## 3. Data capability matrix

Counted from `content/` at `967aa61` (40 items, 42 senses).

| What a gap needs                                        | What exists                                                                                                                                                                                                           | Status                                                                                                 |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Preposition after a word                                | 29 `preposition_patterns`: `base`, `preposition`, `complement` (noun 14, noun_or_ing 12, person 2, clause 1), display, linked mistake (18). Inflections of pattern items in `item_forms` (_depends on_, _focused on_) | **Supported**                                                                                          |
| Adjective + noun                                        | 20 collocations owned by adjective senses (_a significant increase_, _a substantial proportion_, _a fundamental change_) — structure implied by the owner's part of speech only                                       | **Partially**: the template works; the subtype isn't recorded per token                                |
| Verb + noun                                             | Verb-phrase collocation items and their collocations: _take measures_, _take steps_, _pose a threat_, _pose a risk_, _raise awareness_, _play a crucial/key/vital/major role_                                         | **Partially**: same template, no per-token roles                                                       |
| Noun + verb                                             | None (_rise sharply_ is verb + adverb)                                                                                                                                                                                | **Not in content**; template-ready once authored                                                       |
| Verb frame `verb + object + preposition`                | 3 frames (allocate, devote, invest) with object fillers                                                                                                                                                               | **Supported** (Phase 3)                                                                                |
| Verb frame `verb + -ing` / `+ that-clause` / `+ person` | Slot types `ing`, `clause`, `person` exist in the vocabulary; **no verb frame uses them** (2 sentence-pattern frames use `clause`/`noun`)                                                                             | **Representable, no content**                                                                          |
| Verb frame `verb + someone + to-infinitive`             | No `infinitive` slot type                                                                                                                                                                                             | **Requires a content-model extension** (vocabulary + Zod only: frames are `jsonb`, no migration) — OQ4 |
| Linker position                                         | `linker_details`: `positions` (start/middle/end), `connects` (sentences/clauses/both) for 11 linkers                                                                                                                  | **Supported**                                                                                          |
| Linker punctuation                                      | `punctuation` is free text ("A comma after it at the start…")                                                                                                                                                         | **Not machine-checkable**; use the learner's comma only as position evidence                           |
| Linker function                                         | contrast 5, addition 5, result 1, example 1, concession 1 (via `functions`); comparison, cause, decrease, opinion, hedging: 0                                                                                         | **Partially**: most functions have no linker                                                           |
| Examples as evidence                                    | 103 examples; 61 linked to a collocation or pattern; highlight spans                                                                                                                                                  | **Supported** for "example of this pattern"                                                            |
| Mistakes                                                | 54 typed mistakes, 18 linked from patterns                                                                                                                                                                            | **Supported** (shown with preposition candidates)                                                      |
| Register, skill, task, topic                            | Per sense                                                                                                                                                                                                             | Usable as **filters**, not as fit evidence (§8)                                                        |

## 4. Gap-type definitions

Terms: a **blank** is a run of 2+ underscores, or `…`/`...` with a word on each side (CG-D5). **L1, L2** are the words before the blank (nearest first), **R1, R2** after it, read from the raw query so punctuation next to the blank is known. A **content anchor** is a word that isn't a determiner or a stopword (`a`, `the`, `more`, … — the existing skip list).

| Type                | Required evidence                                                                                                                                                                                                                      | Sufficient                                                                          | Insufficient →                                                                           | Refuse when                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------ |
| **Preposition gap** | `L1` (or `L2 L1`) plus some preposition `p` equals a pattern's `base` + `p`, or an item form `"<L1> <p>"` (inflections)                                                                                                                | One or more patterns of that base                                                   | `L1` isn't a pattern base or form → next analyser                                        | `L1` is missing (blank at the start)       |
| **Collocation gap** | An authored collocation phrase, or a collocation item's form, aligns with the window with **exactly one token in the blank** and **≥ 1 content anchor adjacent to the blank** matching (stemmed), with every other aligned token equal | The aligned collocation is authored                                                 | Only determiners/stopwords align (_a ___ the_)                                           | More than one blank inside the same phrase |
| **Verb-frame gap**  | Today's rule: `R`-side object equals a frame filler (stemmed); then the accepted preposition                                                                                                                                           | A frame's filler matches                                                            | No filler matches → only "Doesn't fit" rows when something else fits (today's behaviour) | —                                          |
| **Linker gap**      | Blank at the start of a sentence (start of the query, or after `.`/`?`/`!`) **followed by a comma**; or a blank after a comma and before a clause (`, ___ I`)                                                                          | Linker senses whose `positions` include the position and whose `connects` allows it | Blank at the start with no comma, or mid-clause without commas                           | —                                          |
| **Two gaps**        | Exactly two blanks **and** one authored structure covers both (a frame's head + its preposition; a pattern whose base contains gap 1's collocation + preposition at gap 2) — or each blank independently has evidence                  | §12                                                                                 | —                                                                                        | Three or more blanks                       |
| **Unknown**         | A blank, but no analyser has evidence                                                                                                                                                                                                  | —                                                                                   | —                                                                                        | → §11 fallback                             |

The three collocation subtypes the brief names are **not** distinguished: the data doesn't record which token of a collocation is the adjective, noun or verb (§3). The response says "a word in _a significant increase_", never "an adjective gap". Recording token roles is deferred (OQ5).

## 5. Proposed architecture

```text
service.search(q, filters)
  └─ answer(q)
       ├─ classify(normalised) ── CONTEXT_GAP? (unchanged rule: a ___ token)
       └─ gapSearch(base)
            ├─ readGaps(rawQuery, normalised)       → GapReading | NoGap         (gap/reader.ts)
            ├─ NoGap → this.answerWithoutBlanks()    → ordinary pipeline          (§11)
            ├─ analysers, in fixed order:            (gap/analysers/*.ts, pure)
            │    verbFrame (Phase 3, unchanged) → preposition → collocation → linker
            ├─ joint two-gap structures              (gap/joint.ts)
            └─ shape: groups per gap type, verdicts, reasons, guide
  └─ restrict(response, filters)                     (Step 3a, unchanged)
```

- **CG-D1:** gap code lives in a new `src/language/search/gap/` module (reader, analysers, joint, types). `match.ts` keeps `readGap`/`frameFit`/`toGapFrame` (the verb-frame analyser wraps them unchanged).
- **CG-D2:** a separate structure, `GapReading`, produced inside `gapSearch`. There is no query AST in Lexora (classification is a flat `Classification`), and adding gap detail to `Classification` would touch every intent. The classifier's one structural rule stays as it is.
- **Precedence (protects the six cases):** the verb-frame analyser runs first. If it returns any `fits` or `different_preposition` result, its answer is final and identical to today's. Other analysers run only when no frame fits. All six protected queries have frame evidence or the empty-object prompt, and are therefore unchanged by construction. Tests prove this (§17).

## 6. Internal representation

```ts
/** What the reader saw around each blank (max 2), from the raw query. */
type GapReading = {
  gaps: GapSlot[]; // 1 or 2
};
type GapSlot = {
  index: 0 | 1;
  before: string[]; // up to 3 normalised words, nearest first
  after: string[]; // up to 3 normalised words
  atSentenceStart: boolean;
  commaBefore: boolean;
  commaAfter: boolean;
};

/** A candidate an analyser proposes, with the authored structure that is its evidence. */
type GapCandidate = {
  senseId: string;
  type: "verb_frame" | "preposition" | "collocation" | "linker";
  gaps: (0 | 1)[]; // which blanks it fills
  fills: string[]; // the words for those blanks, in order
  evidence: { id: string; display: string }; // frame / pattern / collocation / linker id, authored
  verdict: GapVerdict; // §8
  reason: string;
};
```

`GapReading` and `GapCandidate` are internal. The response gains only what the UI needs (§14).

## 7. Candidate retrieval

| Gap type         | Repository read (indexed, published only)                                                                                                                                                                      | Matching (pure)                                                                                                                                                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verb frame       | `listGapFrames()` (today)                                                                                                                                                                                      | `frameFit` (today)                                                                                                                                                                                                                      |
| Preposition      | `findFormsIn(["<L1> <p>" for p in PREPOSITIONS] + ["<L2> <L1> <p>"…])` and `findPatternsByBase(L1 / "L2 L1")` — existing methods, btree on `normalized` / `base_normalized`; `mistakesOf` the candidate senses | Complement check: `R1` ends in _-ing_ → `ing`/`noun_or_ing` fit, `noun`-only don't; `R1` a person pronoun → `person` fits; other `person`/`clause` complements → `depends` (§8); a fill that recreates an authored mistake → `unlikely` |
| Collocation      | One new read: all published collocation phrases + collocation-item forms (`normalized`, sense, item) — 39 + forms today, a few hundred after Wave 2                                                            | Window alignment with one token in the blank (CG-D5); stemming only via the existing `stem`                                                                                                                                             |
| Linker           | One new read: linker senses with `positions`, `connects`, `functions` (11 today)                                                                                                                               | Position/connects check; grouped by function                                                                                                                                                                                            |
| Joint (two gaps) | No extra read                                                                                                                                                                                                  | Frame: gap 1 = head, gap 2 = its preposition. Pattern: gap 1 in a collocation, gap 2 = a pattern preposition of that collocation's base                                                                                                 |

**CG-D7:** retrieval reuses the existing repository and two small new reads (collocation templates, linker details), both "load published rows of one table". Matching is in memory over at most a few hundred rows. No embeddings, LLMs or full-text search for gap candidates.

**As built in Step 4.2** (`src/language/search/gap/candidates.ts`; the owner's Step 4.2 scope: candidates for prepositions, collocations and linkers together, **no verdicts** — those move to Step 4.3, which also takes the plan's former 4.2–4.4 verdict work):

- **Where it runs:** `gapAnswer` wraps the unchanged Phase 3 `gapSearch`. When a verb frame fits the first blank, that answer stands as it is and no candidate read runs; other blanks are matched on their own. When nothing matches, the existing answer (or its prompt) is returned.
- **Reads** (three, in parallel, published rows only): `findGapPatterns(bases, forms)` (patterns by base, and patterns of items with an inflected form such as "depends on", with the form that matched), `findCollocationTemplates(words)` (collocations and collocation/phrase item forms containing a content word next to a blank, or its stem as a prefix; the exact alignment happens in the engine), `listLinkers()`. Then one summaries read and, when patterns link mistakes, one mistakes read.
- **Prepositions:** a pattern counts only when its authored pattern text puts the preposition directly after the base (`be responsible for + noun`), not after an object (`allocate + noun + to`).
- **Collocations:** exactly one collocation word in the blank, never a stopword; every other word matches (an inflection counts); a content word next to the blank. A collocation authored as a full item's form ("play a crucial role" under _crucial_) is answered by that item, as on result cards.
- **Windows** stop at punctuation next to the blank, so nothing is read across a comma or a sentence break; the punctuation is the linker evidence (start + comma; between commas; after a comma).
- **Order** (no scores): linkers by their first discourse function in vocabulary order; then the structure covering more of the learner's words; IELTS relevance; headword by code point; evidence id. At most 20 candidates per blank and type.
- **Response:** groups per blank and type ("Prepositions after “responsible”", "Collocations with these words", "Linkers that start a sentence"; "Gap 1 · …" with two blanks); each candidate has `fill.word`, `gapMatch: { gap, type, evidence }` (the authored id) and a reason naming its structure; mistakes linked from matched patterns appear in `mistakes`. `gaps[].type` is the first kind that answered the blank. Verb-frame results are unchanged (no `gapMatch`). An ellipsis blank now counts when any analyser answers it.

## 8. Context fit

What "fits" can honestly mean with today's data:

| Dimension                                 | Supported?                                                                                                                                            | Used how                                                                                                                                                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structural fit (pattern, frame, position) | **Yes**                                                                                                                                               | The only basis of a verdict                                                                                                                                                                                       |
| Lexical / collocational fit               | **Yes, for authored collocations and frame fillers**                                                                                                  | Verdict evidence                                                                                                                                                                                                  |
| Complement fit (-ing vs noun)             | **Partly**: -ing is visible; a person is visible only as a closed-class pronoun (_me, you, him, her, us, them, someone, people_); other nouns are not | `depends` when uncheckable                                                                                                                                                                                        |
| Authored mistakes (negative evidence)     | **Yes**: 54 typed mistakes                                                                                                                            | A candidate whose fill recreates an authored mistake in this window (`showsMistake` on the filled-in words) is `unlikely`, with the mistake's explanation as its reason: _My family is very important **for** me_ |
| Register fit                              | Data exists, but the sentence's register is unknown                                                                                                   | Not a fit signal; shown as tags, filterable                                                                                                                                                                       |
| IELTS-use fit                             | Data exists, but the task is unknown                                                                                                                  | Not a fit signal; a filter                                                                                                                                                                                        |
| Topic / function                          | Topics: none in content; functions: known per sense                                                                                                   | Linker groups by function; never a fit signal                                                                                                                                                                     |
| Example evidence                          | Examples linked to a collocation/pattern                                                                                                              | The example shown with the candidate ("Why this fits"), not a score                                                                                                                                               |

**CG-D8 verdicts** (the existing `GapFit`, plus two):

| Verdict                 | Means                                                                        | Today                  |
| ----------------------- | ---------------------------------------------------------------------------- | ---------------------- |
| `fits`                  | Every part Lexora can check agrees with an authored structure                | ✓                      |
| `different_preposition` | The structure fits, but takes another preposition than the learner's         | ✓                      |
| `depends`               | The structure fits; what follows can't be checked (`+ person`, `+ clause`)   | new — OQ1              |
| `different_position`    | A linker that doesn't go in this position                                    | new (parent spec §7.2) |
| `unlikely`              | The authored structure contradicts the context (filler or position mismatch) | ✓                      |

There are no numeric scores and no confidence percentages. The UI shows the verdict as a `FitBadge` and the reason in words. The context tool's heading says "Which word fits this gap?", and every gap result is introduced as language that fits **this sentence's pattern**, never as "correct English". Copy rules are in §14.

**As built in Step 4.3** (`src/language/search/gap/verdicts.ts`). **Amendment of CG-D8 (owner, Step 4.3 instructions):** the verdicts are **Fits · Likely fits · Depends · Unlikely · Not supported** (`fits`, `likely_fits`, `depends`, `unlikely`, `not_supported`) in `gapMatch.verdict`, with the evidence as stable codes in `gapMatch.signals`. The table above's `different_preposition` and `different_position` are not separate verdicts: a verb frame that takes another preposition is _Unlikely_ (contradicting evidence), and linkers in the wrong position are never candidates (Step 4.2). Verb-frame results keep their protected Phase 3 `fit` beside the new verdict.

- **Precedence**, for every kind: an authored mistake recreated by the filled-in words → _Unlikely_; a structure that doesn't cover the context (a verb frame whose authored objects don't include the learner's) → _Not supported_; everything checkable agrees → _Fits_; one part can't be checked → _Likely fits_; what decides the fit isn't in the sentence → _Depends_.
- **Prepositions:** what follows the blank against the pattern's authored complement. A determiner (_the_, _my_…) shows a noun phrase; an -ing form shows -ing; a person pronoun (_me_, _them_, _others_…) shows a person; _whether_/_what_/_if_… show a clause → _Fits_. Any other word before a noun complement → _Likely fits_ (Lexora can't check it starts a noun phrase). A person or clause it can't recognise, or nothing after the blank → _Depends_.
- **Mistakes:** the candidate sense's own authored mistakes (one batched read). A mistake counts when the learner's words, with the candidate in the blank, contain its wrong words and the authored word next to them on each side where the mistake has one — so _important for me_ is recreated, _important for young people_ is not. The mistake is shown with the answer.
- **Collocations:** the learner's words as written → _Fits_; a word matched only through the stemmer → _Likely fits_; a recreated mistake → _Unlikely_. Between equally long collocations, an exact match is preferred.
- **Linkers:** always _Depends_: the position matches the learner's punctuation, but which relationship the sentence needs is meaning Lexora doesn't read.
- **Verb frames** (protected answers unchanged): Phase 3 `fits` with a preposition in the sentence → _Fits_, without one → _Likely fits_; `different_preposition` → _Unlikely_; `unlikely` → _Not supported_. Evidence: the frame's display text.
- **Order:** within each blank and kind, by verdict (fits → likely fits → depends → unlikely → not supported), then the Step 4.2 order. Verb-frame order is unchanged. Reasons explain the verdict in words; nothing is scored.

## 9. Ranking

- **CG-D9:** gap results never enter `rank.ts`. Within each gap type the order is: **verdict** (`fits` → `depends` → `different_preposition` → `different_position` → `unlikely`) → **evidence scope** (a structure covering both blanks before one covering one) → **IELTS relevance** (core → high → useful) → **authored position** → **headword A–Z** → sense ID.
- Groups appear in analyser order: verb frame, preposition, collocation, linker. Joint (two-gap) candidates come first.
- **Snapshot safety, checked:** applying this order to the 6 gap blocks in `test/search-snapshot.txt` changes **0** groups. With current content, evidence scope and authored position are equal within those groups, and relevance agrees with A–Z for allocate (high) / devote (useful).
- Ordinary search keeps `rank.ts` untouched. Gap ranking activates only inside `gapSearch`, after the reader has found a blank (CG-D5).

## 10. Filters

**CG-D10:** unchanged Step 3a semantics.

1. Classify and read the query (filters ignored).
2. Build the gap answer.
3. `restrict()` removes candidates whose sense doesn't match.

Verdicts and groups are never recomputed. "Doesn't fit" rows are filtered like any other, so a filter can't promote one. A filter can't turn an ordinary query into a gap query, or a gap query into a fallback. The reader decides that before filters are seen. A gap query whose candidates are all filtered out gets the existing honest state: "Your search found N results, but none match these filters".

## 11. Fallback rules

**CG-D6:** a gap interpretation needs a blank (CG-D5) **and** analyser evidence. Otherwise:

| Case                                                        | Example                                            | Answer                                                                            |
| ----------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------- |
| No blank marker                                             | "Governments should invest more"                   | Ordinary search (today)                                                           |
| Ellipsis at an edge (not a blank)                           | "however...", "There is growing concern about ..." | **Ordinary search** on the text without the marker (fixes today's empty result)   |
| Mid-sentence ellipsis, no evidence                          | "The results were ... surprising"                  | Ordinary search on the text without the marker                                    |
| Underscore blank, no evidence, words after it               | "I like ___ music"                                 | Gap answer, outcome `none`, "Lexora couldn't read this gap…" plus a tip (see OQ3) |
| Underscore blank, nothing after it, `L1` not a pattern base | "I like _**", "**__"                               | Today's prompt: "Find a word for the gap — add the words that come after it"      |
| Underscore blank with no object after it                    | "Governments should ___ to public transport"       | **Unchanged** (golden: `CONTEXT_GAP`, `none`)                                     |
| 3+ blanks                                                   | "a ___ b ___ c ___ d"                              | Gap answer, outcome `none`: "Lexora reads up to two gaps — fill in the others"    |
| Blank inside a blank run                                    | "___ ___ ___"                                      | 3 blanks → the same message                                                       |
| Data unavailable (no candidates of the type)                | "___, it is cheaper" with no matching linker       | Outcome `none`, with the reason                                                   |
| Conflicting signals (two analysers both have evidence)      | rare                                               | Both groups, labelled by type, verdict order kept; nothing picked silently        |
| Over-long query                                             | > 200 characters                                   | Cut to 200 (today), then the same rules                                           |

An underscore blank is an explicit request for a gap, so it never silently becomes ordinary search. That keeps the pinned `Governments should ___ to public transport` and the learner's intent. Ellipses are ambiguous, so they fall back.

**As built in Step 4.1** (`src/language/search/gap/reader.ts`, `planGaps`), with three refinements the owner's Step 4.1 instructions settled:

- **More than two blanks → ordinary search** on the text without its markers, with `gapNote: "too_many_gaps"` on that ordinary response (the table above said a gap answer with a note).
- **Underscores win:** when a query has any underscore blank, every ellipsis in it is punctuation, so "Well... Governments should ___ more money" reads one blank.
- **Blanks and no words** ("__**", "**_ ___") → ordinary search, which has nothing to search: no answer (`null`), as for a punctuation-only query.

An ellipsis between words counts as a blank only when a verb frame answers it (the only analyser in 4.1); otherwise ordinary search. Underscore blanks stay gap queries (the pinned `Governments should ___ to public transport`). Response fields as built: `gaps: { index, at, marker, type }[]` on gap answers (`type` is `verb_frame` or `unknown`) and `gapNote` on the ordinary fallback.

## 12. Multiple gaps

- At most **two** blanks (CG-D4). Three or more → the message in §11; no analysis.
- **Joint reading first:** a single authored structure covering both blanks.
  - Frame: _invest … in_.
  - Pattern on a collocation base: _play a ___ role ___ reducing_ → _crucial_ + _in_.
  - Joint candidates fill both blanks and come first.
- **Otherwise, independent:** each blank is analysed on its own (the other blank counts as an unknown word, never as an anchor) and gets its own group ("Gap 1", "Gap 2"). Candidates are **never combined across gaps**: no cross product, so at most `n₁ + n₂` rows.
- **Caps:** at most 20 candidates per gap and 20 joint candidates.
- The **window** stops at the other blank: each gap's `before`/`after` never reads past it.
- **Rejecting the reading:** if neither a joint structure nor any single-gap evidence exists, the §11 rules apply.

Today the second blank is silently ignored (`Governments should ___ more money ___ public transport` checks only _money_). Under these rules the frame covers both blanks, so the answer becomes joint: allocate … to, invest … in, devote … to, each with its object check. That query isn't one of the six protected cases.

## 13. URL and API contract

**CG-D11:** no URL or API changes. The sentence travels in `q` (blanks URL-encoded as today). The canonical order, the 307 rules and the filters are unchanged. There is no new endpoint; the response type grows by optional fields only (§14).

## 14. UI result contract

**CG-D12:** the minimum the UI needs, all optional and additive on `SearchResponse` and `SearchResult`. Existing fields keep their meaning.

```ts
// SearchResponse
gaps?: { index: 0 | 1; type: GapType | "unknown" }[];  // what each blank was read as
gapNote?: "unreadable" | "too_many_gaps";              // why there is no gap answer
// SearchResult (gap results only)
fit?: "fits" | "depends" | "different_preposition" | "different_position" | "unlikely";
fill?: { word: string; preposition?: string };         // unchanged for frames
fills?: string[];                                      // one word per blank it fills (new types)
pattern?: string;                                      // the authored structure, e.g. "be responsible for + noun / -ing"
```

The reason (always present) is "why this fits". The example comes from the existing `example` field, picked from the structure's linked example when there is one. The existing `gap: { object, preposition }` stays for the verb-frame tool.

Copy rules for the later UI step:

- Say "fits this sentence's pattern" and "Lexora's patterns", never "correct" or "grammar".
- Never show a score.
- Label the tool by what it read: "Prepositions after “responsible”", "A word in “a ___ increase”", "Linkers for the start of a sentence".
- `gapNote` messages say what Lexora couldn't read and how to rephrase.

DESIGN.md changes (new FitBadge states, the generalised context tool) come with the UI step, not now.

## 15. Schema assessment

**CG-D13:** **no database migration** for Steps 4.1–4.5. Frames are `jsonb` (slot types are checked in Zod, not Postgres), and every read uses existing columns. Possible content-model extensions, each needing an owner decision:

- an `infinitive` slot type (vocabulary + Zod only; OQ4);
- a structured linker comma rule (OQ6);
- per-token roles in collocations (OQ5).

## 16. Content requirements

|     | Engine work (Steps 4.1–4.5)            | Editorial content (content PRs, Wave 2)                                                                                                      |
| --- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Gap reader + fallback (fixes ellipsis) | —                                                                                                                                            |
| P2  | Preposition analyser                   | Inflected forms for every pattern base (most exist); patterns for Wave 2 words                                                               |
| P3  | Collocation analyser                   | Gap-able collocations: adjective + noun and verb + noun for topic vocabulary (target ≥ 60 more, parent §7.7); first noun + verb collocations |
| P4  | Linker analyser                        | Linkers for comparison, cause, and more concession, each with positions                                                                      |
| P5  | Joint two-gap structures               | Patterns on collocation bases (_play a crucial role in_), frames with prepositions                                                           |
| P6  | (OQ4) infinitive slot                  | Verb frames: ≥ 15 with fillers, incl. `-ing`, `that`-clause and person frames (_encourage someone to_, _suggest doing_, _argue that_)        |

**CG-D14:** Step 4 adds no content. The engine is demonstrable on today's content for prepositions (29 patterns), collocations (39), the three frames and contrast/addition linkers. Comparison and cause linkers and new frame types wait for Wave 2.

## 17. Test strategy

**CG-D15:**

1. **Unit (pure).** Reader: blank detection, the ellipsis rule, windows, punctuation flags, caps. Each analyser on fixtures. Ordering.
2. **Classifier/fallback.** Every §11 row.
3. **Retrieval.** In-memory and Postgres give identical gap answers on the real content (the Step 3a equality pattern).
4. **Golden.** The six protected cases unchanged; new cases added per analyser step (below).
5. **Snapshot.** Unchanged for existing blocks; new gap queries added only with explained diffs.
6. **Filters.** Gap queries × every single filter: the reading is identical and the results are a subsequence (the Step 3a property).
7. **HTTP e2e.** Gap pages render, fallback pages show ordinary results, URLs are unchanged.
8. **Regression.** Golden + snapshot + the two pinned e2e wordings.

| Query                                                         | Expected (current content)                                                         | Kind                        |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------- |
| Cars are largely responsible ___ air pollution                | preposition: _for_ fits, _to_ depends; mistake _responsible of_                    | positive                    |
| Many families depend ___ one income                           | _on_ fits; mistake _depend of_                                                     | positive                    |
| Young people are interested ___ following careers             | _in_ fits (-ing)                                                                   | positive                    |
| The report focused ___ housing                                | _on_ via the inflection _focused on_                                               | positive                    |
| There was a ___ increase in cycling                           | collocation: _significant_, _substantial_ (both authored)                          | positive                    |
| Public transport plays a ___ role                             | _crucial_ (item), _significant_; _key/vital/major_ (collocations of the item)      | positive                    |
| Governments should take ___ to reduce crime                   | _measures_; _steps_                                                                | positive                    |
| Schools could raise ___ of the dangers                        | _awareness_                                                                        | positive                    |
| ___, it is often slow and crowded                             | linkers at the start, grouped by function; _whereas_ → different position          | positive                    |
| Governments should ___ more money ___ public transport        | joint: invest … in, allocate … to                                                  | multi-gap                   |
| Public transport plays a ___ role ___ reducing congestion     | joint: crucial … in                                                                | multi-gap                   |
| Governments should ____ more money into public transportation | **unchanged**                                                                      | protected                   |
| Governments should ___ to public transport                    | **unchanged** (`none`)                                                             | protected                   |
| however...                                                    | ordinary search → _however_                                                        | fallback                    |
| There is growing concern about ...                            | ordinary search → the sentence pattern                                             | fallback                    |
| The results were ... surprising                               | ordinary search                                                                    | fallback                    |
| I like ___ music                                              | gap, `none`, unreadable note                                                       | fallback                    |
| a ___ b ___ c ___ d                                           | too-many-gaps note                                                                 | limit                       |
| a ___ the                                                     | no anchors → unreadable                                                            | false positive guard        |
| The ___ is high                                               | no anchor matches → unreadable, not "significant"                                  | false positive guard        |
| responsible ___                                               | prepositions after _responsible_, no verdict (nothing after)                       | edge                        |
| ___                                                           | today's prompt                                                                     | edge                        |
| important ___                                                 | prepositions after _important_, no verdict (nothing after)                         | edge                        |
| My family is very important ___ me                            | _to_ fits (pronoun = person); _for_ unlikely (authored mistake _important for me_) | positive / mistake evidence |
| Cars are responsible ___                                      | as _responsible ____                                                               | edge                        |
| Exercise contributes ___ health                               | _to_ fits; mistake _contributes for_                                               | positive                    |
| the economy depends ___ tourism + kind=linker                 | gap reading unchanged; all filtered → honest empty                                 | filter                      |

## 18. Performance

Per gap query, worst case (all analysers, two gaps):

- frames: 1 read, as today;
- forms: 1 read;
- patterns: 1–2 reads;
- collocation templates: 1 read;
- linkers: 1 read;
- summaries: 4 reads, as today.

That's about 9–10 round trips, inside the parent spec's budget (≤ 12). Candidate sets are tiny: tens today, hundreds after Wave 2. Template matching is O(templates × window), small enough to run on every request.

**CG-D16:**

- No index and no cache now.
- If Step 8's measurement shows gap reads dominating, memoise the template and linker reads per content release (the parent spec's plan).
- Existing indexes already cover `normalized` and `base_normalized`.

## 19. Security and abuse

**CG-D17:**

- Blanks ≤ 2 (more → refuse before any analysis).
- Query ≤ 200 characters (today) and ≤ 40 words for gap analysis.
- Windows ≤ 3 words each side.
- ≤ 20 candidates per gap, with no cross product between gaps.
- No regular expression built from learner text. The existing `sentenceParts` in the context tool builds one from an engine-supplied preposition; it must escape its input when generalised.
- Every database value is a bound parameter. Lookups use exact forms only, no `LIKE` with learner text (the existing mistake `LIKE` escapes).

Gap queries add no new endpoint and no write path. Rate limiting stays Step 6's job.

## 20. SEO

Gap queries are `/explore?q=…` pages: `noindex, follow`, canonical `/explore`, as today (D13 deferred). Nothing about them reaches the sitemap. `/finder` is private. **No change.**

## 21. Decisions

| #      | Decision                         | Recommendation                                                                                                                           | Status                         |
| ------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| CG-D1  | Where detection lives            | `src/language/search/gap/` (reader, analysers, joint), called from `gapSearch`                                                           | Proposed                       |
| CG-D2  | Classifier vs separate structure | Keep the one classifier rule; a separate internal `GapReading`                                                                           | Proposed                       |
| CG-D3  | First gap types                  | Preposition, collocation (structure-agnostic), verb frame (existing), linker                                                             | Proposed                       |
| CG-D4  | Max gaps                         | 2; 3+ refused with a message                                                                                                             | Proposed (parent D9: approved) |
| CG-D5  | Minimum evidence                 | A blank (underscores; an ellipsis only between words) and an authored structure aligned with ≥ 1 adjacent content anchor                 | Proposed                       |
| CG-D6  | Fallback                         | No blank or an edge/mid ellipsis without evidence → ordinary search; underscore blank without evidence → honest gap note                 | Proposed                       |
| CG-D7  | Retrieval                        | Existing repository methods + two "load published rows" reads; matching in memory                                                        | Proposed                       |
| CG-D8  | Fit model                        | Verdicts `fits`, `depends`, `different_preposition`, `different_position`, `unlikely`; authored mistakes as negative evidence; no scores | Proposed; `depends` is OQ1     |
| CG-D9  | Ranking                          | Gap-only order (verdict → scope → relevance → position → A–Z); `rank.ts` untouched; verb frames first and final when they fit            | Proposed                       |
| CG-D10 | Filters                          | Unchanged Step 3a: read, answer, then restrict                                                                                           | Proposed (follows approved D3) |
| CG-D11 | URL/API                          | No change                                                                                                                                | Proposed                       |
| CG-D12 | UI contract                      | Optional `gaps`, `gapNote`, `fills`; existing fields unchanged                                                                           | Proposed                       |
| CG-D13 | Schema                           | No migration; possible content-model extensions are OQ4–OQ6                                                                              | Proposed                       |
| CG-D14 | Content                          | None in Step 4; prioritised list in §16 for content PRs                                                                                  | Proposed                       |
| CG-D15 | Tests                            | §17 matrix; golden + snapshot + pinned wording protected                                                                                 | Proposed                       |
| CG-D16 | Performance                      | ≤ ~10 round trips; no index or cache now                                                                                                 | Proposed                       |
| CG-D17 | Limits                           | ≤ 2 blanks, ≤ 40 words, ±3-word windows, ≤ 20 candidates per gap, no cross product, no learner-built regex                               | Proposed                       |
| CG-D18 | Deferred                         | §23                                                                                                                                      | Proposed                       |

## 22. Implementation plan

| Step    | Scope                                                                                                                                                  | Proves                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| **4.1** | Gap reader (raw-query blanks, ellipsis rule, ≤ 2, windows, limits) + fallback routing + `gapNote` + response fields; verb-frame path wrapped unchanged | Golden + snapshot unchanged; §11 rows as golden cases; "however..." fixed |
| **4.2** | Preposition analyser (+ `depends` if OQ1 approved)                                                                                                     | Preposition rows of §17                                                   |
| **4.3** | Collocation analyser                                                                                                                                   | Collocation rows + false-positive guards                                  |
| **4.4** | Linker analyser (+ `different_position`)                                                                                                               | Linker rows                                                               |
| **4.5** | Joint two-gap structures                                                                                                                               | Multi-gap rows; second blank no longer ignored                            |
| **4.6** | UI: generalised context tool, FitBadge states, notes; DESIGN.md first; manual Chrome pass                                                              | Copy rules (§14)                                                          |
| Content | In parallel, separate PRs: §16 priorities                                                                                                              | —                                                                         |

Each step is one feature PR into the phase branch, with golden cases for what it adds. Opening each as a draft lets the owner review it before CI's auto-merge.

## 23. Deferred

- The gapless sentence-level check (parent §7.3 item 2; parent D18 still _proposed_).
- Collocation token roles and subtype labels (adjective/noun/verb gap).
- Noun + verb gaps until content exists.
- The infinitive slot (OQ4).
- Structured linker punctuation (OQ6).
- Inferring the relationship a linker should express (contrast vs addition) from the sentence.
- More than two gaps.
- Showing contained terms beside an unreadable gap (OQ3).
- Any AI or semantic matching.
- Caching.
- The TOPIC query rule (parent D19).
- D13.

## 24. Risks and open questions

| #   | Open question                                                         | Missing evidence / decision                                                                                                      | Recommendation                                      |
| --- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| OQ1 | Add the `depends` verdict?                                            | Whether the owner wants a fifth badge state, or person/clause patterns shown as `fits` with the pattern text doing the warning   | Add it: the alternative overclaims                  |
| OQ2 | Gapless sentence check in Step 4?                                     | Parent D18 is still proposed                                                                                                     | Defer to after 4.6                                  |
| OQ3 | Show terms Lexora recognises elsewhere in an unreadable gap sentence? | Whether extra groups on unreadable gaps are wanted; the pinned `Governments should ___ to public transport` must stay group-free | Defer; revisit with real queries (Step 7 data)      |
| OQ4 | Add an `infinitive` slot type for _someone to do something_ frames?   | Owner decision on the content model (no migration needed)                                                                        | Yes, with the first content PR that needs it        |
| OQ5 | Record token roles in collocations?                                   | Needed only for subtype labels; adds authoring cost                                                                              | No for now                                          |
| OQ6 | Structured linker comma rule?                                         | Free-text `punctuation` today; content-model change                                                                              | Not for 4.4; position + the learner's comma suffice |

**Risks.**

- **Collocation over-matching as content grows.** Guarded by exactly one blank token, an adjacent content anchor, and negative golden cases.
- **The ellipsis fix changes answers for edge-ellipsis queries.** None is protected (checked), and the change replaces an empty result.
- **The UI copy could drift towards a "grammar check" feel.** The §14 copy rules apply.
- **Content coverage, not the engine, will limit results for most sentences.** The §16 priorities and Wave 2 address this.
