# Lexora Design System

> The visual source of truth. Values live in `src/styles/tokens.css` and `src/styles/typography.css`; this document explains them. The live reference is the `/design-system` route.
>
> **Status:** v0.3 — design language v0.2 plus the learning components and screen patterns of the Phase 1 prototype. Sections marked _Planned_ describe intent; they are specified fully when built.

---

## 1. Identity

Lexora should feel like a **calm, precise study desk**: warm paper, dark ink, well-set type, and colour only where it means something. It is a productivity tool for language, not a course and not a game.

| We are                                       | We are not                         |
| -------------------------------------------- | ---------------------------------- |
| Minimal, warm, precise                       | Gamified, cartoonish, loud         |
| Structured, quiet, dense where useful        | Dashboard-cluttered                |
| Typographic, with colour used as information | Gradient-heavy, glassy, decorative |
| Premium through restraint                    | Premium through effects            |

### Signatures

What makes Lexora recognisable:

1. **Serif means language.** Every interface surface uses Inter, and hierarchy comes from weight. Newsreader appears **only** for English being learned: terms, example sentences, the term heading on a detail page. When a learner sees serif, they are looking at language to study.
2. **Category colour.** Seven soft tints identify the _kind_ of language (vocabulary, synonym, preposition, collocation, linker, pattern, expression). Nothing else in the interface is colourful.
3. **The highlighter.** Target terms inside examples are marked with a soft lemon highlighter, the way a student marks a text. The same tint may fill one emphasis panel per view, and is used for nothing else.
4. **Charcoal acts, ink guides.** Primary actions are charcoal. One muted indigo, "ink", marks links, focus, selection and the active state.

---

## 2. Reference translation

The material in `/design-references` was studied for its underlying decisions, not its appearance. Each principle below is restated in Lexora's terms.

| Principle                    | Observed in the reference                                                                             | Lexora translation                                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Hierarchy by weight          | One sans everywhere; 600 headings / 500 controls / 400 body; tight display leading, negative tracking | Inter 600 for every interface heading, −1% to −2.5% tracking at large sizes. The serif is reserved for language (§4). |
| Surface hierarchy            | White canvas, warm-grey recessed surface, three hairline weights                                      | Warm off-white canvas, white raised surfaces, recessed wells. `border-subtle` / `border` / `border-strong`.           |
| Flat by default              | Cards rest on a hairline; shadows only for lifted things                                              | No resting shadow on cards, tiles or inputs. Shadow means lifted: hover, menus, dialogs (§7).                         |
| Sober geometry               | 8px rectangular buttons, 12px cards; pills only for tabs and status                                   | Radius 4 / 6 / 8 / 12 / 16 (§6). `rounded-full` only for filter chips, status pills, avatars.                         |
| Two densities                | Comfortable 44px marketing controls; compact product chrome                                           | 28–30px chrome, 36px buttons, 40px inputs, 44px forms and mobile, 56px hero search (§5.2).                            |
| Search as a surface          | Recessed search pill on a hairline; strong focus edge                                                 | A recessed **SearchTrigger** that opens the palette, and a raised **hero SearchField** for the Finder (§9.3).         |
| Pills switch, lines navigate | Pill tabs with a dark active fill; underline tabs for sections                                        | **FilterChip** for category filters, underline tabs for detail sections, a segmented control for binary views (§9.5). |
| Tint as meaning              | Pastel tints echo product properties; one bold tint for emphasis                                      | Tints belong to language categories. The highlighter is the single emphasis tint (§3.5).                              |
| Content rhythm               | Eyebrow → headline → muted subtitle → actions → tiles; generous section spacing                       | The PageHeader pattern; 48 / 64 / 96 section rhythm; descriptions capped near 60 characters (§5.3).                   |
| Tables                       | Uppercase micro headers, soft row dividers                                                            | Overline headers, `border-subtle` rows, 44px rows, tabular numbers (§9.9).                                            |
| Interaction states           | Pressed deepens colour; disabled = hairline fill + muted text                                         | Pressed deepens the fill and shifts 1px. Disabled = recessed fill + `disabled-foreground`, never faded opacity.       |

**Deliberately not adopted:**

- **A brand-coloured primary button.** Lexora acts in charcoal so colour stays informational.
- **Dark hero bands, illustrations, decorative scatter.** Calm matters more than atmosphere for exam preparation.
- **Saturated solid badges.** Status uses soft fills; the only solid status is a neutral charcoal "Due".
- **Deep drop shadows.** The strongest shadow (`shadow-lg`) is reserved for dialogs and the palette.
- **Any reference branding, naming or typeface.**

