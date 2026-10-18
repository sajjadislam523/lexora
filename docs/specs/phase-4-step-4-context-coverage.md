# Phase 4 · Step 4.4 — Context coverage: audit and specification

Written: 18 October 2026 · Baseline: `phase/4-search-depth` at `99fdb62` (Steps 0–3 and 4.0–4.3 merged) · Status: **proposal, awaiting owner approval** · Parents: [phase-4-step-4-context-gaps.md](phase-4-step-4-context-gaps.md) (Step 4.0, as built in 4.1–4.3), [phase-4-search-depth.md](phase-4-search-depth.md) §7

This step is an audit and a specification only. Nothing in the engine, schema, content, UI or tests changed while writing it. Decisions are numbered **CC-D1 … CC-D9** so they don't collide with CG-D1 … CG-D18 or the parent register.

---

## 1. Purpose

Step 4.4 widens which context gaps Lexora can answer **from evidence it already has**, and removes the false _Fits_ verdicts the audit found. It adds no verdicts, no content and no schema.

In concrete terms, it:

- reads prepositions after a verb's object ("allocated money \_\_\_ education");
- reads prepositions after inflected multiword bases ("poses a threat \_\_\_ marine life");
- reads a collocation's verb before an article ("Plastic waste \_\_\_ a threat");
- treats inflections the content itself authors as written words ("took", "rose", "plays");
- stops offering a collocation word that repeats or re-inflects the learner's neighbouring word.

## 2. Baseline (verified before writing)

On `99fdb62`, in the documented local Docker Postgres workflow:

| Check                           | Result                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Step 4.3 present                | PR #27 merged (`99fdb62`); `src/language/search/gap/verdicts.ts` in the tree                           |
| Working tree                    | Clean apart from the owner's two untracked snippet files (left untouched)                              |
| `pnpm format:check`             | Passes for every tracked file (it flags only the two untracked snippet files, which CI never sees)     |
| `pnpm lint`, `pnpm typecheck`   | Pass                                                                                                   |
| `pnpm content:check`            | 40 items, 42 senses, 8 intents, 1 source                                                               |
| Schema drift (`db:generate`)    | No schema changes                                                                                      |
| Content import (repeat)         | Nothing to import                                                                                      |
| `CI=true pnpm test`             | 737 / 737 in 40 files                                                                                  |
| Golden suite / ranking snapshot | 71 cases / 73 blocks, byte-for-byte unchanged                                                          |
| `pnpm build`                    | Passes                                                                                                 |
| E2E (`pnpm test:e2e`)           | 179 / 179                                                                                              |
| Statements per gap query        | Verb frame 5; candidates ≤ 14; unreadable gap 9; ordinary lookup 7 (local Postgres, logged by Drizzle) |

## 3. Current state (4.1–4.3)

- **4.1 Gap reader.** Underscores are blanks; an ellipsis is a blank only between words, and only when something answers it. At most two blanks; more → ordinary search with `gapNote: "too_many_gaps"`.
- **4.2 Candidates.** Three bounded reads (patterns, collocation templates, linkers), matched per blank in pure code. The windows are ±4 words and stop at the other blank and at adjacent punctuation.
  - _Prepositions:_ the words before the blank end with a pattern's base and the pattern puts its preposition straight after it; inflections only through item forms that include the preposition ("depends on").
  - _Collocations:_ one word in the blank, never a stopword; every other word aligned (stem match allowed); the collocation word **next to** the blank must be a content word.
  - _Linkers:_ by the learner's punctuation (start + comma, between commas, after a comma) and the authored `positions`/`connects`.
- **4.3 Verdicts.** Fits · Likely fits · Depends · Unlikely · Not supported, by a fixed precedence (authored mistake → not supported → fits → likely fits → depends), with evidence codes in `gapMatch.signals`.
- **Verb frames.** The Phase 3 answer is protected and unchanged; it gains `gapMatch` beside its `fit`.

## 4. Audit findings

### 4.1 Content inventory (published, `99fdb62`)

| Structure            | Count | Notes                                                                                                                                                                                                                                             |
| -------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preposition patterns | 29    | complement: noun 14, noun_or_ing 12, person 2, clause 1. **26 put the preposition straight after the base**. **3 are object patterns** (`allocate + noun + to`, `devote + noun + to`, `invest + money / time + in`), which 4.2 deliberately skips |
| Collocations         | 39    | No word roles. 8 are a verb + article + noun (`play a crucial / key / vital / major / significant role`, `pose a risk`, `pose a serious threat`, `have a negative effect on`)                                                                     |
| Item forms           | 99    | Every multiword verb-phrase item has its inflections (`poses a threat`, `took measures`, `rose sharply`, `has a detrimental effect on`); most **don't include the preposition** of the item's patterns                                            |
| Gap verb frames      | 3     | allocate (to / for), devote (to), invest (in / into); object fillers 7 each; each has an object pattern on the same sense                                                                                                                         |
| Linkers              | 11    | Functions: addition 5, contrast 5, concession 1, example 1, result 1; **no comparison or cause linker**. `punctuation` is free text                                                                                                               |
| Mistakes             | 54    | **Only 4 can ever be recreated by a candidate** (§4.6)                                                                                                                                                                                            |
| Examples             | 103   | 14 linked to a collocation, 47 to a preposition pattern                                                                                                                                                                                           |

### 4.2 Prepositions

The engine reads what follows the blank from closed word lists only (determiners, person pronouns, clause words, an -ing form). Observed on the real content:

