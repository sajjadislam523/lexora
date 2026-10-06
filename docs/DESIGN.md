# Lexora Design System

> The visual source of truth. Values live in `src/styles/tokens.css` and `src/styles/typography.css`; this document explains them. The live reference is the `/design-system` route.
>
> **Status:** v0.1 (Phase 0). Sections marked _Planned_ describe intent; they are specified fully when built.

---

## 1. Identity

Lexora should feel like a **calm, intelligent writing desk**: warm paper, dark ink, well-set type. It borrows the restraint of Notion and the precision of Linear, but it's its own thing: **editorial** where language is the subject, **utilitarian** where the user operates the tool.

| We are                                       | We are not                         |
| -------------------------------------------- | ---------------------------------- |
| Minimal, warm, editorial                     | Gamified, cartoonish, loud         |
| Structured, quiet, precise                   | Dashboard-cluttered                |
| Typographic, with colour used as information | Gradient-heavy, glassy, decorative |
| Premium through restraint                    | Premium through effects            |

**Signature moves** (what makes Lexora recognisable):

1. **Two voices of type.** A serif (Newsreader) for language itself, meaning terms, examples, and page titles. A sans (Inter) for the interface. Users learn that serif means "this is English to learn".
2. **Category colour.** Each kind of language (synonym, preposition, collocation, linker, pattern, expression, vocabulary) has a soft pastel identity. This is the only place colour is used liberally, and it always carries meaning.
3. **Ink.** One muted indigo accent for focus, links, selection, and the active state. It reads like a fountain-pen mark on warm paper.
4. **Charcoal actions.** Primary buttons are charcoal, not brand-coloured. Actions are confident and colour stays informational.

---

## 2. Colour

All pairs below meet **WCAG 2.1 AA**. Text pairs are ≥ 4.5:1 and the form-control edge is ≥ 3:1. Re-check contrast whenever a value changes.

### 2.1 Surfaces

