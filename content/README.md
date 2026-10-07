# Lexora content

This folder is the source of truth for Lexora's language. Everything a learner sees on Explore, the Finder and the language pages comes from these files. They are validated (`pnpm content:check`) and imported into PostgreSQL (`pnpm content:import`). The app never reads YAML at runtime.

```text
content/
├── README.md        # this guide
├── sources.yaml     # provenance registry: who wrote or informed the content, and under what licence
├── items/           # one file per language item; the file name is the item ID
│   └── responsible-for.yaml
└── intents/         # expression intents ("I want to express contrast")
    └── express-contrast.yaml
```

## The model in one paragraph

An **item** is something a learner looks up: a word (_significant_), a preposition pattern (_responsible for_), a collocation (_play a crucial role_), a linker (_however_), a phrase, a sentence pattern or a functional expression. Every item has one or more **senses**, and everything useful hangs off a sense: examples, collocations, preposition patterns, frames, common mistakes, and **relations** to other senses. Relations are sense-to-sense on purpose. _Considerable_ is a synonym of _significant_ in its "having a real effect" sense, not of _significant_ in statistics, and never of _important_.

## IDs never change

| ID                | Form                       | Example                     |
| ----------------- | -------------------------- | --------------------------- |
| Item              | kebab-case, = file name    | `responsible-for`           |
| Sense             | `<item>.<sense key>`       | `significant.notable`       |
| Example and other | `<sense>:<local id>`       | `significant.notable:ex1`   |
| Slug (URL)        | kebab-case, defaults to ID | `/language/responsible-for` |

- Saved language and (later) learning progress point at these IDs. **Once published, an ID is permanent.** Fix a typo in the text, never in the ID.
- A **slug** may change. List the old one in `previous_slugs` so old links redirect.
- **Nothing published is ever deleted.** Set `status: retired` on an item (optionally with `replaced_by`), or `retired: true` on a sense (optionally with `replaced_by: <sense id>`). Retired content is hidden but its references keep working. The importer refuses an import in which a published item or sense has disappeared.

## Item fields

```yaml
id: responsible-for # = file name
slug: responsible-for # optional; defaults to id
previous_slugs: [] # optional; earlier slugs that should redirect here
kind: preposition_pattern # word · phrase · collocation · preposition_pattern · linker · sentence_pattern · functional_expression
headword: responsible for # British display form
status: draft # draft (never shown) · published · retired
replaced_by: other-item # retired items only
regional_note: … # shown beside spelling variants
source: lexora-editorial # must be in sources.yaml and permit the uses below
informed_by: [] # sources that informed the choice (frequency lists…)
review: { author: claude, reviewer: owner, on: 2026-10-14, level: editorial } # reviewer and date are required to publish
forms: # every spelling and inflection search should recognise
  - { form: analyse, type: lemma, region: gb, default: true }
  - { form: analyze, type: spelling_variant, region: us }
senses: [] # see below
```

`forms` types: `lemma`, `inflection`, `spelling_variant`, `contraction`. `region` is `gb`, `us` or left out (both). Exactly one form is the default (`default: true`, or else the first lemma), and it is British or neutral. **American spellings are variants, never mistakes.**

## Sense fields

```yaml
- key: notable # local key
  label: having a real effect # only needed when an item has several senses
  pos: adjective # noun · verb · adjective · adverb · conjunction · preposition · noun_phrase · verb_phrase · adjective_phrase · adverbial_phrase · prepositional_phrase · clause_frame
  definition: Large or important enough to have a noticeable effect. # ≤ 25 words, without the headword
  cefr: B2 # A2–C2
  registers: [academic, neutral] # academic · formal · neutral · informal
  skills: [writing, speaking]
  ielts: { relevance: core, tasks: [writing-1, writing-2] } # core · high · useful; writing-1/2, speaking-1/2/3
  strength: 2 # 1–3, for words with stronger and weaker alternatives
  functions: [importance, increase] # addition · cause · concession · contrast · emphasis · example · importance · increase · problem · result
  best_when: … # when this is the right choice
  avoid_when: … # when it isn't
  skill_note: … # how writing and speaking use differ
  standalone: … # why this sense has no relations (otherwise at least one is required)
  linker: { connects: sentences, positions: [start, middle], punctuation: … } # linkers only
  examples: []
  collocations: []
  preposition_patterns: []
  frames: []
  mistakes: []
  relations: []
```

### Examples

```yaml
- {
    id: ex1,
    text: There has been a significant increase in cycling.,
    highlight: significant increase,
    skill: writing,
    task: writing-1,
    collocation: increase,
  }
```

`highlight` is a phrase (or a list of phrases) that occurs in `text`. `collocation` or `pattern` links the example to the collocation or preposition pattern it shows. Published senses need at least two examples, and a speaking example when `skills` includes speaking.

### Collocations and preposition patterns

```yaml
collocations:
  - {
      id: impact,
      phrase: a significant impact,
      pattern: have a significant impact on + noun,
      note: on people,
      the economy or the environment,
    }
  - { id: role, phrase: play a significant role, item: play-a-crucial-role } # item: the full collocation item, if Lexora has one
preposition_patterns:
  - {
      id: for,
      base: responsible,
      preposition: for,
      pattern: be responsible for + noun / -ing,
      complement: noun_or_ing,
      mistake: of,
    }
```