| Query                                                     | Today                                                                 | Classification         |
| --------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------- |
| The report focuses \_\_\_ the cost of housing             | _on_ Fits (`noun_phrase_follows`), via the form "focuses"             | Supported              |
| Head teachers are responsible \_\_\_ them                 | _to_ Fits (`person_follows`); _for_ Likely fits                       | Supported              |
| It depends \_\_\_ how much time I have                    | _on_ (vary) Fits (`clause_follows`); _on_ (rely) Likely fits          | Supported              |
| Young people are interested \_\_\_ following careers      | _in_ Fits (`ing_follows`)                                             | Supported              |
| Cars are responsible \_\_\_ pollution                     | _for_ Likely fits (`noun_unchecked`); _to_ Depends (`person_unknown`) | Supported, by design   |
| Cars are responsible \_\_\_ Paris / important \_\_\_ John | as above: a capitalised word is not read as a person                  | Deferred (§7)          |
| Cars are responsible \_\_\_                               | both Depends (`nothing_follows`)                                      | Supported              |
| Lung disease can result \_\_\_ smoking                    | _from_ Fits; _in_ **Unlikely** (authored mistake "result in smoking") | Supported              |
| **Plastic waste poses a threat \_\_\_ marine life**       | **nothing** (outcome `none`)                                          | **Engine gap** → 4.4-2 |
| **Tourism plays a crucial role \_\_\_ the economy**       | **nothing** (but "play a crucial role \_\_\_" answers)                | **Engine gap** → 4.4-2 |
| **The council allocated money \_\_\_ education**          | **nothing**                                                           | **Engine gap** → 4.4-3 |
| **She devoted her life \_\_\_ helping others**            | **nothing**                                                           | **Engine gap** → 4.4-3 |

**Why the engine gaps exist.**

- _Inflected multiword bases:_ 4.2 reaches an inflected base only through an item form that includes the preposition ("depends on", "has a detrimental effect on"). The forms of `pose a threat`, `play a crucial role`, `take measures` and `raise awareness` don't include it. The bare forms ("poses a threat") are authored but never looked up.
- _Prepositions after an object:_ a preposition that follows the verb's object comes only from frames, and Phase 3 frames answer only a blank **in the verb's place**. The object patterns are skipped on purpose, because their preposition doesn't follow the base.

### 4.3 Collocations

| Query                                                           | Today                                                                                                                     | Classification                                                |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| There was a \_\_\_ increase in cycling                          | _significant_, _substantial_ Fits                                                                                         | Supported                                                     |
| The project required a \_\_\_ amount of money                   | _considerable_, _substantial_ Fits                                                                                        | Supported                                                     |
| Public transport plays a \_\_\_ role                            | _crucial_ Fits (item form); _key_, _major_, _vital_, _significant_ Likely fits (`inflected`: "plays" ≈ "play" by stemmer) | Supported; verdict **under-claims** authored evidence → 4.4-5 |
| **Governments must take \_\_\_ measures**                       | _urgent_ Fits — and also **take, takes, taken, taking, took, measures, steps: all Fits**                                  | **False Fits** → 4.4-1                                        |
| **Campaigns to raise \_\_\_ awareness**                         | _public_ Fits — and **raise, raised, raises, raising, awareness: all Fits**                                               | **False Fits** → 4.4-1                                        |
| There is \_\_\_ awareness                                       | _raise, raised, raises, raising_ Fits                                                                                     | Duplicates → 4.4-1; left context unchecked (deferred, §7)     |
| The government took \_\_\_ to reduce crime                      | _measures_ Fits (form "took measures"); **_steps_ missing** ("took" ≠ "take" to the stemmer)                              | **Engine gap** → 4.4-5                                        |
| Prices rose \_\_\_ in 2020                                      | _sharply_ only; **_dramatically_, _steadily_, _gradually_ missing** ("Prices rise \_\_\_" finds all four)                 | **Engine gap** → 4.4-5                                        |
| **Plastic waste \_\_\_ a threat to marine life**                | **nothing** ("a" next to the blank is a stopword)                                                                         | **Engine gap** → 4.4-4                                        |
| **Teachers \_\_\_ a crucial role in shaping attitudes**         | **nothing**                                                                                                               | **Engine gap** → 4.4-4                                        |
| **Screens can \_\_\_ a negative effect on sleep**               | **nothing**                                                                                                               | **Engine gap** → 4.4-4                                        |
| It is \_\_\_ that governments act                               | nothing (no content word among the collocation's words; CG-D5)                                                            | By design; open question OQ-A                                 |
| a \_\_\_ the · The \_\_\_ is high · There was a \_\_\_ decrease | nothing                                                                                                                   | Guards hold                                                   |
| Prices rose, \_\_\_ demand fell                                 | no collocation across the comma (linker only)                                                                             | Supported                                                     |

**Root causes.**

- **Repeated words.** Item-form templates ("takes measures", "raised awareness") offer their inflected first word as a fill. A template whose fill sits at its edge doesn't check the learner's word on its open side. So the blank can be filled with the learner's own neighbouring word ("take **take** measures", "raise awareness **awareness**"), or with an inflection of it ("take **took** measures").
- **One side unchecked.** "take **steps** measures" aligns "take steps" with the left side only. The learner's next word, "measures", is never looked at.
- **Authored inflections ignored.** The content authors "plays a crucial role", "took measures" and "rose sharply", but 4.3 compares words only as written or through the crude stemmer. Irregular forms ("took", "rose", "has") never match, and regular ones ("plays") are treated as unchecked.
- **Only the neighbouring word anchors.** Requiring the collocation word next to the blank to be a content word rules out every verb + article collocation ("pose **a** threat", "play **a** key role", "have **a** negative effect on").

**Limitations that are not engine work:**

- **Data model:** collocations have no word roles (OQ5), so nothing can say "an adjective is needed here" or check what comes before a verb fill.
- **Content:** there are no noun + verb collocations.
- **Not a sense problem:** every collocation stays with its own sense (_significant_ in "a significant increase" is `significant.notable`, never `significant.statistical`), so no change is needed there.

### 4.4 Verb frames

- **Today's frames:** three, all `verb + object + preposition (+ noun)`, used only when the blank is the verb. This is the protected Phase 3 path, and all six golden gap cases are unchanged.
- **Inflection:** heads aren't inflected in the blank (the learner writes the verb's position). Objects match fillers through the stemmer.
- **More structure than the frame reads:** Phase 3 reads one object (the first non-skip word after the blank) and the next preposition, and ignores the rest. A second blank after the object isn't joined to the frame ("Governments should \_\_\_ more money \_\_\_ public transport" answers gap 1 only, gap 2 `unknown`).
- **What's missing, and where it belongs:**
  - _No `to`-infinitive slot_ (OQ4). That's a content-model extension: vocabulary and Zod, no migration.
  - _No frame with an `-ing`, clause or person object._ The slot types exist; frames don't (content).
  - Both belong to the content waves, not 4.4. A frame model the content can't fill would be engine work with nothing to read.