| Token                     | Utility         | Value     | Use                                                    |
| ------------------------- | --------------- | --------- | ------------------------------------------------------ |
| `--background`            | `bg-background` | `#FAF9F6` | Page canvas: warm off-white                            |
| `--card`                  | `bg-card`       | `#FFFFFF` | Raised surfaces: cards, inputs                         |
| `--popover`               | `bg-popover`    | `#FFFFFF` | Floating surfaces: menus, dialogs, palette             |
| `--sidebar`               | `bg-sidebar`    | `#F6F4F0` | Sidebar, a half-step below canvas                      |
| `--muted` / `--secondary` | `bg-muted`      | `#F3F1EC` | Recessed wells, pattern chips, tracks                  |
| `--accent`                | `bg-accent`     | `#EFECE6` | Hover and selected rows (shadcn's meaning of "accent") |

### 2.2 Text

| Token                 | Utility                  | Value     | Use                                                                       |
| --------------------- | ------------------------ | --------- | ------------------------------------------------------------------------- |
| `--foreground`        | `text-foreground`        | `#1F1E1B` | Primary text (15.8:1 on canvas)                                           |
| `--muted-foreground`  | `text-muted-foreground`  | `#5F5C55` | Secondary text, descriptions                                              |
| `--subtle-foreground` | `text-subtle-foreground` | `#6B675F` | Metadata, placeholders, eyebrows. AA on every surface, including `accent` |

Three steps only. Don't make lighter text with opacity.

### 2.3 Lines

| Token             | Utility                | Value     | Use                                              |
| ----------------- | ---------------------- | --------- | ------------------------------------------------ |
| `--border`        | `border-border`        | `#E7E4DD` | Default hairline: dividers, card edges           |
| `--border-strong` | `border-border-strong` | `#D5D0C6` | Hovered card edges, outline buttons, table heads |
| `--input`         | `border-input`         | `#908B82` | Form-control edges (3:1, WCAG 1.4.11)            |

### 2.4 Brand

| Token                  | Utility                   | Value     | Use                                             |
| ---------------------- | ------------------------- | --------- | ----------------------------------------------- |
| `--primary`            | `bg-primary`              | `#1F1E1B` | Primary action (charcoal)                       |
| `--primary-foreground` | `text-primary-foreground` | `#FAF9F6` | Text on primary                                 |
| `--ink`                | `text-ink` / `bg-ink`     | `#4450A8` | Links, focus ring, active nav icon, saved state |
| `--ink-strong`         | `text-ink-strong`         | `#3A4596` | Ink text on `ink-soft`                          |
| `--ink-soft`           | `bg-ink-soft`             | `#ECEEF8` | Highlights in examples, selection, "new" badges |
| `--ring`               | `ring-ring`               | `= ink`   | Focus rings                                     |

### 2.5 Feedback

Always pair feedback colour with an **icon and words**.

| Tone        | Text token              | Surface token            | Use                                       |
| ----------- | ----------------------- | ------------------------ | ----------------------------------------- |
| Success     | `success` `#2D6A3E`     | `success-soft` `#E8F3EA` | Correct answers, mastered items           |
| Warning     | `warning` `#7F5409`     | `warning-soft` `#FBF1DC` | Repetition, register mismatch, review due |
| Danger      | `danger` `#A3322A`      | `danger-soft` `#FAE9E7`  | Incorrect, errors                         |
| Info        | `info` `#3A4596`        | `info-soft` `#ECEEF8`    | Neutral notes                             |
| Destructive | `destructive` `#B13A30` | (`/10` tint)             | Destructive buttons only                  |

### 2.6 Language categories

Each category is a triplet: `cat-{name}` (text), `cat-{name}-soft` (fill), `cat-{name}-line` (border). Use them through `CategoryBadge`. Don't apply them ad hoc.

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
- Register (formal/neutral/informal) and skill (writing/speaking) are **neutral** tags (`TagBadge`) so they don't compete with category colour.

### 2.7 Dark mode

_Deferred._ Every component reads semantic tokens, so dark mode is a value set under `.dark` in `tokens.css`. No component changes should be needed. Target timing: Phase 10, or earlier if requested.

---

## 3. Typography

| Family             | Variable     | Role                                                         |
| ------------------ | ------------ | ------------------------------------------------------------ |
| **Inter**          | `font-sans`  | Interface: everything the user operates                      |
| **Newsreader**     | `font-serif` | Editorial voice: page titles, terms, example sentences       |
| **JetBrains Mono** | `font-mono`  | Structure: patterns (`responsible for + noun`), keys, counts |

All three are self-hosted via `next/font`, so there are no runtime requests to Google. Inter uses `cv05` (tailed lowercase _l_) so _l / I / 1_ stay distinct, which matters in a language product.

### 3.1 Type roles

Use these utilities instead of composing size, weight, and tracking yourself.

| Utility           | Family | Size / line            | Weight | Use                                             |
| ----------------- | ------ | ---------------------- | ------ | ----------------------------------------------- |
| `type-display`    | Serif  | 36 / 44                | 500    | Hero, landing, page title at ≥ sm               |
| `type-title`      | Serif  | 28 / 36                | 500    | Page and section titles                         |
| `type-heading`    | Sans   | 18 / 26                | 600    | Panel and dialog headings                       |
| `type-subheading` | Sans   | 15 / 22                | 600    | Card and group headings                         |
| `type-term`       | Serif  | 20 / 28                | 500    | The language item itself                        |
| `type-example`    | Serif  | 17 / 26                | 400    | Example sentences                               |
| `type-reading`    | Sans   | 16 / 26                | 400    | Explanations, descriptions, long text           |
| `type-body`       | Sans   | 14 / 22                | 400    | Interface default (set on `<body>`)             |
| `type-label`      | Sans   | 13 / 18                | 500    | Form labels, nav, compact UI                    |
| `type-caption`    | Sans   | 12 / 16                | 400    | Metadata, hints                                 |
| `type-overline`   | Sans   | 11 / 16, +0.06em, caps | 600    | Eyebrows. Use sparingly, at most one per region |
| `type-mono`       | Mono   | 12 / 16                | 400    | Patterns, kbd, counts                           |

Guidelines:

- One serif title per page. Don't stack serif headings.
- Keep reading measure at or under `max-w-reading` (42rem).
- Use sentence case everywhere except `type-overline`.
- Use curly quotes (“ ”) and real ellipses (…) in content.

---

## 4. Spacing & layout

- **Base unit 4px** (Tailwind default `--spacing`). Preferred steps: 1, 2, 3, 4, 6, 8, 12, 16, 24 (4px … 96px).
- **Component padding:** 12–20px (`p-3`–`p-5`). Section rhythm: 40–48px (`py-10`–`py-12`).
- **Widths:** `max-w-reading` 42rem (text, result lists), `max-w-page` 72rem (standard pages), `w-sidebar` 15.5rem (expanded sidebar).
- **Gutters:** 16px on mobile (`px-4`), 24px from `sm` (`px-6`).

### Breakpoints

Tailwind defaults: `sm` 640, `md` 768, `lg` 1024, `xl` 1280.

| Range    | Behaviour                                                                      |
| -------- | ------------------------------------------------------------------------------ |
| < 768    | Single column. Sidebar becomes a sheet (_Planned_). Hero search is full-width. |
| 768–1023 | Single column with wider gutters. Optional collapsed sidebar.                  |
| ≥ 1024   | Persistent sidebar, multi-column grids where helpful.                          |

There must be no horizontal page scroll at any width ≥ 320px.

---

## 5. Radius

Restrained. Pills (`rounded-full`) only for avatars, toggles, and progress tracks.

| Token        | Value | Use                                   |
| ------------ | ----- | ------------------------------------- |
| `rounded-xs` | 3px   | Kbd, inline highlights                |
| `rounded-sm` | 4px   | Badges, chips, pattern code           |
| `rounded-md` | 6px   | Buttons, inputs, nav items, callouts  |
| `rounded-lg` | 8px   | Cards, menus, standard search         |
| `rounded-xl` | 12px  | Dialogs, command palette, hero search |

---

## 6. Elevation

Borders do most of the separating work. Shadows are warm-tinted (`rgb(31 30 27 / …)`) and low.

| Token       | Use                            |
| ----------- | ------------------------------ |
| `shadow-xs` | Resting cards, inputs, buttons |
| `shadow-sm` | Hovered cards                  |
| `shadow-md` | Menus, tooltips                |
| `shadow-lg` | Dialogs, command palette       |

No coloured glows and no stacked heavy shadows. Use backdrop blur only on the sticky header (`backdrop-blur-sm`), never as a glass effect.

---

## 7. Motion

| Token                   | Utility                      | Use                                     |
| ----------------------- | ---------------------------- | --------------------------------------- |
| `--duration-fast` 120ms | `duration-120`               | Hover, press, colour changes            |
| `--duration-base` 180ms | `duration-180`               | Popovers, tabs, small reveals, overlays |
| `--duration-slow` 240ms | `duration-240`               | Dialogs, side panels                    |
| `ease-standard`         | `cubic-bezier(0.2, 0, 0, 1)` | Everything (one curve)                  |

- Motion explains change. It never decorates. No bouncing, parallax, or looping animation (except loading skeletons).
- Press feedback: 1px translate on buttons.
- `prefers-reduced-motion: reduce` disables animations globally (see `globals.css`).

---

## 8. Components

Legend: ✅ built in Phase 0 · 🔜 _Planned_ (spec below is intent).

### 8.1 Button ✅ `ui/button`

| Variant       | Use                                                                     |
| ------------- | ----------------------------------------------------------------------- |
| `default`     | The single primary action in a view (charcoal)                          |
| `ink`         | Brand-forward action used sparingly (onboarding, "Start practice" hero) |
| `outline`     | Secondary actions                                                       |
| `secondary`   | Tertiary, filled-quiet                                                  |
| `ghost`       | Toolbar and icon actions, in-card actions                               |
| `destructive` | Destructive confirmation only                                           |
| `link`        | Inline navigation                                                       |

Sizes: `xs` 24px, `sm` 28px, `default` 32px, `lg` 36px, plus `icon`, `icon-sm`, `icon-xs`, and `icon-lg`. Icon-only buttons **must** have an `aria-label`. Focus is a 2px ink ring with a 2px canvas offset. Mark inline icons with `data-icon="inline-start|inline-end"`.

### 8.2 Input ✅ `ui/input`

36px tall on a white surface, 3:1 `border-input` edge, `rounded-md`. On focus: ink border plus a soft ink ring. Invalid state: `aria-invalid` with a danger border, and the message is linked via `aria-describedby`. Text is 16px on mobile (prevents iOS zoom) and 14px from `md`. Always pair with a visible `<label>`.

### 8.3 Search field ✅ `lexora/search-field`

- `size="lg"`: Language Finder hero. 56px tall, `rounded-xl`, `shadow-sm`, 18px text, search icon, optional trailing hint (`<Kbd>/</Kbd>`).
- `size="md"`: in-page filtering. 36px tall.
- It always has an accessible label (visually hidden). The placeholder is phrased as a prompt ("What do you want to say?"), not as the label.
- It's presentational for now. Query state and behaviour arrive in Phase 4.

### 8.4 Badges ✅ `ui/badge`, `lexora/category-badge`, `lexora/tag-badge`

- `Badge`: generic status (`default`, `secondary`, `ink`, `outline`, `destructive`). 20px tall, `rounded-sm`.
- `CategoryBadge`: the kind of language. Variants are `soft` (tinted chip) and `dot` (quiet inline label for dense lists).
- `TagBadge`: register and skill context. Neutral fill; skill tags carry an icon (pen = writing, speech bubble = speaking).

### 8.5 Kbd ✅ `lexora/kbd`

20px, mono 11px, `rounded-xs`, white with a strong border. Show shortcuts with platform-appropriate glyphs (⌘ on macOS, Ctrl elsewhere) once platform detection exists.

### 8.6 Card ✅ `ui/card`

Generic container: white, 1px `border`, `rounded-lg`, `shadow-xs`. Prefer a specific pattern (result card, practice card) when one exists. Don't nest cards.

### 8.7 Language result card ✅ `lexora/language-result-card`

The core unit of the Finder. Anatomy, top to bottom:

1. `CategoryBadge`
2. **Term** in `type-term` (serif)
3. **Meaning**, one line, in `type-body` muted
4. **Pattern** (optional) in a mono chip on `bg-muted`
5. **Example** (optional) as a serif blockquote with a left rule; the term is highlighted with `ink-soft`
6. **Note** (optional) in caption: common mistakes, strength, register warnings
7. **Tags**: register and skill

The save action is a ghost icon button (bookmark) top-right with `aria-pressed`; when saved it uses the ink colour and a filled-check icon. It's hidden when no handler is passed. Hover raises the border to `border-strong` and the shadow to `sm`.

### 8.8 Empty state ✅ `lexora/empty-state`

Dashed `border-strong` frame, a muted icon tile, a title, one sentence, and usually one action. Explain what will appear and how to get there. Don't apologise and don't use illustrations.

### 8.9 Callout ✅ `lexora/callout`

Inline feedback with a tone fill, icon, title, and body. Use it for practice results, audit findings, and form-level messages. Pass `role="status"` or `role="alert"` when it appears dynamically.

### 8.10 Page header ✅ `lexora/page-header`

Optional overline, then the serif title (`type-title`, or `type-display` at ≥ sm), a reading-width description, and actions aligned right (stacked on mobile).

### 8.11 Navigation item ✅ `lexora/nav-item`

32px row, 16px icon, `type-label`. Hover uses `bg-accent`. Active uses `bg-accent` + foreground text + an **ink icon**, with `aria-current="page"`. An optional trailing count is mono and tabular.

### 8.12 Tabs ✅ `ui/tabs`

`default` (segmented, on `bg-muted`) switches views of the same content, e.g. Writing / Speaking. `line` handles page-level sections.

### 8.13 Overlays ✅ `ui/tooltip`, `ui/dropdown-menu`, `ui/dialog`

- **Tooltip:** charcoal, 12px, 300ms delay. Use it for icon-button names and shortcuts, never for essential information.
- **Menu:** white, `border`, `shadow-md`, `rounded-lg`. Items highlight with `bg-accent`.
- **Dialog:** `rounded-xl`, `shadow-lg`, `max-w-md`, with a charcoal 20% overlay and **no blur**. A footer on `bg-muted/50` holds actions (cancel left of confirm).

### 8.14 Command palette ✅ `ui/command` (cmdk)

Opens with ⌘K / Ctrl+K and appears at roughly a third of viewport height, `max-w-xl`. The input row is borderless with a bottom divider. Group headings use caption muted. The selected item uses `bg-accent`. Shortcuts are mono, subtle, and right-aligned. A footer hint row is allowed. It will be the universal entry point: search language, jump to a page, run actions.

### 8.15 Skeleton ✅ `ui/skeleton`

`bg-muted` blocks that mirror the final layout, with a pulse. Wrap the group in `role="status"` with an `aria-label`. Don't use spinners for content areas; spinners are acceptable only inside buttons.

### 8.16 Sidebar 🔜 _Phase 1_

`bg-sidebar`, `w-sidebar` (248px), `border-r`. Top: workspace and logo, then a search trigger that opens the palette. Primary nav: Home, Language Finder, Language bank, Practice, Writing Lab, Speaking Lab, Progress. Bottom: settings and profile. Collapsible to icons at `lg`; becomes a sheet below `md`.

### 8.17 Tables 🔜 _Phase 5_

Used for the language bank and mistakes. No vertical rules. The header row is `type-caption` muted on `bg-background` with a `border-strong` bottom. Rows are 44px with a `border` divider, and hover uses `bg-accent`. Numeric columns are tabular and right-aligned.

### 8.18 Practice card 🔜 _Phase 6_

A focused, single-task card centred at reading width. The prompt is in serif. Answer options are full-width outline rows (selected: ink border + `ink-soft`; correct: success; incorrect: danger, with the correct answer revealed). Progress is a thin top track. Keyboard: 1–4 to choose, Enter to submit or continue.

### 8.19 Language detail 🔜 _Phase 1 (mock) / Phase 3_

The term in `type-display`, then tabs: Overview · Examples · Collocations · Mistakes · Practice. Relationship lists (stronger/weaker, formal/natural alternatives) appear as compact rows with category dots.

### 8.20 Writing Lab annotations 🔜 _Phase 7_

Inline underlines in the editor: wavy `warning` for repetition, solid `danger` for preposition and collocation errors, dotted `info` for suggestions. Hovering or focusing shows a popover with a suggestion and a one-click apply.

### 8.21 Toasts 🔜

Bottom-right on desktop, top on mobile, at most one at a time, auto-dismissing after 4s. Use them only for confirmations of user-initiated actions ("Saved to language bank"), with an Undo when reversible.

---

## 9. States checklist

Every data-backed view ships with:

- **Empty:** first use, and no results.
- **Loading:** a skeleton that matches the layout.
- **Error:** a danger callout with a retry, in plain language.
- **Partial:** stale data, or offline where relevant.
- **Disabled:** `opacity-50`, `pointer-events-none`, and an explanation nearby if it isn't obvious.

---

## 10. Accessibility

- Contrast is WCAG 2.1 AA minimum (verified for all tokens above).
- Every interactive element has a **visible focus** state (ink ring).
- Target size is ≥ 24×24px (WCAG 2.2), and the primary touch targets on mobile are ≥ 36px.
- Colour is never the only signal (labels, icons, text).
- Radix primitives provide focus trapping, ARIA, and keyboard behaviour. Don't break them when restyling.
- Use landmarks (`header`, `nav`, `main`), one `h1` per page, and a logical heading order.
- `lang="en"` is set on the root. Learner-facing English content can later carry `lang` per example if mixed languages appear.
- `prefers-reduced-motion` is respected globally.

---

## 11. Changing the system

1. Propose the change here (a new token or component spec).
2. Implement it in `tokens.css` / `typography.css` / the component.
3. Update `/design-system` so the change is visible.
4. Check contrast for any new colour pair.
