# Search regression baseline — Phase 4 Step 1 — 17 October 2026

> A dated record of the search behaviour pinned before Phase 4 changes it ([specification](../specs/phase-4-search-depth.md) §11 and §15, Step 1). It is a snapshot, not a living document. The suite itself is `test/search-golden.yaml`; the ranking snapshot is `test/search-snapshot.txt`.

## 1. What Step 1 adds

| Piece                   | Where                                                                  | Runs against                        |
| ----------------------- | ---------------------------------------------------------------------- | ----------------------------------- |
| Golden suite, 23 → 71   | `test/search-golden.yaml`                                              | in-memory repository and PostgreSQL |
| Ranking snapshot        | `test/search-snapshot.txt`, built by `rankingSnapshot()`               | both, one shared file               |
| False-mistake-claim fix | `showsMistake()` in `src/language/search/match.ts`, used by the lookup | both (the rule is in the service)   |
| Fallback re-check       | `test/search-golden.integration.test.ts`                               | PostgreSQL only (see §5)            |

No ranking, classification, typo, relation, intent or gap logic changed. No content, schema, migration or environment changed.

## 2. The 23 protected Phase 3 cases

Unchanged byte for byte; all pass on both repositories.

| #   | Query                                                             | Intent                | Expectation                                                                                   | `only` | Why it exists                                              |
| --- | ----------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------- |
| 1   | better word for important                                         | SYNONYM               | top significant, crucial, essential, fundamental; never considerable/substantial; fit guide   | —      | Agreed scenario: meaning-first synonyms, no thesaurus dump |
| 2   | stronger word for important                                       | STRONGER_ALTERNATIVE  | crucial, essential                                                                            | ✓      | Agreed scenario: strength relations                        |
| 3   | preposition after responsible                                     | PREPOSITION           | responsible for, responsible to; mistake _responsible of_                                     | ✓      | Agreed scenario: patterns plus the known mistake           |
| 4   | responsable for                                                   | LOOKUP                | typo → _responsible for_; top responsible for                                                 | —      | Agreed scenario: visible typo correction                   |
| 5   | collocations with significant                                     | COLLOCATION           | top a significant increase, impact, difference, play a significant role (authored order)      | —      | Agreed scenario: collocations in authored order            |
| 6   | alternative to however                                            | ALTERNATIVE           | includes on the other hand, whereas, nevertheless; never however; fit guide                   | —      | Agreed scenario: alternatives exclude the term             |
| 7   | better linker for contrast                                        | LINKER                | groups Between sentences / Within one sentence / Conceding a point                            | —      | Agreed scenario: intent groups                             |
| 8   | natural speaking alternative to furthermore                       | ALTERNATIVE           | on top of that, what's more                                                                   | ✓      | Agreed scenario: modifiers filter by skill and register    |
| 9   | I want to say something increased a lot                           | CONTEXTUAL_EXPRESSION | includes rise sharply, significant, considerable                                              | —      | Agreed scenario: idea → intent                             |
| 10  | I want to say this caused a serious problem                       | CONTEXTUAL_EXPRESSION | includes pose a threat, have a detrimental effect on, give rise to, result in                 | —      | Agreed scenario: idea → intent                             |
| 11  | Governments should \_\_\_\_ more money into public transportation | CONTEXT_GAP           | top invest, allocate; invest fits, allocate different preposition, devote unlikely; fit guide | —      | Agreed scenario: verb-frame gap with preposition check     |
| 12  | analyze                                                           | LOOKUP                | variant → _analyse_                                                                           | —      | Agreed scenario: US spelling is a variant, not an error    |
| 13  | signifcant                                                        | LOOKUP                | typo → _significant_                                                                          | —      | Typo correction                                            |
| 14  | furthermoe                                                        | LOOKUP                | typo → _furthermore_                                                                          | —      | Typo correction                                            |
| 15  | important                                                         | LOOKUP                | exact; groups Similar meaning / Stronger / Alternatives; never considerable; fit guide        | —      | Owner scenario: a word with its related language           |
| 16  | I want to express contrast                                        | CONTEXTUAL_EXPRESSION | includes however, whereas, on the other hand                                                  | —      | Owner scenario                                             |
| 17  | responsible of                                                    | LOOKUP                | responsible for; mistake _responsible of_                                                     | ✓      | Pinned: a mistake is explained, never silently fixed       |
| 18  | Governments should \_\_\_ more money to public transport          | CONTEXT_GAP           | allocate fits, invest different preposition, devote unlikely                                  | —      | Pinned: the preposition changes the verdict                |
| 19  | phrase for giving an example                                      | PHRASE                | for instance, such as, a case in point                                                        | ✓      | Pinned: phrase questions                                   |
| 20  | preposition after depend                                          | PREPOSITION           | top depend on; mistake _Many families depend of one income._                                  | —      | Pinned: sentence-length mistakes                           |
| 21  | rose sharply                                                      | LOOKUP                | exact → _rise sharply_ (inflection)                                                           | —      | Pinned: inflected collocation                              |
| 22  | focussed on                                                       | LOOKUP                | variant → _focus on_                                                                          | —      | Pinned: variant of an inflection                           |
| 23  | xyzzy                                                             | LOOKUP                | outcome none                                                                                  | —      | Pinned: honest no-match                                    |

## 3. The 48 new cases

Each has a one-line reason in the YAML. Only behaviour that is correct today and identical on both repositories was pinned.

