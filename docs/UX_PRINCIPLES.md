# Lexora UX Principles

> How Lexora should behave and feel. When a design decision is unclear, these principles decide it. Visual specifics live in [DESIGN.md](DESIGN.md).

## The problem we solve

IELTS candidates usually **know what they want to say** but can't quickly retrieve the right word, preposition, linker, collocation, or pattern. Lexora is a **retrieval tool first** and a learning tool second. The learning exists so that retrieval eventually happens in the user's head, under exam pressure, without Lexora.

The core flow:

> **idea → appropriate language → context → pattern → practice → recall**

---

## 1. Start from intent, not from a syllabus

Users arrive with a need ("I want to disagree politely"), not a lesson plan. The primary surface is a **search field that accepts ideas**, not a course map.

- The Finder accepts word queries ("synonyms for important"), structural queries ("preposition after responsible"), and intent queries ("I want to express contrast").
- Never force users through units, levels, or onboarding quizzes before they can search.
- When a query is ambiguous, show grouped results by category instead of asking a clarifying question.

## 2. Answer fast, then deepen

The first screen of results must be useful in **under two seconds of reading**. Show the term, what it is, and one example first; the rest comes later.

- Result card order: category → term → one-line meaning → pattern → example → note.
- Depth (collocations, mistakes, alternatives, practice) lives one click away in the detail view.
- Progressive disclosure everywhere: summary first, details on demand.

## 3. Context is the product

A synonym without context is a trap. Every language item tells the user **when** to use it.

- Always show **register** (formal / neutral / informal) and **skill** (writing / speaking).
- Show **strength** where it matters (weaker ↔ stronger), and **natural vs. formal** alternatives.
- Prefer real IELTS-style example sentences over dictionary fragments.
- Surface **common mistakes** explicitly ("responsible of" ✗).

## 4. Keyboard-first, mouse-friendly

Lexora is a productivity tool. Fast users should never need the mouse.

- ⌘K / Ctrl+K opens the command palette from anywhere. `/` focuses the search field.
- Practice is fully keyboard-operable (number keys to choose, Enter to continue).
- Show shortcuts quietly (tooltips, palette hints), never as clutter.
- Everything also works by touch and pointer at mobile sizes.

## 5. Calm density

Show enough to be useful and nothing more. Whitespace is a feature.

- One primary action per view.
- No dashboards made of a dozen metrics. Show the one or two numbers that change behaviour (items due, weak areas).
- Colour is information, not decoration (see category colours in DESIGN.md).
- No badges, streak flames, or confetti competing for attention.

## 6. Honest, specific feedback

Feedback should teach, not just grade.

- Say **what** was wrong and **why**, then show the correct form in context.
- Mastery is earned from evidence (spaced recall), never from just viewing.
- Never inflate progress. A learner preparing for a high-stakes exam deserves an accurate picture.
- No guilt mechanics (lost streaks, sad mascots). Gentle reminders are fine.

## 7. Personal over generic

The product should feel more useful every week.

- Saved language, past mistakes, and weak categories shape what Lexora suggests and practises.
- The user's own sentences (Writing Lab, Speaking Lab) become practice material.
- Personalisation is **deterministic and explainable** ("You've missed this preposition 3 times"), not a black box.

## 8. Works without AI, gets better with it

Every core feature is useful with curated data and deterministic logic alone. Optional AI can later improve interpretation and explanations, but:

- Never block a flow on an AI call.
- Clearly label AI-generated content when it exists.
- Always keep a non-AI path that is good on its own merits, not a degraded fallback.

## 9. Respect the learner

Users are adults preparing for a serious exam.

- Use plain, precise English in the interface: no slang, no exclamation marks, no childish copy.
- Explanations are short and use simple language without talking down.
- Use British English for interface spelling and content, consistent with IELTS conventions ("practise" as a verb, "colour"). (To be confirmed by the product owner.)

## 10. Accessible by default

Accessibility is a requirement, not a phase.

- WCAG 2.1 AA minimum: contrast, focus visibility, keyboard access, labelled controls.
- Never rely on colour alone. Pair it with labels, icons, or text.
- Respect reduced motion. Support zoom to 200% without loss of content.
- Speaking features always have text alternatives.

---

## Anti-patterns: what Lexora must not become

| Anti-pattern                                                              | Why it fails our users                                        | What we do instead                                |
| ------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------- |
| **Duolingo-style gamification** (streaks, XP, mascots, hearts)            | Rewards activity over retrieval; feels childish for exam prep | Evidence-based mastery and quiet progress         |
| **Traditional IELTS course / LMS** (units, videos, modules, completion %) | Forces a syllabus on an intent-driven need                    | Search-first, use-driven learning                 |
| **Flashcard website** (word → definition, endless decks)                  | Isolated words without context or patterns                    | Language in context, patterns, real use           |
| **Dashboard clutter** (charts everywhere)                                 | Noise without action                                          | One or two actionable numbers                     |
| **Thesaurus dump** (40 synonyms, no guidance)                             | Encourages unnatural, wrong-register writing                  | Few, ranked, contextualised options               |
| **AI chat as the main UI**                                                | Slow, unpredictable, not reviewable, needs paid APIs          | Structured results; AI only as an optional helper |

---

## Writing UI copy

- Use sentence case for everything except overlines.
- Use verbs on buttons: "Save to language bank", "Start practice", not "OK" or "Submit".
- Empty states say what will appear and how to make it appear.
- Error messages say what happened and what to do next, without blame.
- Refer to the product's collections consistently: **Language Finder**, **Language bank**, **Practice**, **Writing Lab**, **Speaking Lab**, **Progress**.