---

## 3. Colour

All text pairs meet **WCAG 2.1 AA** (≥ 4.5:1) and form-control edges meet ≥ 3:1. The `/design-system` page computes every ratio live from the tokens. Re-check whenever a value changes.

### 3.1 Surfaces

| Token                     | Utility         | Value     | Use                                         |
| ------------------------- | --------------- | --------- | ------------------------------------------- |
| `--background`            | `bg-background` | `#FAF9F6` | Canvas: the page                            |
| `--card` / `--popover`    | `bg-card`       | `#FFFFFF` | Raised: cards, inputs, menus, dialogs       |
| `--sidebar`               | `bg-sidebar`    | `#F6F4F0` | Sidebar, a half-step below the canvas       |
| `--muted` / `--secondary` | `bg-muted`      | `#F3F1EC` | Recessed: wells, search pill, pattern chips |
| `--accent`                | `bg-accent`     | `#EFECE6` | Hover and selected rows (shadcn's "accent") |

The model: **canvas → raised (white) → recessed (muted)**. Something you type into or act on is raised; something you look into is recessed.

### 3.2 Text

| Token                   | Utility                    | Value     | Use                                              |
| ----------------------- | -------------------------- | --------- | ------------------------------------------------ |
| `--foreground`          | `text-foreground`          | `#1F1E1B` | Primary text, headings (15.8:1 on canvas)        |
| `--muted-foreground`    | `text-muted-foreground`    | `#5F5C55` | Secondary text, descriptions                     |
| `--subtle-foreground`   | `text-subtle-foreground`   | `#6B675F` | Metadata, placeholders, eyebrows (AA on `muted`) |
| `--disabled-foreground` | `text-disabled-foreground` | `#A39E94` | Disabled controls only (exempt from minimums)    |

Never make lighter text with opacity.

### 3.3 Lines

| Token             | Utility                | Value     | Use                                       |
| ----------------- | ---------------------- | --------- | ----------------------------------------- |
| `--border-subtle` | `border-border-subtle` | `#EFECE6` | Inner dividers, table rows                |
| `--border`        | `border-border`        | `#E7E4DD` | Card edges, section dividers              |
| `--border-strong` | `border-border-strong` | `#D5D0C6` | Outline buttons, table heads, hover edges |
| `--input`         | `border-input`         | `#908B82` | Form-control edges (3:1, WCAG 1.4.11)     |

### 3.4 Brand

| Token          | Utility               | Value     | Use                                       |
| -------------- | --------------------- | --------- | ----------------------------------------- |
| `--primary`    | `bg-primary`          | `#1F1E1B` | Primary action (charcoal)                 |
| `--ink`        | `text-ink` / `bg-ink` | `#4450A8` | Links, focus ring, active nav icon, saved |
| `--ink-strong` | `text-ink-strong`     | `#3A4596` | Ink text on `ink-soft`                    |
| `--ink-soft`   | `bg-ink-soft`         | `#ECEEF8` | Selection, "New" status, ink badges       |
| `--ring`       | `ring-ring`           | = ink     | Focus rings                               |

### 3.5 Emphasis: the highlighter

| Token                    | Utility                     | Value     | Use                                                  |
| ------------------------ | --------------------------- | --------- | ---------------------------------------------------- |
| `--highlight`            | `bg-highlight`              | `#F9EAA0` | Target term in examples; one emphasis panel per view |
| `--highlight-foreground` | `text-highlight-foreground` | `#1F1E1B` | Text on the highlighter (13.7:1)                     |

Rules: the highlighter is never a category, never feedback, and appears as a panel at most once per view (for example "Today's focus").

### 3.6 Feedback

Always pair feedback colour with an **icon and words**.

| Tone    | Text token          | Surface token            | Use                                     |
| ------- | ------------------- | ------------------------ | --------------------------------------- |
| Success | `success` `#2D6A3E` | `success-soft` `#E8F3EA` | Correct answers, mastered               |
| Warning | `warning` `#7F5409` | `warning-soft` `#FBF1DC` | Repetition, register mismatch, learning |
| Danger  | `danger` `#A3322A`  | `danger-soft` `#FAE9E7`  | Incorrect, errors, destructive buttons  |
| Info    | `info` `#3A4596`    | `info-soft` `#ECEEF8`    | Neutral notes                           |

### 3.7 Language categories

Each category is a triplet: `cat-{name}` (text), `cat-{name}-soft` (fill), `cat-{name}-line` (border). Use them through `CategoryBadge`, `FilterChip` and `Tile`; don't apply them ad hoc.

| Category    | Text      | Soft      | Line      | Character  |
| ----------- | --------- | --------- | --------- | ---------- |
| vocabulary  | `#3C4757` | `#ECEEF1` | `#D7DBE1` | Slate      |
| synonym     | `#2E5B39` | `#EAF2EA` | `#CFE0CF` | Sage       |
| preposition | `#235878` | `#E5EFF6` | `#C8DCEA` | Sky        |
| collocation | `#5A3F8E` | `#EFEBF7` | `#DAD1EC` | Lavender   |
| linker      | `#73500F` | `#F7EEDB` | `#EADBB7` | Sand       |
| pattern     | `#8C3345` | `#F8E8EB` | `#EBCDD3` | Rose       |
| expression  | `#874223` | `#F8EBE3` | `#EDD3C3` | Terracotta |

Rules:

- Category colour identifies **kind**, never quality or correctness. Feedback colours do that.
- The label is always visible, so colour is never the only signal.
- Register (formal / neutral / informal) and skill (writing / speaking) are **neutral** tags so they never compete with category colour.

### 3.8 Dark mode

_Deferred._ Every component reads semantic tokens, so dark mode is a value set under `.dark` in `tokens.css` with no component changes.

---

## 4. Typography

| Family             | Utility      | Role                                                         |
| ------------------ | ------------ | ------------------------------------------------------------ |
| **Inter**          | `font-sans`  | Every interface surface, including all headings              |
| **Newsreader**     | `font-serif` | **Only** English being learned: terms and example sentences  |
| **JetBrains Mono** | `font-mono`  | Structure: patterns (`responsible for + noun`), keys, counts |

All three are self-hosted via `next/font`. Inter uses `cv05` (tailed lowercase _l_) so _l / I / 1_ stay distinct.

**The rule:** hierarchy comes from **weight and size inside Inter**, not from switching fonts. A serif page title would blur the one meaning serif carries, so page titles are never serif.

### 4.1 Interface roles (Inter)

| Utility           | Size / line          | Weight | Tracking | Use                                   |
| ----------------- | -------------------- | ------ | -------- | ------------------------------------- |
| `type-display`    | 36→52 (fluid) / 1.08 | 600    | −2.5%    | Onboarding and marketing hero only    |
| `type-title`      | 26→32 (fluid) / 1.2  | 600    | −2%      | Page title, one per page              |
| `type-heading`    | 20 / 1.4             | 600    | −1%      | Section heading                       |
| `type-subheading` | 16 / 1.5             | 600    | −0.5%    | Card, group and dialog headings       |
| `type-reading`    | 16 / 1.6             | 400    | —        | Explanations, descriptions, long text |
| `type-body`       | 14 / 1.55            | 400    | —        | Interface default (set on `<body>`)   |
| `type-label`      | 14 / 1.4             | 500    | —        | Labels, nav, button text              |
| `type-caption`    | 13 / 1.4             | 400    | —        | Metadata, hints                       |
| `type-micro`      | 12 / 1.35            | 500    | —        | Badges, counts                        |
| `type-overline`   | 11 / 16, caps        | 600    | +8%      | Eyebrows, table headers (sparingly)   |
| `type-mono`       | 13 / 1.4 (JetBrains) | 400    | —        | Patterns, keys                        |

### 4.2 Language roles (Newsreader)

| Utility             | Size / line         | Weight | Use                                        |
| ------------------- | ------------------- | ------ | ------------------------------------------ |
| `type-term-display` | 32→44 (fluid) / 1.1 | 500    | The term heading of a language detail page |
| `type-term`         | 22 / 1.3            | 500    | A term in a card or list                   |
| `type-term-sm`      | 16 / 1.4            | 500    | A term in tables, palette results          |
| `type-example`      | 18 / 1.6            | 400    | Example sentences                          |

Guidelines:

- One `type-title` per page. Don't stack large headings.
- Keep descriptions at or under `max-w-prose` (about 60–65 characters) and long text at or under `max-w-reading`.
- Use sentence case everywhere except `type-overline`.
- Use curly quotes (“ ”) and real ellipses (…) in content.

---

## 5. Space, density & layout

### 5.1 Spacing

A **4px base** (Tailwind `--spacing`) with an **8px rhythm**. Preferred steps: 1, 2, 3, 4, 5, 6, 8, 10, 12, 16 (4–64px).

- Component padding: 16–24px (`p-4`–`p-6`). Card padding is 20px.
- Gaps inside groups: 8–12px. Gaps between groups: 24–48px.

### 5.2 Control heights (two densities)

| Token           | Height | Use                                                |
| --------------- | ------ | -------------------------------------------------- |
| `control-xs`    | 24px   | Inline actions                                     |
| `control-sm`    | 28px   | Toolbar buttons, filter chips (32px on mobile)     |
| `control-nav`   | 30px   | Sidebar rows                                       |
| `control-md`    | 36px   | Default buttons, segmented control, search trigger |
| `control-input` | 40px   | Default inputs, in-page search field               |
| `control-lg`    | 44px   | Auth and onboarding forms, primary CTAs, mobile    |
| `control-hero`  | 56px   | Finder hero search                                 |

Use them as `h-control-md`, `size-control-sm`, and so on. **Compact** density (24–30px) is for app chrome and repeated rows; **comfortable** density (40–44px) is for forms, primary actions and touch.

### 5.3 Section rhythm & content stack

| Token        | Value | Use                            |
| ------------ | ----- | ------------------------------ |
| `section-sm` | 48px  | Between groups inside a page   |
| `section`    | 64px  | Between page sections          |
| `section-lg` | 96px  | Onboarding and marketing bands |

Use as `py-section`, `mb-section-sm`. Every page follows the same **content stack**: optional eyebrow (overline or badge) → `type-title` → one muted `type-reading` line → actions → content.

### 5.4 Widths & breakpoints

- `max-w-reading` 42rem (long text, result lists), `max-w-page` 72rem (standard pages), `w-sidebar` 15.5rem.
- Gutters: 16px on mobile (`px-4`), 24px from `sm` (`px-6`), 32–48px inside wide content panes.
- Breakpoints are the Tailwind defaults (`sm` 640, `md` 768, `lg` 1024, `xl` 1280).

| Range    | Behaviour                                                                               |
| -------- | --------------------------------------------------------------------------------------- |
| < 768    | Single column. Sidebar becomes a sheet (_Planned_). Hero search full width. Chips wrap. |
| 768–1023 | Sidebar visible in compact layouts; single content column.                              |
| ≥ 1024   | Persistent sidebar, multi-column grids where helpful.                                   |

There must be no horizontal page scroll at any width ≥ 320px. Wide tables scroll inside their own container.

---

## 6. Radius

Rectangular, never bubbly.

| Token          | Value | Use                                       |
| -------------- | ----- | ----------------------------------------- |
| `rounded-xs`   | 4px   | Tags, category badges, kbd, inline marks  |
| `rounded-sm`   | 6px   | Nav rows, small buttons, menu items       |
| `rounded-md`   | 8px   | Buttons, inputs, menus, search trigger    |
| `rounded-lg`   | 12px  | Cards, tiles, panels                      |
| `rounded-xl`   | 16px  | Dialogs, command palette, hero search     |
| `rounded-full` | pill  | Filter chips, status badges, avatars only |

Nested corners shrink inward: an item inside a container uses a smaller radius (a `sm` item inside an `md` menu, an `md` item inside the `xl` palette).

---

## 7. Elevation

Surfaces **rest flat**. Shadow means something has been **lifted** above the page.

| Level       | Treatment                     | Use                          |
| ----------- | ----------------------------- | ---------------------------- |
| 0 · Flat    | 1px `border`, no shadow       | Resting cards, tiles, inputs |
| 1 · Hover   | `border-strong` + `shadow-sm` | Hovered card or linked tile  |
| 2 · Float   | `border` + `shadow-md`        | Menus, tooltips, popovers    |
| 3 · Overlay | `border` + `shadow-lg`        | Dialogs, command palette     |

`shadow-xs` is used only on filled buttons (primary, ink) and the active segment of a segmented control. Shadows are warm-tinted (`rgb(31 30 27 / …)`). Backdrop blur is used only on the sticky page header, never as a glass effect.

---

## 8. Motion

| Token           | Utility                      | Use                      |
| --------------- | ---------------------------- | ------------------------ |
| 120ms           | `duration-120`               | Hover, press, colour     |
| 180ms           | `duration-180`               | Popovers, tabs, overlays |
| 240ms           | `duration-240`               | Dialogs, side panels     |
| `ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Everything (one curve)   |

Motion explains change and never decorates. Press feedback is a 1px shift plus a deeper fill. `prefers-reduced-motion` disables animation globally.

---

## 9. Components

Legend: ✅ built · 🔜 _Planned_ (intent only).

### 9.1 Button ✅ `ui/button`

| Variant       | Use                                                     |
| ------------- | ------------------------------------------------------- |
| `default`     | The single primary action in a view (charcoal)          |
| `ink`         | Brand-forward action, rarely (onboarding "Get started") |
| `outline`     | Secondary actions                                       |
| `secondary`   | Quiet filled actions                                    |
| `ghost`       | Toolbar, in-card and icon actions                       |
| `destructive` | Destructive confirmation only (soft danger fill)        |
| `link`        | Inline navigation in ink                                |

- **Sizes:** `xs` 24, `sm` 28, `default` 36, `lg` 44, plus `icon-xs`, `icon-sm`, `icon` and `icon-lg`.
- **Text and shape:** `type-label` text, `rounded-md` (`rounded-sm` for xs/sm).
- **Icon-only buttons** need an `aria-label`.
- **States:** hover lightens or tints, press deepens and shifts 1px, focus is a 2px ink ring with a canvas offset, and disabled is a recessed fill with `disabled-foreground` (no opacity).

### 9.2 Input ✅ `ui/input`

- `default` is 40px (in-app); `size="lg"` is 44px (auth, onboarding).
- White, flat, a 3:1 `border-input` edge, `rounded-md`.
- **Focus:** ink border plus a soft ink ring.
- **Invalid:** `aria-invalid`, a danger edge, and a message linked with `aria-describedby`.
- **Disabled:** recessed fill with disabled text.
- Text is 16px on mobile (prevents iOS zoom) and 14px from `md`.
- Always pair with a visible label.

### 9.3 Search ✅

Three patterns, never mixed:

| Pattern              | Component                       | Spec                                                                                                                                                   |
| -------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Trigger** (chrome) | `lexora/search-trigger`         | A button, not an input. Recessed `bg-muted` pill, `border-subtle`, 36px, `rounded-md`, placeholder in subtle text, ⌘K hint. Opens the command palette. |
| **Hero** (Finder)    | `lexora/search-field size="lg"` | Raised white field, 56px, `rounded-xl`, `shadow-sm`, 18px text, `/` hint. Suggested queries as quiet pills below.                                      |
| **Filter** (in page) | `lexora/search-field`           | 40px, `rounded-md`. Filters the visible list.                                                                                                          |

All have an accessible label. Placeholders are prompts ("What do you want to say?"), not labels. Search behaviour arrives in Phase 4.

### 9.4 Command palette ✅ `ui/command`

- **Opening:** ⌘K / Ctrl+K or any SearchTrigger.
- **Position and size:** a third of the way down the viewport, `max-w-xl`, `rounded-xl`, `shadow-lg`.
- **Contents:** a borderless input row with a hairline below, overline group headings, the selected row in `bg-accent` (`rounded-md`), mono shortcuts right-aligned, and an optional footer hint.
- **Results:** terms appear as `type-term-sm` with category dots.

### 9.5 Tabs, segments & filter chips ✅

| Pattern               | Component                  | Use                                                                                                                                                                      |
| --------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **FilterChip**        | `lexora/filter-chip`       | Multi-select filters (Finder categories). Pill, 28px (32 on mobile). Inactive: hairline outline. Active: charcoal fill. Optional category dot and count. `aria-pressed`. |
| **Underline tabs**    | `ui/tabs` `variant="line"` | Page sections (Overview / Examples / Mistakes). Full-width hairline with a 2px foreground bar on the active tab.                                                         |
| **Segmented control** | `ui/tabs` (default)        | Two or three views of the same content (Writing / Speaking). Recessed track; the active segment is raised white with `shadow-xs`.                                        |

### 9.6 Badges ✅

**Rectangles say what something is. Pills say where you are with it.**

| Component               | Shape              | Use                                                                                                                   |
| ----------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `lexora/category-badge` | Rectangle, `xs`    | The kind of language. `soft` chip or quiet `dot` variant                                                              |
| `lexora/tag-badge`      | Rectangle, neutral | Register (academic / formal / neutral / informal) and skill (writing / speaking)                                      |
| `lexora/status-badge`   | Pill               | Learning status: New (ink), Learning (warning), Due (charcoal), Mastered (success)                                    |
| `lexora/fit-badge`      | Pill               | How well a choice fits a sentence: Best fit (success), Natural (ink), Possible (warning), Different meaning (neutral) |
| `ui/badge`              | Rectangle          | Generic labels (`default`, `secondary`, `ink`, `outline`, `destructive`)                                              |

All badges are 20px tall with `type-micro` text.

### 9.7 Tile ✅ `lexora/tile`

A tinted, borderless entry point: a white icon square (36px, `rounded-md`), a `type-subheading` title and a one-line `type-caption`. 20px padding, `rounded-lg`.

- **Tones:** a category tint, `neutral` (muted) or `highlight` (at most one per view).
- **Linked tiles** lift with `shadow-sm` on hover.
- Use them for small grids of destinations, not for content lists.

### 9.8 Language result card ✅ `lexora/language-result-card`

The core unit of the Finder. White, flat, 1px `border`, `rounded-lg`. Hover: `border-strong` + `shadow-sm`. Anatomy:

1. `CategoryBadge`
2. **Term** in `type-term` (serif)
3. **Meaning**, one line, `type-body` muted
4. **Best when …** (optional): lightbulb in ink plus one line of context. This is the line that makes near-synonyms distinguishable.
5. **Pattern** (optional): mono chip on `bg-muted`, shown when there are no collocations
6. **Collocations** (optional): up to four quiet chips (`border-subtle` on canvas, `type-caption`)
7. **Example** (optional): serif blockquote with a left rule; the target term is marked with the **highlighter**
8. **Note** (optional): caption, for common mistakes or register warnings
9. **Footer**: register and skill tags on the left, `StrengthMeter` on the right

- **Selectable:** with `href`, the term becomes a stretched link, so the whole card opens the detail page. Focus shows a ring on the card.
- **Save:** a ghost icon button (bookmark) with `aria-pressed`. It sits above the stretched link (`z-10`), so it stays separately clickable and focusable. Saved = ink with a filled-check icon. It is hidden when no handler is passed.

### 9.9 Table ✅ `ui/table`

- **Header:** `type-overline` in subtle text over a `border-strong` rule.
- **Rows:** 44px, `border-subtle` dividers, hover `bg-accent/60`, selected `bg-ink-soft`.
- **Cells:** language terms in `type-term-sm`; numbers right-aligned, mono and tabular.
- **Layout:** no vertical rules or zebra stripes. Wide tables scroll inside their container.

### 9.10 Card ✅ `ui/card`

The generic container: white, flat, `rounded-lg`, 20px padding, with an optional footer on `bg-muted/50` above a `border-subtle` rule. Prefer a specific pattern when one exists. Don't nest cards.

### 9.11 Page header ✅ `lexora/page-header`

- **Content:** optional eyebrow (string → overline, or a node such as a `Badge`), then the `type-title` in Inter and one `type-reading` line capped at `max-w-prose`.
- **Actions:** right-aligned; they stack below on mobile.

### 9.12 Navigation & app shell ✅ `lexora/nav-item`, `shell/*`

- **NavItem:** 30px row (`control-nav`), `rounded-sm`, 16px icon, `type-label`. Hover uses `bg-accent`. Active uses `bg-accent` + semibold foreground + an **ink icon**, with `aria-current="page"`. An optional count is mono and tabular. In `collapsed` mode it is icon-only, with the label as a right-side tooltip and kept for screen readers.
- **Sidebar** (`shell/app-sidebar`):
  - `bg-sidebar`, `border-r`, persistent from `lg` and sticky at full height.
  - Expanded it is `w-sidebar` (248px). It collapses to a 56px icon rail with the header button or ⌘\ / Ctrl+\, animating width over 180ms.
  - From top to bottom: the logo mark and name, a SearchTrigger (an icon button when collapsed), primary nav (Home, Language Finder, Language bank, Practice, Writing Lab, Speaking Lab, Progress), then Design system and Settings behind a hairline.
  - Below `lg` the same contents open in a left **sheet** from the top bar's menu button. Choosing a destination closes the sheet.
- **Top bar** (`shell/top-bar`):
  - 48px, sticky, `border` bottom, canvas at 95% with a light blur.
  - Left: the menu button (below `lg`), then "Lexora / Page" (the caption is hidden on small screens).
  - Right: a "Prototype" badge while the app is a prototype, plus a search button below `lg`.
- **Command palette** (`shell/command-palette`): global ⌘K / Ctrl+K. "Go to" lists every destination and navigates for real. "Example searches" open the Finder, "Sample language" opens detail pages, and "Actions" toggles the sidebar. Real language search arrives in Phase 4.
- **Page frame** (`shell/page-container`): `max-w-page`, gutters 16 / 24 / 40px, vertical padding 32 → 48px.
- **Placeholders** (`shell/route-placeholder`): pages not built yet show the page header with a "Not built yet" badge, a dashed "What this screen will do" panel (status plus three planned capabilities), and a "Meanwhile" list linking to built screens.
- **Breadcrumb:** sub-routes show their parent, e.g. "Language Finder / significant" on a detail page.
- **Skip link:** the first focusable element on every app page. It jumps to `#main`.

### 9.13 Overlays ✅ `ui/tooltip`, `ui/dropdown-menu`, `ui/dialog`

- **Tooltip:** charcoal, 12px, 300ms delay, `shadow-md`. Use it for names and shortcuts, never for essential information.
- **Menu:** white, `border`, `rounded-md`, `shadow-md`. Items are `rounded-sm`, 32px, and highlight with `bg-accent`.
- **Dialog:** `rounded-xl`, `shadow-lg`, `max-w-md`, over a charcoal 20% overlay with **no blur**. The footer sits on `bg-muted/50`; cancel goes left of confirm.

### 9.14 Feedback & states ✅ `lexora/callout`, `lexora/empty-state`, `ui/skeleton`

- **Callout:** a tone fill with an icon, title and body. Pass `role="status"` or `role="alert"` when it appears dynamically.
- **Empty state:** a dashed `border-strong` frame, an icon tile, a title, one sentence and usually one action.
- **Skeleton:** `bg-muted` blocks that mirror the final layout, with `role="status"`. No spinners for content.

### 9.15 Learning patterns ✅

Components for language and practice. They are presentational and take data as props.

| Component                 | Spec                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lexora/highlighted-text` | Marks the first occurrence of the target term with the **highlighter** (`bg-highlight`, `rounded-xs`). Use it wherever language is shown in context.                                                                                                                                                                                                                                                                                                                                           |
| `lexora/gap-sentence`     | A serif sentence (`type-example`) with gap slots. An empty slot is a 2px `border-input` underline with a visually hidden "blank"; a filled slot is the highlighter, or `danger-soft` with a strike-through for a wrong attempt. Usually sits in a `bg-muted` well.                                                                                                                                                                                                                             |
| `lexora/choice-option`    | A full-width answer row, at least 44px, `rounded-md`, with an optional key-cap shortcut (hidden below `sm`). States: idle (`border-strong`) · selected (ink edge + `ink-soft`) · correct (success edge and fill + check) · acceptable (ink + check) · incorrect (danger edge and fill + cross) · revealed (dashed success edge + check) · dimmed. The verdict is also given in visually hidden text. `language` renders the label in serif; `pressed` gives toggle semantics for multi-select. |
| `lexora/fit-badge`        | See §9.6. Used by the Finder context tool.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `lexora/strength-meter`   | Three 12×6px segments (`ink` filled, `border-strong` empty) plus "Strength: Moderate / High / Very high". `role="img"` with the label as its accessible name. Strength is relative to the plain word (e.g. _important_).                                                                                                                                                                                                                                                                       |
| `lexora/progress-track`   | A 4px `bg-muted` track with an `ink` fill. `role="progressbar"` with values and "n of m" text. Never shows percentages or rewards. On tinted panels, pass `trackClassName`.                                                                                                                                                                                                                                                                                                                    |
| `lexora/language-row`     | Compact list link: `type-term-sm` term, category dot, one usage line (`type-caption`, a context line rather than a definition), optional `StatusBadge` (hidden below `sm`), chevron. Hover `bg-accent/60`. Group rows inside a bordered card with `p-1`.                                                                                                                                                                                                                                       |
| `lexora/mistake-row`      | A correction, not a failure: overline type label; the old form in serif, struck through in muted text; an arrow; the better form in full colour; one line of why; an optional outline `sm` action. The struck text is announced as "Instead of …, use …".                                                                                                                                                                                                                                      |
| `lexora/skill-comparison` | The same idea in writing and in speaking. Two bordered panels side by side from `sm`, each with a skill tag and a serif example with the highlighter. Below `sm` it becomes a segmented switch, so the pair stays comparable without a long stack. An optional note follows in caption.                                                                                                                                                                                                        |

### 9.16 Planned

- **Writing Lab annotations** 🔜 _(Phase 7)_: wavy warning underline = repetition; solid danger = preposition or collocation error; dotted info = suggestion. Each opens a popover with a one-click apply.
- **Toasts** 🔜: bottom-right on desktop, at most one at a time, 4s, with Undo when the action can be reversed. Saving will confirm with a toast once persistence exists.

---

## 10. Screen patterns (Phase 1 prototype)

The four core screens. They reuse the shell, `PageContainer`, `PageHeader` and the components above. Every prototype screen says what is sample data and what isn't stored.

### 10.1 Dashboard (`/home`)

- **Header:** a sample-data badge, "Welcome back", this week's focus, then _Find language_ (outline) and _Start today's practice_ (primary).
- **Today's focus:** the single **highlighter panel** on the page. It holds the review count and time, a `ProgressTrack`, _Continue review_, and up to three "needs attention" rows (category dot + reason) on `bg-card/70`.
- **Continue learning:** `LanguageRow`s with a usage line, not definitions.
- **Recent mistakes:** `MistakeRow`s, each with a next step (practise, or find alternatives).
- **Quick actions:** a compact link list in the side column from `lg`.
- **No metric tiles, charts or streaks.**

### 10.2 Language Finder (`/finder`)

- **Search:** header, then the hero `SearchField` inside a `form role="search"`. The query lives in the URL (`?q=`). `/` focuses the field. On mobile a _Find_ button sits inside the field.
- **Search as:** single-select `FilterChip`s for Word · Phrase · Preposition · Collocation · Linker · Expression · Context. They are intents, so they have no category dots. Selecting one changes the placeholder and the example searches; a recognised query auto-selects its mode. Below `sm` they form one horizontally scrollable row.
- **Example searches:** quiet `bg-muted` pills.
- **Prototype caption:** always visible.
- **Results:**
  - an "Understood as" heading with mode and result count
  - a **fit guide** ("Which one fits?": term → when, plus a note on why they aren't interchangeable), in a sticky right column at `xl` and above the cards below `xl`
  - result cards
  - a `SkillComparison` when register matters
  - related searches
- **Context tool:** a `GapSentence` in a muted well. Each option fills the gap, including the preposition it brings, and gets a `FitBadge`. A note and a link to the item follow. This is exploration, not a test.
- **No match:** a dashed empty state that says the prototype only knows the example searches, and offers them again.

### 10.3 Practice (`/practice`)

- **Intro:** the five modes as numbered rows, each with a one-line purpose. Choosing a row jumps straight to that mode.
- **Session:**
  - one task at a time at `max-w-reading`
  - "Question n of 5 · mode" with a `ProgressTrack` above, _End session_ on the right
  - the prompt as the card heading, which receives focus on each new question
- **Retrieval first:** prepositions are **typed**, not chosen. Multi-select is used for collocations.
- **Feedback:** immediate, in a `Callout` (Correct · Also natural · Not quite). It explains why, reveals the best answer and links to the item. Answered options lock, and focus moves to _Continue_.
- **Keyboard:** number keys choose, Enter checks or continues.
- **Summary:** "You retrieved n of 5", a calm per-mode list, and _Worth revisiting_ as `LanguageRow`s.
- **No XP, streaks, hearts or confetti.**

### 10.4 Language detail (`/language/[slug]`)

- **Header:** back link; category and status; the term in `type-term-display` with IPA (only where verified) and part of speech; _Save to language bank_ (outline → secondary "Saved" in ink) and _Practise this_; an honest caption about session-only saving.
- **At a glance:** part of speech, register, level (CEFR), strength, skills. A sticky card at `xl`; a compact two- or three-column strip below `xl`.
- **Sections, divided by hairlines, in this order:**
  1. Meaning (+ pattern)
  2. When it works best (muted well with lightbulb)
  3. Don't use it when… (warning callout)
  4. Common collocations (2-column grid of phrase + note)
  5. Examples (segmented All / Writing / Speaking when both exist)
  6. In writing and speaking (`SkillComparison`)
  7. Common mistakes (`MistakeRow`s)
  8. Related language (relation → term, linked when it exists)

---

## 11. States checklist

Every data-backed view ships with:

- **Empty:** first use, and no results.
- **Loading:** a skeleton matching the layout.
- **Error:** a danger callout with retry, in plain language.
- **Partial:** stale or offline, where relevant.
- **Disabled:** a recessed fill and disabled text, with an explanation nearby if it isn't obvious.

---

## 12. Accessibility

- WCAG 2.1 AA contrast minimum; the playground verifies it live for every token pair.
- Every interactive element has a **visible focus** state (ink ring).
- Targets are ≥ 24×24px (WCAG 2.2). Primary touch targets on mobile are ≥ 32–44px.
- Colour is never the only signal (labels, icons, text). Toggle state is exposed with `aria-pressed` or `aria-current`.
- Radix primitives provide focus trapping, ARIA and keyboard behaviour. Don't break them when restyling.
- Landmarks (`header`, `nav`, `main`), one `h1` per page, logical heading order.
- `prefers-reduced-motion` is respected globally.

---

## 13. Changing the system

1. Propose the change here (a token or component spec).
2. Implement it in `tokens.css` / `typography.css` / the component.
3. Update `/design-system` so it can be reviewed visually.
4. Check contrast for any new colour pair (the playground shows it live).