`base` is what learners ask about ("preposition after _responsible_"). The pattern must contain both the base and the preposition. `complement` is `noun`, `ing`, `noun_or_ing`, `person` or `clause`.

### Frames

Sentence patterns and verb frames are lists of literal parts and typed slots:

```yaml
frames:
  - id: money-in
    parts:
      - { text: invest, head: true } # the word the frame is found by
      - { slot: object, fillers: [money, funds, resources, time] }
      - { text: in, also: [into] }
      - { slot: noun, hint: public transport }
```

Slots: `object`, `noun`, `ing`, `clause`, `adjective`, `person`. Fillers drive context-gap search: _Governments should \_\_\_ more money into public transport_ matches `invest` because `money` is a filler and `into` is accepted.

### Mistakes

```yaml
- {
    id: of,
    wrong: responsible of,
    right: responsible for,
    type: preposition,
    explanation: Responsible always takes "for" before the task or result.,
  }
```

Types: `preposition`, `collocation`, `word_form`, `countability`, `punctuation`, `register`, `confusion`, `grammar`. Only mistakes learners really make.

### Relations

Write each relation **once**, on either side. The importer writes the reverse.

| Type            | A → B means                             | Reverse        | Note required |
| --------------- | --------------------------------------- | -------------- | ------------- |
| `synonym`       | B can replace A in this sense           | same           | yes           |
| `alternative`   | B does a related job in some contexts   | same           | yes           |
| `stronger`      | B is a stronger choice than A           | `weaker`       | yes           |
| `more_formal`   | B is a more formal way to say A         | `more_natural` | yes           |
| `opposite`      | B means the opposite                    | same           | no            |
| `confusable`    | learners mix up A and B                 | same           | yes           |
| `has_component` | collocation or phrase A contains word B | `component_of` | no            |
| `derived_form`  | B is another word form of A             | same           | yes           |
| `related`       | worth knowing together (use sparingly)  | same           | no            |

```yaml
- {
    type: stronger,
    to: crucial.essential,
    weight: 3,
    note: Crucial means an outcome depends on it.,
  }
```

`weight` (3 strongest, default 2) orders results. `note` explains the difference and is shown to learners. `context` limits a relation to some contexts. Relations always point at senses that exist in Lexora; if a useful alternative isn't here yet, add it as an item or leave it out.

## Expression intents

```yaml
id: express-contrast
label: Express contrast
function: contrast
triggers: [express contrast, show a difference, contrast two ideas] # "I want to …"
groups:
  - label: Between sentences
    entries:
      - { sense: however.contrast, fit: general contrast }
```

A trigger selects exactly one intent. Entries are shown in the order written.

## Provenance

- Every item names a `source` from `sources.yaml`; the source must permit each use (definitions, examples, relations, notes, mistakes).
- Phase 3 content is written by Lexora (`lexora-editorial`): drafted by Claude (`author: claude`) and reviewed by the owner before it is published.
- External sources may only inform the choice of items (`informed_by`, needing `frequency` or `candidates` permission). Lexora writes its own definitions and examples, and nothing is scraped. Each external source needs a recorded licence check (`verified_on`).

## Validation

`pnpm content:check` runs in CI without a database. It reports every issue with its file, line and field:

```text
items/significant.yaml:41 senses[0].relations[2].to: unknown sense "considerable.size"
```

Checked automatically, for drafts as well as published content (drafts only skip the review requirement):

- required fields, valid values, kebab-case IDs; IDs, slugs, sense keys and local IDs unique; file name = ID
- definitions at most 25 words and without the headword
- published senses: at least 2 examples, a speaking example when used in speaking
- highlights occur in their example; example, pattern and mistake references resolve
- relation targets exist and are published; notes where required; no self or duplicate relations
- published senses of words, phrases, collocations, linkers and expressions have a relation, or `standalone` with a reason
- linkers have linker details; preposition-pattern items have patterns; sentence-pattern items have frames
- patterns contain their base and preposition; mistakes differ from their correction and never treat a US spelling as wrong
- one default form per item, British or neutral
- sources exist and permit their use; external sources have a licence check date; published items have a reviewer and date
- retired content only: `replaced_by`, pointing at published content
- intent entries point at senses that aren't retired (draft entries stay hidden until published); no trigger selects two intents

## Importing

`pnpm content:import` validates, then writes the content into PostgreSQL in one transaction:

1. It stops early if the content is unchanged since the last import (same checksum).
2. It refuses, and changes nothing, if a published or retired item or sense is missing, published content is set back to draft, or a slug changed without listing the old one in `previous_slugs`.
3. It upserts everything by ID, touching only rows whose values changed, and deletes child rows (examples, collocations, patterns, frames, mistakes, relations, intent triggers and entries) that are no longer authored. Drafts that were never published are deleted when their file goes.
4. It writes inverse relations, rebuilds the full-text search vectors and records a release (git commit, checksum, counts) in `content_releases`.

The production procedure is in the main [README](../README.md#production-vercel--neon).

## Reviewer checklist (content PRs)

- [ ] Definition is clear, specific to this sense, and the part of speech is right
- [ ] Examples are natural, fit this sense, and sound like IELTS contexts
- [ ] Register and the writing/speaking distinction are accurate
- [ ] Relations are genuinely useful; nothing is presented as interchangeable unless it is
- [ ] Collocations and preposition patterns match reputable usage (consulted, not copied)
- [ ] Mistakes are ones learners really make
- [ ] British and American differences are accurate; IELTS relevance and tasks are justified