| Area                          | Cases | Examples                                                                                 |
| ----------------------------- | ----- | ---------------------------------------------------------------------------------------- |
| Normalisation and exact terms | 7     | `  HOWEVER,  `, curly apostrophe _What’s more_, _contributed to_, _allocated_            |
| Spelling variants             | 2     | _focussing on_, _analyzes_                                                               |
| Typo correction               | 4     | _nevertheles_, _crucal_, _contibute to_, _responsable_ (with patterns and mistake)       |
| Relations                     | 6     | synonyms, stronger, weaker (importer inverse), alternative, instead of, a skill modifier |
| Prepositions                  | 5     | _contribute + ?_, _associated with or to_, a base with two patterns, a typo inside       |
| Collocations                  | 2     | _crucial_, _considerable_ (two classifier shapes)                                        |
| Linkers, phrases, intents     | 5     | linker groups, sentence-pattern ordering, _how do I give an example_                     |
| Context gaps (verb frames)    | 4     | two verbs fit; _into_; different preposition; an honest prompt when no object follows    |
| Common mistakes               | 8     | _make measures_, _worth to note_, and the six Step 1 fix cases (§4)                      |
| Terms in longer queries, none | 3     | _depend on public transport_, _we should raise awareness_, a stopword alone              |
| Full-text fallback            | 2     | _environment_, _public transport_ (outcome and first result only)                        |

## 4. The false mistake claim

**Bug.** A query of two or more words that occurred _anywhere_ inside an authored mistake was reported as that mistake: "“a significant” is a common mistake — here is the correct form". The repository matches `wrong_normalized` by containment (meant for queries like _depend of_ inside _Many families depend of one income._), and the service accepted every hit. A sweep of all 937 sub-phrases of the 54 authored mistakes found the same false claim for correct phrases such as _very important_, _public transport_, _health problems_ and _such as tennis_. Identical on both repositories.

**Fix.** `showsMistake(query, mistake)` keeps a contained hit only when the query covers the **wrong part** of the mistake: the words left after the start and end the wrong form shares with its correction (`a significant [amount] of people` → _amount_). The whole wrong form still always matches. A missing word (_As result_) needs the words on both sides. A mistake that differs only in punctuation is shown only for the whole sentence, because normalisation removes punctuation. The service applies it after `findMistakes`, so both repositories behave the same, and the repository query is unchanged. It only removes claims; it never adds one.

**Still found:** _a significant amount_, _significant amount_, _amount of people_, the whole sentence, _depend of_, _make measures_, _worth to note_, _responsible of_ (517 of the 937 sub-phrases still show a mistake, all covering its wrong part).

## 5. The "noisy fallback" re-check

The audit's examples came from the in-memory repository. On PostgreSQL:

| Query                       | In memory                | PostgreSQL                     |
| --------------------------- | ------------------------ | ------------------------------ |
| climate change              | 6 loosely related senses | _pose a threat_                |
| describe a graph            | 5 senses                 | _rise sharply_                 |
| words about the environment | 4 senses                 | _have a detrimental effect on_ |
| writing task 1 language     | 15 senses                | no match                       |
| what goes with threat       | 13 senses                | no match                       |

PostgreSQL's fallback (`plainto_tsquery`: every word required; `ts_rank`; top 10) is precise, so **no fallback change is warranted**. The noise is in the in-memory repository's approximation (any one word of four or more letters, in definition and best-when only, unranked). It is a test double, so it was not changed. Consequences: fallback lists are pinned only on PostgreSQL (`search-golden.integration.test.ts`), the shared snapshot records only that a fallback happened, and golden fallback cases assert the outcome and first result only.

## 6. Ranking snapshot

`test/search-snapshot.txt`: one block per golden query and example search (73 queries), each with the classifier intent, outcome, how the term was resolved, any "did you mean" options, the fit-guide row count, every result group with its label and result keys in order, context-gap verdicts, and the mistakes shown. Results are keyed by authored IDs (`significant.notable`, `significant.notable:impact`, `responsible-for.duty:to`, `invest.money:gap`), never database row IDs, so the in-memory and PostgreSQL runs produce the same file byte for byte. Fallback lists are recorded as present or absent only (§5). Regenerate with `pnpm vitest run -u` and explain every changed line in the PR; CI never writes it.

## 7. Current behaviour deliberately not changed

Recorded for the later ranking step (§15, Step 9), which may change behaviour only to fix demonstrated failures.

- _how can I say something rose_ matches the _describe a serious problem_ intent.
- _on the other hand?_: the trailing `?` survives normalisation, so the term is read as a typo of itself.
- _preposition after depends_: the inflection isn't a pattern base, so it is read as a typo of _depend_.
- _a significant_ (after the fix) is read as a two-edit typo of _significant_; the results are right, the "corrected spelling" notice is not.
- _responsible to_ is "corrected" to _responsible for_, although _responsible to_ is a valid pattern. Before the fix it was wrongly called a mistake.
- "Did you mean" ties offered between forms of the same item (_allocatek_ → allocate / allocated / allocates; _analyde_ → analyse / analyze). No cross-item tie exists in today's content, so no golden "did you mean" case was added; the mechanism stays covered by the fixture unit test.
- Context-gap verdicts within the same fit are ordered A–Z (the specification's §7.4 changes that in Step 5a).

## 8. Open question

A fragment that contains a mistake's wrong word but not the words that make it wrong still shows the mistake: _in education_ shows _The council allocated money in education._, _to the_ shows _have a detrimental effect to the environment_. Telling them apart needs to know which word governs the error (the verb before _in_, the noun before _to_), and the content model doesn't record that. Left for the owner to decide (a content-model field, a minimum context rule, or accepting it); no change made.