- **Already authored and engine-reachable:** the preposition **after** a frame's object. That is 4.4-3.

### 4.5 Linkers

- **What it does today:** position and punctuation are checked (start + comma, between commas, after a comma), together with `connects`. The verdict is always _Depends_, because which relationship the sentence needs is meaning.
- **No safe deterministic gain from existing data:**
  - `functions` say what a linker expresses, not what the sentence needs.
  - `punctuation` is free text (OQ6).
  - The authored punctuation mistakes ("Prices rose, however demand fell") are already avoided, because `connects: sentences` keeps _however_ out of the after-comma slot.
- **End position** ("…, \_\_\_.") is authored for _however_ and _for instance_, but such gaps are rare and the verdict could only be _Depends_. Deferred (OQ-D).
- **Content, not engine:** comparison and cause have no linker at all; concession, example and result have one each.

### 4.6 Authored mistakes

`recreatedMistake` needs:

- the mistake's wrong words, plus the authored word next to them on each side;
- these must appear contiguously in the learner's words with the candidate in the blank;
- the blank must fall inside the wrong part.

Across the 54 mistakes:

| Wrong part                                                                  | Count | Can a candidate recreate it?                                                             |
| --------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------- |
| One word that is one of the sense's own pattern prepositions                | 2     | **Yes**: _important for me_, _result in smoking_                                         |
| One word that is one of the sense's own collocation words                   | 2     | In theory (_considerable people_; _effect to the_, but "to" is a stopword, never a fill) |
| One word that is never a candidate (_responsible **of**_, _invest **on**_…) | 40    | No: the wrong word is never offered, so the mistake is shown, never used as a verdict    |
| Several words (_for instance_, _further more_, _to note_…)                  | 5     | No: a candidate is one word                                                              |
| Only punctuation differs, or the wrong part is missing                      | 5     | No                                                                                       |

- **No false positives found.** The neighbour rule keeps "important for **young people**" from recreating "important for **me**".
- **Broadening would cause them.** Matching the wrong word without its authored neighbours would flag correct sentences, so it is rejected (CC-D9).
- **4.4 adds no new reconstruction path.** Its new fills (frame prepositions, verbs before an article) never equal a sense's wrong word today. For example, "allocated money **in** education" is a mistake, but _in_ is not a frame preposition of _allocate_. The mistakes linked to the new candidates' patterns are shown with the answer, as in 4.2.

## 5. Coverage matrix

Phases: **done** = 4.1–4.3; **4.4** = this step; **content** = editorial content PRs (Wave 2); **deferred** = needs a decision or a later phase.

