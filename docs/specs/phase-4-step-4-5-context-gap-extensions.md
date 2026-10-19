# Phase 4 · Step 4.5 — Context-gap extensions: audit and specification

Written: 18 October 2026 · Baseline: `phase/4-search-depth` at `343ab24` (Steps 0–3 and 4.0–4.4 merged) · Parents: [phase-4-step-4-context-gaps.md](phase-4-step-4-context-gaps.md) (Step 4.0; as built in 4.1–4.3), [phase-4-step-4-context-coverage.md](phase-4-step-4-context-coverage.md) (Step 4.4; its open questions OQ-A–OQ-D), [phase-4-search-depth.md](phase-4-search-depth.md) §7

Decisions are numbered **G5-D1 … G5-D9**, so they don't collide with CG-D (Step 4.0), CC-D (Step 4.4) or the parent register.

## 1. Status

**Audit and specification only, awaiting owner approval.** Nothing in the engine, schema, content, UI or tests changed while writing it.

The audit was run on the published content (40 items, 42 senses). All probes went through the real `LanguageSearchService`, using the in-memory repository, with statement counts logged by Drizzle against local Postgres. The probe scripts lived outside the repository.

## 2. Problem statement

Step 4.4 left four open questions:

| #    | Question                                                                   |
| ---- | -------------------------------------------------------------------------- |
| OQ-B | Can one authored structure answer **both** blanks of a two-blank sentence? |
| OQ-A | Should "It is ___ that …" be answered?                                     |
| OQ-C | Should names, "people" or role nouns be read as persons?                   |
| OQ-D | Should a linker at the end of a sentence ("…, ___.") be read?              |

This document decides, from the existing content only, which of them can be answered honestly and deterministically. It also records the false _Fits_ verdicts that the regression audit found after Step 4.4.

## 3. Current behaviour (4.1–4.4)

- **Gap reader (4.1).** At most two blanks; each blank gets a window of ±4 words that stops at the other blank and at adjacent punctuation.
- **Candidates (4.2, 4.4):**
  - _Prepositions:_ pattern bases, inflected through authored forms; after a verb frame's object.
  - _Collocations:_ any content word anchors, guarded against repeats; first-word inflections the content authors.
  - _Linkers:_ by punctuation and the authored positions.
- **Verdicts (4.3, 4.4).** Fits · Likely fits · Depends · Unlikely · Not supported, by the 4.3 precedence. A side of the blank the collocation doesn't cover is "unchecked":
  - on the right, when the collocation ends at the blank and a content word follows;
  - on the left, when it starts at the blank after a function word.

  Either way the verdict is at most _Likely fits_.

- **Two blanks.** They are judged independently. Gap 1 of a verb-frame sentence keeps its protected Phase 3 answer, and **gap 2 of such a sentence is always `unknown`**:

| Query (real content)                                        | Today                                                                                           |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Governments should ___ more money ___ public transport      | Gap 1: allocate, invest (Likely fits, `no_preposition`); devote Not supported. Gap 2: `unknown` |
| People should ___ more attention ___ environmental problems | Gap 1: devote. Gap 2: `unknown`                                                                 |
| Governments should ___ resources ___ public services        | Gap 1: allocate, devote, invest. Gap 2: `unknown`                                               |
| The council ___ land ___ housing                            | Both `unknown` (no frame lists "land")                                                          |
| Teachers ___ a crucial role ___ shaping attitudes           | Gap 1: play (Fits). Gap 2: `unknown`                                                            |
| Governments must ___ measures ___ crime                     | Gap 1: take (Fits). Gap 2: `unknown`                                                            |

## 4. Audit findings (summary)

1. **OQ-B is supported by the current data, with no schema or content change.** Two kinds of authored structure already span both blanks:
   - a **verb frame** (head ▸ object ▸ preposition);
   - a **preposition pattern on a multiword base** (head ▸ rest of the base ▸ preposition).

   The frame or pattern itself is the evidence that links the two blanks. No inference across blanks is needed.

2. **OQ-A can be supported with a small engine change, but the evidence can never justify _Fits_.** The only words that anchor "It is ___ that" are function words.
3. **OQ-C stays deferred.** The closed pronoun list covers what the content asks for. Names and role nouns would need a lexicon (data model).
4. **OQ-D stays deferred.** Only 2 linkers author an end position, the comma rules are free text, and the verdict could only ever be _Depends_.
5. **The regression audit found three new kinds of false _Fits_** (§9). Two can be repaired in the engine with existing closed-class lists; one is content work.

## 5. OQ-B — two blanks answered by one authored structure

### 5.1 Which authored structures span two blanks