| Context type                                                  | Current support                                      | Evidence available                                             | Current verdict behaviour                     | Safe improvement?                                   | Requires content?                       | Requires schema?                       | Proposed phase  |
| ------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------- | --------------------------------------- | -------------------------------------- | --------------- |
| Preposition + determiner + noun                               | Yes                                                  | Pattern complement; determiner list                            | Fits                                          | —                                                   | No                                      | No                                     | done            |
| Preposition + person pronoun                                  | Yes (2 person patterns)                              | Complement `person`; closed pronoun list                       | Fits                                          | —                                                   | No                                      | No                                     | done            |
| Preposition + clause                                          | Yes (1 clause pattern)                               | Complement `clause`; clause words                              | Fits / Depends                                | —                                                   | More clause patterns help               | No                                     | done            |
| Preposition + -ing                                            | Yes                                                  | Complement `ing`/`noun_or_ing`                                 | Fits                                          | —                                                   | No                                      | No                                     | done            |
| Preposition + proper noun / person name                       | Not distinguished                                    | None (a capital letter isn't evidence of a person)             | `person`: Depends; `noun`: Likely fits        | **No**: false Fits ("important to London")          | —                                       | —                                      | deferred        |
| Preposition + plain noun                                      | Partly                                               | Complement only; no part-of-speech data                        | Likely fits (`noun_unchecked`)                | **No**: an example match is coincidental (§8)       | A lexicon would be new data             | Yes, for a lexicon                     | deferred        |
| Preposition + adjective / noun phrase                         | As plain noun                                        | As above                                                       | Likely fits                                   | No                                                  | —                                       | —                                      | deferred        |
| Preposition after an inflected multiword base                 | **No**                                               | Item forms without the preposition + pattern base              | none                                          | **Yes** (4.4-2)                                     | No                                      | No                                     | **4.4**         |
| Preposition after a verb's object                             | **No**                                               | Frames (head, fillers, prepositions) + object patterns + forms | none                                          | **Yes** (4.4-3)                                     | No (Wave 2 frames widen it)             | No                                     | **4.4**         |
| Collocation, exact word                                       | Yes, with **false Fits** from repeats and form fills | Templates                                                      | Fits (incl. false ones)                       | **Yes**: guards (4.4-1)                             | No                                      | No                                     | **4.4**         |
| Collocation, inflected word                                   | Stemmer only                                         | Templates + authored first-word inflections in item forms      | Likely fits; irregular forms missed           | **Yes** (4.4-5)                                     | No                                      | No                                     | **4.4**         |
| Collocation, multiple content words                           | Yes                                                  | Full alignment, ±4 words                                       | Fits / Likely fits                            | —                                                   | No                                      | No                                     | done            |
| Collocation, blank not next to a content word                 | **No**                                               | Templates with a content word further along                    | none                                          | **Yes**, with a content word still required (4.4-4) | No                                      | No                                     | **4.4**         |
| Collocation, only function words around ("It is \_\_\_ that") | No (CG-D5)                                           | "it is crucial / essential that"                               | none                                          | Possible, but it relaxes CG-D5                      | No                                      | No                                     | deferred (OQ-A) |
| Collocation word roles (adjective / noun / verb)              | No                                                   | None                                                           | —                                             | No                                                  | Yes                                     | Content model (OQ5)                    | deferred        |
| Noun + verb collocation                                       | No content                                           | None                                                           | —                                             | Template-ready                                      | **Yes**                                 | No                                     | content         |
| Verb + object (blank = verb)                                  | Yes (protected)                                      | 3 frames                                                       | Fits / Likely fits / Unlikely / Not supported | — (protected)                                       | More frames                             | No                                     | done            |
| Verb + object + preposition (blank = verb)                    | Yes (protected)                                      | Frame prepositions                                             | As above                                      | — (protected)                                       | No                                      | No                                     | done            |
| Verb + `to`-infinitive                                        | No                                                   | No slot type                                                   | —                                             | No                                                  | **Yes**                                 | Content model only (OQ4, no migration) | content         |
| Verb + -ing / that-clause / person                            | No frames                                            | Slot types exist                                               | —                                             | No                                                  | **Yes**                                 | No                                     | content         |
| Linker at sentence start                                      | Yes                                                  | `positions`, `connects`, comma                                 | Depends                                       | —                                                   | No                                      | No                                     | done            |
| Linker after a comma / between commas                         | Yes                                                  | As above                                                       | Depends                                       | —                                                   | No                                      | No                                     | done            |
| Linker at the end ("…, \_\_\_.")                              | No                                                   | `positions: end` (2 linkers)                                   | none                                          | Yes, but low value; Depends at best                 | No                                      | No                                     | deferred (OQ-D) |
| Linker relationship / function                                | No                                                   | `functions` per linker, not per sentence                       | Depends                                       | **No** (meaning)                                    | Comparison and cause linkers            | Structured punctuation (OQ6)           | deferred        |
| One blank                                                     | Yes                                                  | —                                                              | —                                             | —                                                   | —                                       | —                                      | done            |
| Two independent blanks                                        | Yes                                                  | Per-window evidence                                            | Per blank                                     | —                                                   | —                                       | —                                      | done            |
| Two blanks of one structure (frame head + preposition)        | No (by the independence invariant)                   | Frames cover both                                              | Gap 2 `unknown`                               | Needs the invariant relaxed                         | No                                      | No                                     | deferred (OQ-B) |
| Authored mistake reconstruction                               | Yes (4 of 54 reachable)                              | Mistakes + neighbour rule                                      | Unlikely                                      | **No broadening** (CC-D9)                           | Mistakes with prepositional wrong parts | No                                     | done            |
| Punctuation boundaries                                        | Yes                                                  | Raw query                                                      | Windows stop at `, ; : . ? !`                 | —                                                   | —                                       | —                                      | done            |
| Unknown / unreadable context                                  | Yes                                                  | —                                                              | Outcome `none`, gap type `unknown`            | —                                                   | Content widens it                       | —                                      | done            |

## 6. Approved improvements (proposed for approval)

Five changes, all **engine-only**: no content, no schema, no new verdict, no new response field. Implement them in this order, because each later change relies on 4.4-1's guards.

Terms: the **window** is 4.2's (`before[0]` is the word right before the blank). **Function words** are `STOPWORDS` ∪ the gap `PREPOSITIONS` ∪ `DETERMINERS` (three closed lists already in the code). A **content word** is any other word.

### 4.4-1 Collocation guards (CC-D2)

- **Behaviour.** Three rules, applied in `collocationCandidates`:
  - **G1 — no repeat.** A fill is dropped when it equals the learner's word directly before or after the blank, or shares its stem, or both are first words of one authored inflection family (4.4-5).
  - **G2 — form templates offer only base words.** An item-form template ("takes measures") may offer a fill only at a position where its word equals the same position of the item's **base form** (its normalised headword, "take measures"). Its inflected first word ("takes") is used only to align the learner's words, never as a fill.
  - **G3 — open right side.** When the fill is the template's **last** word and the learner's next word is a **content word**, the template has checked one side only. The verdict is at most _Likely fits_, with the signal `other_side_unchecked` added after `collocation`.
- **Why.** These are false _Fits_ in today's output: "take ___ measures" offers _take_, _takes_, _took_, _measures_ and _steps_ as fits.
- **Evidence.** None new: G1 compares the learner's own words; G2 uses the item's headword (already in the content); G3 uses the window.
- **Expected impact:**
  - "Governments must take ___ measures" → _urgent_ Fits, _steps_ Likely fits (`collocation, other_side_unchecked`); nothing else.
  - "Campaigns to raise ___ awareness" → _public_ Fits only.
  - "There is ___ awareness" → _raise_ Fits only, instead of four forms.
  - Every query in the current gap tests keeps its candidates and verdicts.
- **False-positive protection.** It removes candidates and lowers verdicts; it never adds or raises one. G3 doesn't look at the left side, because a subject before a verb ("Teachers ___ a key role") is normal. The residual left-side risk is in §7.
- **Tests.** Unit tests for G1–G3 on fixtures. Real-content cases for the three queries above. Verify "take ___ to reduce crime" (_measures_, _steps_ Fits; next word "to" is a function word) and "Prices rose ___ in 2020" unchanged.

### 4.4-2 Inflected multiword pattern bases (CC-D3)

- **Behaviour.** The bare base runs before the blank ("poses a threat", "plays a crucial role") are also looked up as item forms (passed in `findGapPatterns(bases, forms)`'s `forms`). A pattern reached through such a form counts when:
  - the form and the pattern's base have the same number of words and differ **only in the first word** (the inflected head);
  - the pattern puts its preposition straight after the base (as 4.2).

  Everything else follows 4.2 and 4.3: the label is "Prepositions after “<pattern base>”", the verdict comes from what follows, and the pattern's linked mistake is shown.

- **Why.** "play a crucial role ___" answers, but "plays a crucial role ___" doesn't. This affects every verb-phrase item whose forms lack the preposition (pose a threat, play a crucial role, take measures, raise awareness).
- **Evidence.** Item forms (authored) and pattern bases.
- **Deterministic rule.** Exact string lookup of the base runs (at most 4 per blank, ≤ 8 strings). The first-word-only condition stops forms that differ elsewhere ("depend on/upon", "growing concern about/that") from standing in for a base.
- **Expected impact:**
  - "Plastic waste poses a threat ___ marine life" → _to_ Likely fits; mistake "pose a threat for wildlife" shown.
  - "Tourism plays a crucial role ___ the economy" → _in_ Fits; mistake shown.
  - "Public transport plays a crucial role ___ reducing congestion" → _in_ Fits.
  - "The government takes measures ___ crime" → _against_ Likely fits.
  - "Schools raised awareness ___ the dangers" → _of_, _about_ Fits.
- **False-positive protection.** The base must be authored as a form of the pattern's own item. The preposition rule and verdicts are unchanged.
- **Tests.** The five queries above (memory and Postgres). A fixture with a form that differs in a later word is not used. Existing preposition tests are unchanged.

### 4.4-3 Prepositions after a verb frame's object (CC-D4)

- **Behaviour.** A new candidate source, `framePrepositionCandidates(window, patterns, frames)`, for a blank **after** the object of a frame's verb:
  1. **Trigger:** an object pattern (its preposition doesn't directly follow its base) whose base equals a gap frame's head on the same sense. The pattern is reached by base ("allocate") or by a bare form ("allocated"). For that, the caller also passes `before[1…3]` as single words in both `bases` and `forms` (≤ 3 more exact strings per blank). `prepositionCandidates` keeps matching only its own base runs, so these extra rows never become ordinary preposition candidates.
  2. **Position:** the matched head is `before[j]` with 1 ≤ j ≤ 3. Every word in `before[1…j-1]` is in Phase 3's object `SKIP` list ("more", "her", "a lot of"…). `before[0]` is the **object**; it must not be a skip word or a preposition.
  3. **Candidates:** the frame's prepositions in authored order (main, then `also`): _to_ / _for_ for allocate, _in_ / _into_ for invest, _to_ for devote. Each one has:
     - type `preposition`;
     - evidence = the frame's id and display, and the object pattern's `mistakeId` when its preposition is this candidate;
     - complement = the object pattern's complement when its preposition is this candidate, else the frame's slot after the preposition (`noun`);
     - span = j + 1.
  4. **Verdict** (4.3 precedence, unchanged):
     - a recreated mistake of the sense → _Unlikely_;
     - the object isn't an authored filler (the stemmed comparison `frameFit` uses) → _Not supported_ (`frame_object_not_authored`);
     - otherwise the complement rule on `after[0]`, with signals `["frame_object", <complement code>]`: Fits, Likely fits or Depends.
  5. **Label:** "Prepositions after “<head as written> <object>”" ("Prepositions after “allocated money”"). Ties keep the authored order.
- **Why.** "Allocate/invest/devote something **to/in**" is a core IELTS structure. The frames already author it, yet "allocated money ___ education" returns nothing.
- **Evidence.** Frames (head, fillers, prepositions), object patterns (complement, linked mistake), item forms (head inflections).
- **Expected impact:**
  - "The council allocated money ___ education" → _to_, _for_ Likely fits (`noun_unchecked`); mistake "allocated money in education" shown.
  - "Governments should invest more money ___ public transport" → _in_, _into_ Likely fits.
  - "She devoted her life ___ helping others" → _to_ Fits (`ing_follows`).
  - "The council allocated land ___ housing" → _to_, _for_ Not supported.
  - "The council allocated money ___" → _to_, _for_ Depends (`nothing_follows`).
- **False-positive protection:**
  - Only authored frame prepositions are offered.
  - An unauthored object never gets better than _Not supported_.
  - The head must be an authored form.
  - The window stops at the other blank, so a frame head in another blank is never used. That keeps two-blank reading independent; joint reading stays deferred (OQ-B).
- **Protected path.** The Phase 3 `gapSearch` is not modified. Frames are read again with the existing `listGapFrames()`, and **only when an object pattern was hit**. When a frame fits the first blank, 4.2's rule (skip window 0) still applies.
- **Tests:**
  - the five queries above, memory and Postgres;
  - the six protected cases and their pinned wording unchanged;
  - "Governments should ___ more money ___ public transport" keeps gap 2 `unknown`;
  - filters × these queries, as in 4.2.

### 4.4-4 Collocations anchored beyond the next word (CC-D5)

- **Behaviour.** The collocation word next to the fill no longer has to be a content word. Instead, **at least one of the collocation's other words must be a content word** (all of them are still aligned with the learner's words, as in 4.2). The template read takes **every content word in the windows** (≤ 4 each side, ≤ 16 for two blanks) instead of only the two next to the blank.
- **Why.** Every verb + article collocation is unreachable today ("Plastic waste ___ a threat", "Teachers ___ a key role", "Screens can ___ a negative effect on sleep").
- **Evidence.** Authored collocations and item forms.
- **Expected impact:**
  - "Plastic waste ___ a threat to marine life" → _pose_ Fits.
  - "Rising sea levels ___ a serious threat to coastal cities" → _pose_ Fits.
  - "Teachers ___ a crucial role in shaping attitudes" → _play_ Fits (the item).
  - "Teachers ___ a key role" → _play_ Fits.
  - "Screens can ___ a negative effect on sleep" → _have_ Fits.
- **False-positive protection:**
  - The CG-D5 guard still holds, because a content word is still required: "a ___ the", "It is ___ that…", "The ___ is high" and "There was a ___ decrease" stay `none`.
  - Article and determiner words must match exactly ("a" ≠ "the").
  - G1–G3 apply.
  - The verdict rules are unchanged.
- **Tests.** The queries above. The four guard queries stay `none`. Every query in the current gap tests keeps its candidates, unless 4.4-1 removed a false one.

### 4.4-5 Authored first-word inflections (CC-D6)

- **Behaviour:**
  - **Inflection families.** Two forms of one item with the same number of words that differ **only in the first word** make those first words one **inflection family**, for example {take, takes, took, taken, taking}. Single-word items' forms make a family too.
  - **Guard.** A family whose words include a function word is ignored ("in contrast" / "by contrast" would make {in, by}).
  - **Matching.** A template's **first** word matches the learner's word when both are in one family. Only the first word: "a sharp **rise**" never matches "rose".
  - **Verdict.** Such a match counts **as written**: _Fits_, with `authored_form` added to the signals. A match only through the stemmer stays _Likely fits_ (`inflected`), as in 4.3.
- **Why:**
  - Irregular forms the content authors never match today: "took ___ to reduce crime" misses _steps_; "Prices rose ___" misses three collocations.
  - Regular ones are called unchecked even though the content authors them: "plays a key role".
- **Evidence.** Item forms only.
- **Retrieval.** `findCollocationTemplates(words)` also returns:
  - the templates whose first word is in a family of any of the words;
  - the families it used (return type `{ templates, variants }`).

  This all happens **in the same single statement** (a CTE in Postgres; the same filter in memory).

- **Expected impact:**
  - "The government took ___ to reduce crime" → _measures_, _steps_ Fits.
  - "Prices rose ___ in 2020" → _sharply_, _dramatically_, _gradually_, _steadily_ Fits.
  - "Public transport plays a ___ role" → _crucial_, _key_, _major_, _vital_, _significant_ all Fits (`authored_form` on the last four).
  - "Screen time has a ___ effect on sleep" → _detrimental_, _negative_ Fits.
- **False-positive protection.** This is the one change that **raises** verdicts (Likely fits → Fits), so it carries three limits:
  - only words the content authors as one item's first-word variants;
  - only at a template's first position;
  - function-word families are excluded.

  It doesn't apply to stem-only matches.

- **Tests:**
  - families built from fixtures, including excluded later-word and function-word variants;
  - the queries above;
  - a stem-only match that stays _Likely fits_;
  - memory/Postgres equality.

  The 4.3 test "likely fits when a word matched only through an inflection" changes **intentionally**: its query ("plays a ___ role") becomes all _Fits_, and the test moves to a stem-only case.

### 6.6 Contract changes (all internal or additive)

| Where                          | Change                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `CollocationTemplate`          | `base?: string`: the item's base form, on item-form templates (G2)                                    |
| `findCollocationTemplates`     | Returns `{ templates, variants }`; the caller passes every content word in the windows                |
| `findGapPatterns`              | Signature unchanged; the caller also passes the bare base runs (4.4-2) and `before[1…3]` (4.4-3)      |
| `gap/candidates.ts`            | `framePrepositionCandidates`; G1–G3; the anchor rule; inflection families                             |
| `gap/verdicts.ts`              | Frame-object complement verdict (reuses `complementVerdict`); `other_side_unchecked`; `authored_form` |
| `SearchResult.gapMatch`        | Unchanged shape. New signal codes: `frame_object`, `other_side_unchecked`, `authored_form`            |
| `SearchResponse`, URL, API, UI | Unchanged                                                                                             |

## 7. Explicit non-goals

- No AI, LLM, embeddings or external semantic service.
- No semantic sentence understanding: linkers stay _Depends_.
- No numeric score or confidence, and no sixth verdict.
- No change to the 4.3 precedence or to any verdict's meaning. G3 applies the existing "one part can't be checked → Likely fits" rule.
- No gapless sentence checker (parent D18 still proposed; nothing in this audit justifies it).
- No broad grammar parser or part-of-speech tagger.
- No collocation-role system (OQ5).
- No automatic or generated content.
- No UI change: Step 4.6 owns it.
- No change to ordinary search, `rank.ts`, filters, the gap reader (4.1) or the Phase 3 `gapSearch`.
- No joint two-blank reading: candidates are never combined across blanks (OQ-B).

**Residual risks 4.4 does not remove (documented, not hidden).** A collocation fill's **left** side is never checked. So "There is ___ awareness" offers _raise_ (Fits), and after 4.4-4, "There is ___ a threat" would offer _pose_ (Fits). Fixing this needs word roles or part-of-speech data (OQ5), and the copy rules call it a pattern fit, not a grammar check. The same limit exists today for adjacent anchors.

## 8. Deferred, with reasons

| Item                                                    | Why deferred                                                                                                                                                                                                     | Belongs to                     |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Proper nouns or "people" as persons                     | No authored evidence; false Fits for places and organisations                                                                                                                                                    | Owner decision (OQ-C)          |
| Plain noun → Fits through examples                      | 47 examples are linked to patterns, but a match only means the learner reused an example's next word ("for **air** pollution" would fit, "for pollution" would not): different verdicts for equivalent sentences | Not planned                    |
| "It is ___ that" (only function words around the blank) | Relaxes CG-D5                                                                                                                                                                                                    | Owner decision (OQ-A)          |
| Joint reading of two blanks (frame head + preposition)  | Conflicts with the independence invariant as stated                                                                                                                                                              | Owner decision (OQ-B; old 4.5) |
| Linker end position                                     | Rare; Depends at best                                                                                                                                                                                            | OQ-D                           |
| Linker relationship                                     | Meaning, not structure                                                                                                                                                                                           | Not planned                    |
| `to`-infinitive, -ing, clause and person frames         | No content (infinitive also needs OQ4's content-model change)                                                                                                                                                    | Content waves                  |
| Collocation word roles, left-side checks                | Data model (OQ5)                                                                                                                                                                                                 | Later phase                    |
| Wider mistake matching                                  | Would flag correct sentences (CC-D9)                                                                                                                                                                             | Never, as designed             |

## 9. Content requirements

**None for 4.4.** Content work that widens what 4.4's rules reach, for the content waves (not this step):

- Verb frames for Wave 2 verbs, each with an object pattern on the same sense (that's what 4.4-3 triggers on), plus an OQ4 decision for infinitive frames.
- Inflected forms for every multiword verb-phrase item (all present today; keep it a content-check expectation).
- Comparison and cause linkers; more concession, example and result linkers.
- Noun + verb collocations.
- Preposition mistakes whose wrong word is one of the sense's own pattern prepositions, so they can serve as negative evidence (today 2 of 54).

## 10. Schema requirements

**No migration.** Every read uses existing tables and columns (`item_forms`, `collocations`, `preposition_patterns`, `frames`, `language_items`). No content-model change either.

## 11. Performance budget

Measured on `99fdb62` (local Postgres, statements logged by Drizzle):

| Query kind                     | 4.3  | 4.4 budget | Why                                                                                                |
| ------------------------------ | ---- | ---------- | -------------------------------------------------------------------------------------------------- |
| Protected verb frame           | 5    | **5**      | Path untouched                                                                                     |
| Candidates found               | ≤ 14 | **≤ 15**   | +1 `listGapFrames()` only when an object pattern is hit (4.4-3); everything else in existing reads |
| No candidates (unreadable gap) | 9    | **9**      | The same three parallel reads                                                                      |
| Ordinary search                | 7    | **7**      | Not touched                                                                                        |

- **Bounded inputs:**
  - the pattern lookup grows by ≤ 7 exact strings per blank (4 base runs, 3 head words);
  - the template read takes ≤ 16 words (each word and its stem prefix);
  - the inflection-family expansion runs inside the same statement and is bounded by the forms of the items the words reach.
- **Bounded output:** ≤ 20 candidates per blank and type (unchanged); no cross product.
- **Speed:** each candidate query must stay within 2× its 4.3 time locally (4.3: 15–30 ms).

## 12. Regression requirements

1. **Golden suite** (`test/search-golden.yaml`, 71 cases) byte-for-byte unchanged.
2. **Ranking snapshot** (`test/search-snapshot.txt`, 73 blocks) byte-for-byte unchanged.
3. **Ordinary search** unchanged: every non-gap golden case, and the classifier untouched.
4. **Gap reading** (4.1) unchanged: `planGaps`, `gapWindows`, `gapNote`.
5. **Protected verb frames:** the six cases, the pinned wording "Verbs for the gap, checked against “money” and “into”", `fit` and `gapMatch` all unchanged.
6. **Existing gap tests** pass unchanged, except these intentional changes, each listed in the PR:
   - 4.4-5: "plays a ___ role" verdicts become Fits;
   - 4.4-1: removing false candidates where a test happened to include them (none found today).
7. **Memory/Postgres parity:** identical gap answers on the real content for every new query, in the Step 4.2/4.3 integration style.
8. **Filters:** for every new query × every single filter, the reading, gaps and verdicts are identical and the results are a subsequence.
9. **Multiple gaps:** each blank is judged on its own; a two-blank query's groups are a function of each window alone (test: removing either blank's words leaves the other blank's group identical).
10. **Determinism:** the same response on repeated calls.
11. **Full verification:**
    - `pnpm format:check && pnpm lint && pnpm typecheck && pnpm content:check`;
    - the drift check;
    - `CI=true pnpm test` and `pnpm build`;
    - e2e with `EMAIL_TRANSPORT=outbox`.

## 13. Acceptance criteria

On the published content, in memory **and** Postgres:

| #   | Query                                                                                   | Expected groups and verdicts                                                                                                                            |
| --- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Governments must take ___ measures                                                      | _urgent_ Fits; _steps_ Likely fits (`collocation`, `other_side_unchecked`); no other candidate                                                          |
| A2  | Campaigns to raise ___ awareness                                                        | _public_ Fits only                                                                                                                                      |
| A3  | There is ___ awareness                                                                  | _raise_ only                                                                                                                                            |
| B1  | Plastic waste poses a threat ___ marine life                                            | "Prepositions after “pose a threat”": _to_ Likely fits; mistake "pose a threat for wildlife"                                                            |
| B2  | Tourism plays a crucial role ___ the economy                                            | _in_ Fits; mistake "Tourism plays a crucial role for the economy."                                                                                      |
| B3  | Schools raised awareness ___ the dangers                                                | _of_, _about_ Fits                                                                                                                                      |
| C1  | The council allocated money ___ education                                               | "Prepositions after “allocated money”": _to_, _for_ Likely fits (`frame_object`, `noun_unchecked`); mistake "The council allocated money in education." |
| C2  | Governments should invest more money ___ public transport                               | _in_, _into_ Likely fits                                                                                                                                |
| C3  | She devoted her life ___ helping others                                                 | _to_ Fits (`frame_object`, `ing_follows`)                                                                                                               |
| C4  | The council allocated land ___ housing                                                  | _to_, _for_ Not supported (`frame_object_not_authored`)                                                                                                 |
| C5  | The council allocated money ___                                                         | _to_, _for_ Depends (`frame_object`, `nothing_follows`)                                                                                                 |
| D1  | Plastic waste ___ a threat to marine life                                               | _pose_ Fits                                                                                                                                             |
| D2  | Teachers ___ a crucial role in shaping attitudes                                        | _play_ (`play-a-crucial-role.main`) Fits                                                                                                                |
| D3  | Screens can ___ a negative effect on sleep                                              | _have_ Fits                                                                                                                                             |
| E1  | The government took ___ to reduce crime                                                 | _measures_, _steps_ Fits                                                                                                                                |
| E2  | Prices rose ___ in 2020                                                                 | _sharply_, _dramatically_, _gradually_, _steadily_ Fits                                                                                                 |
| E3  | Public transport plays a ___ role                                                       | All five Fits; `authored_form` on _key_, _major_, _vital_, _significant_                                                                                |
| N1  | a ___ the · It is ___ that governments act · The ___ is high · There was a ___ decrease | Outcome `none` (unchanged)                                                                                                                              |
| N2  | The six protected verb-frame queries                                                    | Unchanged (golden + snapshot)                                                                                                                           |
| N3  | Governments should ___ more money ___ public transport                                  | Unchanged: gap 1 verb frame, gap 2 `unknown`                                                                                                            |
| N4  | Lung disease can result ___ smoking · My family is very important ___ me                | Unchanged (_in_ / _for_ Unlikely from authored mistakes)                                                                                                |
| N5  | Every 4.2/4.3 linker query                                                              | Unchanged (all Depends)                                                                                                                                 |

Order within a group follows 4.3: verdict, then span, relevance, headword and evidence id, then authored preposition order for frame candidates.

**Done means:**

- every row above passes in both repositories;
- §12 holds;
- the statement budget in §11 is measured and reported;
- ARCHITECTURE gets a decision-log entry and the Step 4 spec an "As built in Step 4.4" note;
- one draft PR into `phase/4-search-depth`.

## 14. Decisions

| #     | Decision                          | Recommendation                                                                                           | Status   |
| ----- | --------------------------------- | -------------------------------------------------------------------------------------------------------- | -------- |
| CC-D1 | What 4.4 is                       | Engine-only coverage from existing evidence: 4.4-1 … 4.4-5; no content, schema, verdicts or UI           | Proposed |
| CC-D2 | Collocation guards                | G1 no repeat, G2 base words only from form templates, G3 open right side → at most Likely fits           | Proposed |
| CC-D3 | Inflected multiword bases         | Bare base runs looked up as forms; first-word-only difference                                            | Proposed |
| CC-D4 | Prepositions after a frame object | Frame prepositions as `preposition` candidates; unauthored object → Not supported; `gapSearch` untouched | Proposed |
| CC-D5 | Collocation anchor                | Any content word among the collocation's other words, not only the next one                              | Proposed |
| CC-D6 | Authored first-word inflections   | Same-item, first-word-only, no function words → counts as written (Fits, `authored_form`)                | Proposed |
| CC-D7 | Budget                            | ≤ 15 statements per gap query (+1 only for frame-object hits); no unbounded read                         | Proposed |
| CC-D8 | Order of work                     | 4.4-1 → 4.4-2 → 4.4-3 → 4.4-4 → 4.4-5, one draft PR                                                      | Proposed |
| CC-D9 | Mistake matching                  | Unchanged neighbour rule; no broadening                                                                  | Proposed |

**Open questions** (not part of 4.4 unless the owner decides otherwise):

| #    | Question                                                                  | Recommendation                                                |
| ---- | ------------------------------------------------------------------------- | ------------------------------------------------------------- |
| OQ-A | Answer collocations surrounded only by function words ("It is ___ that")? | Not now; revisit with Step 7's unmatched-query data           |
| OQ-B | Join two blanks that one frame covers (head + preposition)?               | Decide before Step 4.5; it relaxes the independence invariant |
| OQ-C | Read "people" or capitalised names as persons?                            | No: no authored evidence                                      |
| OQ-D | Read the linker end position?                                             | Not now                                                       |