**Verb frames.** There are 3 frames. Each one's `parts` are `head ▸ object slot (fillers) ▸ literal preposition (+ also) ▸ noun slot`. That is exactly blank 1 ▸ object ▸ blank 2 ▸ what follows.

| Frame                          | Head     | Object fillers                                            | Preposition(s) | Object pattern (same sense)  | Pattern complement |
| ------------------------------ | -------- | --------------------------------------------------------- | -------------- | ---------------------------- | ------------------ |
| `allocate.distribute:money-to` | allocate | money, funds, funding, resources, time, budget, places    | to / for       | `allocate + noun + to`       | noun               |
| `devote.give:time-to`          | devote   | time, effort, energy, attention, resources, life, years   | to             | `devote + noun + to`         | noun_or_ing        |
| `invest.money:money-in`        | invest   | money, funds, resources, time, effort, billions, millions | in / into      | `invest + money / time + in` | noun_or_ing        |

**Preposition patterns on a multiword base.** There are 9. A pattern whose base has two or more words spans both blanks when blank 1 is the base's first word, the rest of the base stands between the blanks, and blank 2 is the preposition:

| Pattern                        | Blank 1 | Words between the blanks | Blank 2    | Complement  |
| ------------------------------ | ------- | ------------------------ | ---------- | ----------- |
| give rise + to                 | give    | rise                     | to         | noun        |
| have a detrimental effect + on | have    | a detrimental effect     | on         | noun        |
| play a crucial role + in       | play    | a crucial role           | in         | noun_or_ing |
| pose a threat + to             | pose    | a threat                 | to         | noun        |
| raise awareness + of / about   | raise   | awareness                | of / about | noun        |
| take measures + against        | take    | measures                 | against    | noun        |
| as a result + of               | as      | a result                 | of         | noun        |
| in contrast + to               | in      | contrast                 | to         | noun        |

_In contrast + to_ is excluded by rule: blank 1 would be "in", a stopword, and Lexora never offers a stopword for a blank (the 4.2 rule). That leaves 8 patterns.

### 5.2 Answers to the audit questions

1. **Which frames can span two blanks:** all 3 verb frames and 8 multiword-base patterns, listed above.
2. **Does the data model relate blank 1, the object and blank 2:** yes. Frame `parts` encode the order; a pattern's `base` and `preposition` encode it for patterns.
3. **Can the repository expose it without schema changes:** yes.
   - Frames: the existing `listGapFrames()`.
   - Patterns: one new bounded read, `findPatternsByBaseTail(tails)` — published patterns whose `base_normalized` ends with one of the given word runs. It uses the existing trigram index and needs no migration. Both repositories implement it.
4. **Is the coordinated answer stronger than independent matching:** yes. Today gap 2 is `unknown` for every such sentence. The coordinated answer fills both blanks from one authored structure, and every verdict input is authored: the object filler, the preposition, the complement.
5. **False-positive risks:** see §5.4.
6. **One shared verdict, linked verdicts, or independent:** **one shared verdict per pair** (G5-D2). The pair is one authored structure ("invest … in"). A separate verdict for "in" alone would always be _Depends_ (it depends on gap 1), which tells the learner nothing.
7. **Interactions:** see §14–§18.
8. **Only one half matches:** no pair; each blank keeps its independent answer. A frame head that fits but whose object isn't authored produces no pair; the protected gap-1 row already says _Not supported_. Words between the blanks that differ from the pattern's base by even one word produce no pair.
9. **Several frames fit blank 1:** each frame yields its own pairs, with its own prepositions only. Pairs are never crossed: no "allocate … in", no "invest … to".
10. **Blank 2 is also answerable on its own:** both are shown. The pair group comes first, the independent group for blank 2 stays as it is, and nothing is deduplicated or silently picked. Real example: "The policy ___ rise ___ protests". Today gap 2 alone gets _sharply_, _dramatically_, _gradually_ and _steadily_ at _Likely fits_: a wrong-role match ("rise" is a noun here), correctly hedged by the open-right rule. With 4.5 the pair _give … to_ comes first, and that gap-2 group stays as it is.

### 5.3 Supported by current data vs needs new content or data model

| Behaviour                                                                  | Status                                                                                                                |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| verb ▸ object ▸ preposition pairs for allocate, devote, invest             | **Supported by current data**                                                                                         |
| head ▸ rest of base ▸ preposition pairs for the 8 patterns                 | **Supported by current data**                                                                                         |
| "pay attention to", "spend money on" and other common two-blank frames     | **Needs new content.** "People should ___ more attention ___" only reaches _devote … to_; _pay_ is not in the content |
| A pair through a collocation **variant** ("pose a **serious** threat ___") | **Needs a content or data-model decision.** The pattern is authored on "pose a threat", not on its variants. Deferred |
| Frames with -ing, clause, person or infinitive slots                       | Needs new content (and OQ4's content-model decision for infinitives)                                                  |

### 5.4 False-positive analysis

| Risk                                                                               | Protection                                                                                                                                            |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crossing frames ("allocate … in")                                                  | Pairs come from one frame or pattern only                                                                                                             |
| An object Lexora doesn't author ("___ land ___ housing")                           | No pair                                                                                                                                               |
| Blank 2 isn't a preposition slot ("___ more money ___ year", meaning _every_ year) | The complement check gives _Likely fits_ for a plain noun. With a determiner ("___ the year") it would give _Fits_: a residual risk, documented (§22) |
| Words between the object and blank 2 ("___ more money each year ___ transport")    | Blank 2 must directly follow the object (frames) or the base's last word (patterns); otherwise no pair                                                |
| The verb form in blank 1 ("They have ___ money ___ schools" needs _invested_)      | The left-side rule, extended to auxiliaries (§9, R-1), gives at most _Likely fits_                                                                    |
| Blank 1 offered as a stopword ("in … to")                                          | Excluded by the 4.2 fill rule                                                                                                                         |

## 6. OQ-A — "It is ___ that …"

- **Evidence in the content:**
  - Two collocations: `crucial.essential:that` "it is crucial that" and `essential.necessary:that` "it is essential that".
  - One example, "It is essential that governments act before the problem gets worse."
  - The frame "It is worth noting that + clause". It is a sentence frame, not a gap source, and its fill would be two words.
  - No mistake involves these constructions.
- **"It is important to …"** is only an example sentence, not a collocation. So "It is ___ to consider the costs" has no evidence.
- **Today:** "It is ___ that governments should act" gives nothing. The collocation's other words (it, is, that) are all function words, and Step 4.4 requires a content word among them (CG-D5 / CC-D5).
- **Plausible vs evidence for _Fits_:**
  - The whole authored template matches the learner's words as written, so _crucial_ and _essential_ are evidenced.
  - But "that" may start a content clause ("It is crucial that governments act") or a cleft ("It is ___ that I like most", where the blank is a noun). Lexora can't tell them apart, and the anchor is made of function words alone.
  - So the evidence can support at most _Likely fits_, never _Fits_.
- **Contractions:** "It's ___ that" never matches, because collocations have no forms and "it's" ≠ "it is". That would need content (forms on collocations) or normalisation work. Out of scope.
- **Classification: B** — supportable with a small deterministic engine change, **capped at _Likely fits_** (G5-D4):
  - a template made only of function words apart from the blank may align when it has at least 3 other words, all matched as written (no stemmer, no inflection family);
  - its verdict is at most _Likely fits_, with signal `function_words_only`.

## 7. OQ-C — persons, names and roles

- **What the content asks for:**
  - 2 patterns have a `person` complement: `important to + person` and `be responsible to + person / organisation`.
  - The pattern `depend on + noun / person` is stored with complement `noun`, because the vocabulary has no "noun or person" complement.
- **Probes:**

  | Query                                              | Result                                                                                                           |
  | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
  | important ___ me                                   | _to_ Fits (`person_follows`); _for_ Unlikely (authored mistake)                                                  |
  | important ___ John · ___ people · ___ young people | _to_ Depends (`person_unknown`); _for_ Likely fits                                                               |
  | responsible ___ the governors · ___ parents        | _to_ Depends                                                                                                     |
  | depend ___ them                                    | _on_ (rely) Likely fits (`noun_unchecked`): the stored complement is `noun`, so "them" isn't checked as a person |

- **Findings:**
  - Every person-complement answer is honest: it is _Depends_ unless a closed-class pronoun follows.
  - Reading names, "people" or role nouns (teachers, parents, governors) as persons would need an open-class lexicon, which is new data with no authored source.
  - Capitalisation isn't evidence ("London").
- **Decision (G5-D5):** **deferred**, with no engine change. Two content-model notes for a later content wave:
  1. a `noun_or_person` complement, so `depend on + noun / person` can say what its display says;
  2. if persons are ever wanted, an authored person-noun list in content, not a heuristic.

## 8. OQ-D — linkers at the end of a sentence

| Linker       | Authored positions | Connects  | Punctuation (free text)                                        |
| ------------ | ------------------ | --------- | -------------------------------------------------------------- |
| however      | start, middle, end | sentences | "…; a comma before it at the end."                             |
| for instance | start, middle, end | sentences | "A comma after it at the start; between commas in the middle." |
| (9 others)   | no `end`           |           |                                                                |

1. **Position-sensitive linkers:** all 11 have structured `positions`.
2. **Linkers that can end a sentence:** only _however_ and _for instance_.
3. **Enough structure?** Partly. Positions are structured; comma rules are free text (OQ6).
4. **Comma rules:** free text only.
5. **Deterministic placement:** yes. A comma before the blank, nothing after it except end punctuation, gives an "end" slot ("The plan failed, ___." today gives nothing, with 0 statements).
6. **Semantic data:** which relationship the sentence needs is meaning. The verdict could only be _Depends_.

**Decision (G5-D6):** **deferred until content enrichment.** It is worth building once more end-position linkers are authored ("though", "as well", "too") and the comma rule is structured (OQ6). With 2 linkers and _Depends_ at best, it adds noise, not help.

## 9. Regression findings (after Step 4.4)

**Step 4.4 behaviour held.** On real content, every case listed in the review brief answers as Step 4.4 specifies:

- "take ___ measures" → _urgent_ Fits, _steps_ Likely fits;
- "raise ___ awareness" → _public_;
- "There is ___ a threat" → Likely fits;
- "Plastic waste ___ a threat" → Fits;
- "poses a threat ___" → _to_;
- "allocated money ___ education" → _to_, _for_;
- "invest money ___ public transport" → _in_, _into_;
- "devoted her life ___ helping" → _to_ Fits;
- "___ a threat" → _pose_;
- "___ a crucial role" → _play_;
- "took ___ to reduce crime" → _measures_, _steps_ Fits;
- "Prices rose ___" → four collocations;
- "has a ___ effect on" → _detrimental_, _negative_.

"___ a negative effect" with nothing after it correctly gives nothing: the collocation is "have a negative effect **on**".

**New false _Fits_ (recorded; not fixed in this PR):**

| #   | Query                                                                                               | Result                                 | Cause                                                                                                                                                                                                                                                         | Class                                                                                 |
| --- | --------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| F1  | It was ___ a key role · They were ___ a threat · It has been ___ a threat · Prices have ___ sharply | _play_ / _pose_ / _rise_ **Fits**      | The left-side rule only knows the closed function-word lists, which lack the other forms of _be_ and _have_ (was, were, been, being, has, have, had, having). After them, the base form offered can't be right ("have rise") and the combination is unchecked | **Engine** (closed list) → R-1                                                        |
| F2  | Teachers play a ___ role models · Schools ___ awareness campaigns                                   | _crucial_… / _raise_ **Fits**          | The collocation ends on a content word **after** the blank, and the learner's next word is a content word ("role **models**", "awareness **campaigns**"). G3 only checks a collocation that ends **at** the blank                                             | **Engine** → R-2                                                                      |
| F3  | A ___ amount of people                                                                              | _considerable_, _substantial_ **Fits** | "amount of people" is a countability error authored only under `significant.notable` ("a significant amount of people"). Mistakes are scoped to their own sense (CC-D9)                                                                                       | **Content:** author the same mistake for `considerable.large` and `substantial.large` |

**Probed and not false Fits:**

- "Not ___ a threat" and "This will ___ a threat" → _pose_: correct after "does not" and "will".
- Hedged correctly at _Likely fits_:
  - "Prices are ___ sharply", "The ___ awareness of pollution", "Very ___ a threat" (left side);
  - "take ___ action", "take ___ steps", "Prices rose ___ last year" (right side).
- Linkers stay _Depends_ even where the relationship is wrong ("He said, ___ it was late" → _whereas_ Depends).
- A wrong collocation role is hedged: in "The policy ___ rise ___ protests", gap 2 matches "rise sharply" with "rise" read as a verb, but stays at _Likely fits_ because "protests" follows unchecked.
- "Cars are responsible ___ pollution and depend ___ oil" stays two independent groups; nothing in it is a single structure.

**Known and unchanged:** a collocation fill is offered in its base form. "Prices ___ sharply" → _rise_ Fits is correct with a plural present subject, but the form the sentence needs isn't checked. R-1 hedges the auxiliary cases.

## 10. Performance findings

Measured on `343ab24` (local Postgres, statements logged by Drizzle):

| Query                                                  | Statements | Notes                                                      |
| ------------------------------------------------------ | ---------- | ---------------------------------------------------------- |
| Protected verb frame                                   | 5          |                                                            |
| Governments should ___ more money ___ public transport | 9          | Frames + summaries (5), candidate reads (4), no candidates |
| Teachers ___ a crucial role ___ shaping attitudes      | 14         |                                                            |
| The council allocated money ___ education              | 15         | The current maximum                                        |
| Unreadable gap / ordinary search                       | 9 / 7      |                                                            |

**Estimated for Step 4.5.**

- **Two new reads**, both in the existing parallel candidate batch, so no new round trip:
  - `findPatternsByBaseTail` (1 statement, only with two blanks and at least one word between them);
  - `listGapFrames()` (1 statement, only with two blanks where gap 1's verb frame fits).
- **Example:** "Governments should ___ more money ___ public transport" goes from 9 to about 16: the 2 new reads, plus the existing summaries (4) and mistakes (1) reads once candidates exist.
- **Round trips stay at 4:** gapSearch (2), candidate batch (1), summaries/mistakes batch (1).
- **Budget (G5-D8): at most 16 statements per gap query.** Reusing the frame rows `gapSearch` already read would save one statement, but needs an internal change to the protected path; this step doesn't make it (no premature optimisation).
- **No caching is needed.** Every read is bounded: at most 4 tails, 3 frames and 29 patterns. Step 8's caching plan is unaffected and can come later.

## 11. Proposed scope for Step 4.5

Three parts, all engine-only, in this order. Precision repairs come first.

### 4.5-1 Precision repairs (G5-D3)

- **R-1 Auxiliaries on the left.**
  - **Rule:** the left-side rule (a collocation starting at the blank) also applies when the learner's word before the blank is a form of _be_ or _have_: `am, was, were, been, being, has, have, had, having`.
  - **Where the list lives:** a new closed list `AUXILIARIES` in `gap/words.ts`, used **only** by the left-side rule. It is not added to `isFunctionWord`, because that would remove "have/has" from the inflection families and the anchors (see "Screen time has a ___ effect").
  - **Verdict:** at most _Likely fits_, `other_side_unchecked`, and the reason names the word.
- **R-2 Content word after the collocation's end.**
  - **Rule:** when a collocation ends on a **content word** after the blank, and the learner's next word after that end is a content word, the verdict is at most _Likely fits_ (`other_side_unchecked`).
  - **Not affected:** a collocation that ends with a function word ("have a negative effect **on** sleep", "take measures **to** reduce") expects what follows.

### 4.5-2 One authored structure for both blanks (OQ-B; G5-D1, G5-D2)

- **New candidate source `jointCandidates(windows, frames, tailPatterns)`.** It runs only when there are exactly two blanks and at least one word between them.
  - **Frame pairs.**
    - **Conditions:** blank 1's protected verb-frame reading has the frame's `fit` = `fits`, so its object is an authored filler. The object is the last word before blank 2. Only Phase 3 `SKIP` words stand between blank 1 and the object.
    - **Candidates:** each of the frame's prepositions (authored order) gives one pair, `head … preposition`.
    - **Complement:** the object pattern's complement when its preposition matches, else the frame's `next`.
  - **Pattern pairs.**
    - **Conditions:** the words between the blanks are exactly a multiword pattern base without its first word. The base's first word isn't a stopword.
    - **Candidates:** one pair per pattern, `first word … preposition`.
    - **Complement:** the pattern's.
- **Retrieval:**
  - `findPatternsByBaseTail(tails)`: tails = the runs of 1–4 words ending right before blank 2, starting right after blank 1 (at most 4).
  - `listGapFrames()`, only when blank 1's verb frame fits.
  - Both run in the existing parallel batch.
- **Response:** additive only.
  - A pair is one `SearchResult` with `fill: { word: head, preposition }` (the existing frame shape) and `gapMatch: { gap: 0, gaps: [0, 1], type: "verb_frame" | "preposition", evidence, verdict, signals }`. `gaps` is a new optional field.
  - Pairs go in **one group placed first**, labelled `Both gaps · <head> … <preposition>` when one structure answers, or `Both gaps` when several do.
  - The key is `${evidence}:gaps:${head}:${preposition}`.
  - `gaps[1].type`, when it was `unknown`, becomes the pair's type.
  - Every existing group (the protected gap-1 groups, gap-2 groups) is unchanged and still shown.

### 4.5-3 "It is ___ that" (OQ-A; G5-D4)

- **Matching:** a collocation whose words, apart from the blank, are all function words may align only when it has at least 3 other words, all matched **as written**. No stemmer, no inflection family, and the 4.4 guards still apply.
- **Verdict:** at most _Likely fits_, with signal `function_words_only`, never _Fits_.
- **Result:** "It is ___ that governments should act" → _crucial_, _essential_ Likely fits.
- **Unchanged:** "a ___ the" (2 other words) and "The ___ is high" stay `none`.

## 12. Explicitly deferred

| Item                                                                              | Why                                                       | Decision |
| --------------------------------------------------------------------------------- | --------------------------------------------------------- | -------- |
| Persons from names, "people" or role nouns                                        | Needs an open-class lexicon; no authored source           | G5-D5    |
| Sentence-final linkers                                                            | 2 linkers, _Depends_ at best, free-text commas            | G5-D6    |
| Pairs through collocation variants ("pose a serious threat ___")                  | The pattern is authored on the item, not its variants     | G5-D7    |
| A `noun_or_person` complement                                                     | Content-model change (vocabulary + Zod, no migration)     | G5-D5    |
| "It's ___ that", "It is ___ to"                                                   | Collocations have no forms; no "it is ___ to" collocation | G5-D4    |
| Reusing `gapSearch`'s frame rows                                                  | An internal change to the protected path; one statement   | G5-D8    |
| Linker relationships; collocation word roles; wider windows; more than two blanks | As in Step 4.4 §8                                         | —        |

## 13. Data and content requirements

**None for Step 4.5.** For the content waves (separate PRs, not this step):

1. **F3:** author the countability mistake ("a … amount of people") for `considerable.large` and `substantial.large`.
2. **Common two-blank frames:** _pay attention to_, _spend money on_, _put pressure on_.
3. **More end-position linkers** (for OQ-D), and a structured comma rule (OQ6).
4. **A `noun_or_person` complement** (content model, OQ-C).

## 14. Engine requirements

- **Verdict code stays pure.** All verdict logic stays in `gap/verdicts.ts` with no database calls; the joint matching is a pure helper in `gap/candidates.ts`.
- **Repository:** `findPatternsByBaseTail(tails: readonly string[]): Promise<PatternHit[]>` in both repositories. Published patterns only, exact suffix match on `base_normalized` (`base_normalized = tail` or ends with `' ' || tail`), ordered by id.
- **The protected `gapSearch` is not modified.** The joint source reads frames itself.
- **Normal search unchanged:** no classifier, normaliser or `rank.ts` change.

## 15. Verdict behaviour

- **Joint pairs follow the 4.3 precedence**, checked in this order:
  1. a mistake recreated by the sentence **with both blanks filled** → _Unlikely_;
  2. frame pairs exist only for authored objects, so _Not supported_ never comes from a pair;
  3. the complement after blank 2 (determiner, -ing, pronoun, clause word → _Fits_; other word → _Likely fits_; nothing → _Depends_);
  4. the left-side rule on blank 1 (function word, or an R-1 auxiliary) → at most _Likely fits_.
- **Signals:** `["joint", "frame_object" | "pattern", <complement code>, …]`.
- **Verdicts:** the same five; no score.
- **R-1, R-2, 4.5-3:** these only lower a verdict to _Likely fits_. Nothing in Step 4.5 raises one.

## 16. Filter behaviour

Unchanged: filters run after verdicts. A pair belongs to its sense and is kept or removed whole. Filters never change the reading, `gaps` or a verdict. Tested for every single filter value.

## 17. Two-blank behaviour

- **Independence holds for independent candidates.** Candidates found for blank 1 and blank 2 on their own are never combined.
- **Pairs are the one exception, and they are not combinations:** each pair is a single authored structure that spans both blanks (G5-D1).
- **Order:** the pair group comes first, then gap-1 groups (protected order), then gap-2 groups.
- **Within the pair group:**
  1. verdict;
  2. frames before patterns;
  3. IELTS relevance;
  4. headword (code point);
  5. evidence id;
  6. authored preposition order.

## 18. Fallback behaviour

Unchanged:

- More than two blanks → ordinary search with `gapNote`.
- An ellipsis blank counts when any analyser answers it, now including a pair.
- No pair and no independent candidate → today's answer.

## 19. Backward compatibility

- The golden suite (71 cases; none has two blanks) and the ranking snapshot (73 blocks) stay byte-for-byte unchanged.
- The six protected verb-frame answers and their pinned wording are unchanged.
- All response changes are optional additions: `gapMatch.gaps` and the `function_words_only` / `joint` signals.

**Existing tests that change on purpose, each to be listed in the PR:**

- The 4.2 test "keeps the verb-frame answer for the first blank and reads the second on its own" gains the pair group in front.
- Tests that pin R-1/R-2 queries, if any; none were found.

## 20. Test requirements

1. **Unit tests:**
   - `jointCandidates`: frames, patterns, uncrossed frames, an object Lexora doesn't author, words between the object and blank 2, both blanks also answered independently (fixture), a stopword head.
   - R-1 and R-2 flags.
   - The 4.5-3 function-word template rule (3 or more other words, as written only).
   - The verdict rules.
2. **Real content:** every row of §21, in memory.
3. **Postgres parity** for every §21 row and under filters.
4. **Filters:** every pair query × every single filter value.
5. **Determinism, golden suite, ranking snapshot, existing 4.1–4.4 suites.**
6. **E2E:** a pair group on Explore; "It was ___ a key role" not _Fits_; "It is ___ that" Likely fits.

## 21. Acceptance criteria

On the published content, in memory and on Postgres:

| #   | Query                                                                                                                    | Expected                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| J1  | Governments should ___ more money ___ public transport                                                                   | Pair group: invest … in, invest … into, allocate … to, allocate … for, all _Likely fits_ (`noun_unchecked`). The gap-1 groups are unchanged |
| J2  | People should ___ more attention ___ environmental problems                                                              | devote … to _Likely fits_                                                                                                                   |
| J3  | Schools should ___ more time ___ the curriculum                                                                          | invest … in, invest … into, allocate … to, allocate … for, devote … to, all _Fits_ (`noun_phrase_follows`)                                  |
| J4  | The council ___ land ___ housing                                                                                         | No pair; outcome `none` (unchanged)                                                                                                         |
| J5  | Teachers ___ a crucial role ___ shaping attitudes                                                                        | play … in _Fits_ (`ing_follows`); the gap-1 group is unchanged                                                                              |
| J6  | Plastic waste ___ a threat ___ marine life                                                                               | pose … to _Likely fits_                                                                                                                     |
| J7  | Schools should ___ awareness ___ the dangers                                                                             | raise … about, raise … of _Fits_                                                                                                            |
| J8  | Governments must ___ measures ___ crime                                                                                  | take … against _Likely fits_                                                                                                                |
| J9  | The policy ___ rise ___ protests                                                                                         | Pair group first: give … to _Likely fits_. The independent gap-2 group (rise sharply… _Likely fits_) is unchanged                           |
| J10 | ___ contrast ___ their parents                                                                                           | No pair (blank 1 would be "in")                                                                                                             |
| J11 | Cars are responsible ___ pollution and depend ___ oil                                                                    | Unchanged: two independent groups, no pair                                                                                                  |
| J12 | Governments should ___ more money each year ___ transport                                                                | No pair                                                                                                                                     |
| R1  | It was ___ a key role · They were ___ a threat · Prices have ___ sharply                                                 | _Likely fits_ (`other_side_unchecked`)                                                                                                      |
| R2  | Teachers play a ___ role models · Schools ___ awareness campaigns                                                        | _Likely fits_ (`other_side_unchecked`)                                                                                                      |
| R3  | Screen time has a ___ effect on sleep · Screens can ___ a negative effect on sleep · There was a ___ increase in cycling | Unchanged (_Fits_)                                                                                                                          |
| A1  | It is ___ that governments should act                                                                                    | crucial, essential _Likely fits_ (`function_words_only`)                                                                                    |
| A2  | a ___ the · The ___ is high · It is ___ to consider the costs                                                            | `none` (unchanged)                                                                                                                          |
| N1  | The six protected verb-frame queries                                                                                     | Unchanged                                                                                                                                   |

**Budget:** at most 16 statements per gap query, measured and reported. Done means every row passes in both repositories, §19 holds, and there is one draft PR into `phase/4-search-depth`.

## 22. Known limitations

- **A plain blank 2 can be read as a preposition slot.** "___ more money ___ the year" would pair as _Fits_ when the learner meant "every". The determiner check can't tell; it's documented and rare.
- **Pairs reach only exact item bases:** "pose a **serious** threat ___" is deferred (G5-D7).
- **Fills are base forms.** Modals and do-forms don't trigger R-1, so "will ___ a threat" stays _Fits_, which is correct.
- **"It's" contractions** are not matched.
- **Common English two-blank frames missing from the content** ("pay attention to") are unanswered until authored.
- **The ±4-word window applies** to the words between the blanks too.

## 23. Decisions

| #     | Decision                                                                 | Evidence                                                                             | Consequences                                                                                             | Not being built                                                             |
| ----- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| G5-D1 | OQ-B: one authored structure may answer both blanks                      | Frame `parts` and multiword pattern bases encode head ▸ middle ▸ preposition (§5.1)  | Gap 2 of 3 frames and 8 patterns becomes answerable; independence still holds for independent candidates | Crossing structures; combining independent candidates; collocation variants |
| G5-D2 | One shared verdict per pair; pair group first; existing groups unchanged | A pair is one structure; a half-verdict would always be _Depends_                    | `gapMatch.gaps` (optional); one intended test change                                                     | Separate per-blank verdicts for pairs                                       |
| G5-D3 | Precision repairs R-1, R-2                                               | Regression findings F1, F2 (§9)                                                      | Some verdicts drop to _Likely fits_; none rise                                                           | A grammar parser; changes to `isFunctionWord`                               |
| G5-D4 | OQ-A: function-word templates, capped at _Likely fits_                   | 2 authored "it is X that" collocations; anchors are function words only              | "It is ___ that" answers, never as _Fits_                                                                | Contractions; "it is ___ to"                                                |
| G5-D5 | OQ-C: deferred                                                           | 2 person patterns; the closed pronoun list is honest; names and roles need a lexicon | No engine change; content-model notes                                                                    | Entity or name recognition; "people" heuristics                             |
| G5-D6 | OQ-D: deferred until content                                             | 2 end-position linkers; free-text commas; _Depends_ at best                          | No engine change                                                                                         | End-slot linker reading                                                     |
| G5-D7 | Pairs only through exact item bases                                      | Patterns are authored on items, not on their collocation variants                    | "pose a serious threat ___" stays independent                                                            | Pattern inheritance by variants                                             |
| G5-D8 | Budget: at most 16 statements, 4 round trips                             | Measured baseline (§10)                                                              | Two new reads in the existing parallel batch                                                             | Caching; protected-path refactor                                            |
| G5-D9 | Order of work: 4.5-1 → 4.5-2 → 4.5-3, one draft PR                       | Precision first                                                                      | —                                                                                                        | —                                                                           |

**Owner decisions needed before implementation:**

- Approve or amend G5-D1–G5-D9. The ones that change the contract are G5-D1/D2 (relaxing independence for single structures) and G5-D4 (OQ-A in scope).
- Whether F3's content fix should go in a content PR now.

## 24. As built in Step 4.5

Implemented on `feat/4-context-gap-extensions`, following §11 in order (G5-D9). Every row of §21 passes in memory and on Postgres. The audit above is unchanged; where the build differs from it, the difference is described here.

- **R-1:** `AUXILIARIES` in `gap/words.ts` (am, is, are, was, were, be, been, being, have, has, had, having) is used only by the left-side rule. "have" and "has" keep anchoring and inflecting ("Screen time has a ___ effect" still fits).
  - _Consequence:_ "There has been ___ debate" is now _Likely fits_ ("been"). This is intended and the test is updated.
- **R-2:** the open-right check now looks at the learner's word right after the collocation's end, wherever that end is. It applies when the collocation ends at the blank, or on a content word after it; the reason names the unchecked word.
- **4.5-2:** `wordsBetween` and `jointCandidates` in `gap/candidates.ts`; `jointVerdict` in `gap/verdicts.ts`; `findPairPatterns(rest)` in both repositories (one bounded statement); `gapMatch.gaps: [0, 1]` on pairs.
  - **Frame-pair condition:** frame pairs are computed directly from the words between the blanks (skip words, then an authored object), not from the protected reading. That reading takes its preposition from past blank 2, and the window rule forbids that. The two conditions agree on every authored object, so frames are read for pairs only when the first blank's verb frame fits.
  - **Mistakes:** they are checked on the sentence with both blanks filled.
- **4.5-3:** a collocation is looked up by its function words only when at least three of them surround the blank. It aligns only as written and is never better than _Likely fits_ (`function_words_only`). "It's ___ that" and "It is ___ to" stay unanswered.

**Deviations, all minor:**

1. When a pair fills a blank that had no independent answer, `gaps[i].type` becomes the pair's kind for **either** blank, not only blank 2. Example: "The policy ___ rise ___ protests" reports `preposition` for blank 1.
2. The pair group is labelled `Both gaps · <head> … <preposition>` when it holds exactly one pair, else `Both gaps`. Example: "raise … of / about" is two pairs, so it is labelled `Both gaps`.
3. Function-word collocations are retrieved through the existing template read, by adding the surrounding function words to the lookup. The audit didn't specify their retrieval.

**Measured** (local Postgres, statements logged by Drizzle):

| Query                                                  | Statements |
| ------------------------------------------------------ | ---------- |
| Governments should ___ more money ___ public transport | 16         |
| Other two-blank queries                                | 15         |
| The council allocated money ___ education              | 15         |
| It is ___ that … · It was ___ a key role               | 14         |
| Protected verb frame                                   | 5          |
| Ordinary search                                        | 7          |

Round trips are unchanged (4), every gap query took ≤ 41 ms, and there is no caching.

**Still deferred:**

- **OQ-C** (persons), **OQ-D** (end-position linkers), collocation-variant pairs, `noun_or_person`, "It's ___ that" and "It is ___ to".
- **F3** ("A ___ amount of people"): content work for a separate content PR.

**New finding while building (recorded, not fixed):**

- **F4:** in "___ a result ___ the new policy", the independent reading of gap 2 (unchanged since Step 4.2) reads the noun "result" as the base of "result in / from", and gives _Fits_.
- **Why it isn't fixed here:** fixing it needs word-role data, so it is deferred. The pair _as … of_ is offered first.
