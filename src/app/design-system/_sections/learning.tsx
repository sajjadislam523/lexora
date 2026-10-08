"use client";

import { useState } from "react";

import { ChoiceOption, type ChoiceState } from "@/components/lexora/choice-option";
import { FitBadge } from "@/components/lexora/fit-badge";
import { GapSentence } from "@/components/lexora/gap-sentence";
import { HighlightedText } from "@/components/lexora/highlighted-text";
import { LanguageRow } from "@/components/lexora/language-row";
import { MistakeRow } from "@/components/lexora/mistake-row";
import { ProgressTrack } from "@/components/lexora/progress-track";
import { SkillComparison } from "@/components/lexora/skill-comparison";
import { StrengthMeter } from "@/components/lexora/strength-meter";

import { Section, Specimen } from "./section";

const CHOICE_STATES: { state: ChoiceState; label: string }[] = [
  { state: "idle", label: "idle" },
  { state: "selected", label: "selected" },
  { state: "correct", label: "correct" },
  { state: "acceptable", label: "acceptable (also natural)" },
  { state: "incorrect", label: "incorrect" },
  { state: "revealed", label: "revealed (best answer)" },
  { state: "dimmed", label: "dimmed" },
];

const GAP_PARTS = [
  "Governments should ",
  { gap: 0 },
  " more money ",
  { gap: 1 },
  " public transport.",
];

export function LearningSection() {
  const [filled, setFilled] = useState(false);

  return (
    <Section
      id="learning"
      eyebrow="Components"
      title="Learning patterns"
      description="The components behind the Finder, Practice and language pages. Static sample content."
    >
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        <Specimen
          title="Gap sentence"
          note="Empty slots are underlined; filled slots use the highlighter."
        >
          <div className="space-y-4">
            <div className="rounded-md bg-muted px-4 py-4">
              <GapSentence parts={GAP_PARTS} fills={filled ? ["allocate", "to"] : undefined} />
            </div>
            <div className="rounded-md bg-muted px-4 py-4">
              <GapSentence
                parts={["People often depend ", { gap: 0 }, " public transport."]}
                fills={["of"]}
                tone="danger"
              />
            </div>
            <button
              type="button"
              onClick={() => setFilled((v) => !v)}
              className="type-label text-ink hover:underline"
            >
              {filled ? "Clear the first sentence" : "Fill the first sentence"}
            </button>
          </div>
        </Specimen>

        <Specimen title="Highlighted text" note="The target term in context.">
          <p className="type-example text-foreground">
            <HighlightedText
              text="There has been a significant increase in the number of people using public transport."
              highlight="significant"
            />
          </p>
        </Specimen>
      </div>

      <Specimen
        title="Choice option"
        note="Answer rows for practice and context choices. Verdicts use colour, an icon and hidden text."
      >
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {CHOICE_STATES.map(({ state, label }, i) => (
            <ChoiceOption key={state} state={state} shortcut={i + 1} tabIndex={-1}>
              {label}
            </ChoiceOption>
          ))}
          <ChoiceOption state="idle" language tabIndex={-1}>
            I strongly agree with this argument because… (language voice)
          </ChoiceOption>
        </div>
      </Specimen>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        <Specimen title="Fit, strength & progress">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <FitBadge fit="fits" />
              <FitBadge fit="different_preposition" />
              <FitBadge fit="unlikely" />
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <StrengthMeter strength={1} />
              <StrengthMeter strength={2} />
              <StrengthMeter strength={3} />
            </div>
            <div className="space-y-1.5">
              <ProgressTrack value={4} max={12} label="Sample progress" />
              <p className="type-caption text-muted-foreground">4 of 12 reviewed today</p>
            </div>
          </div>
        </Specimen>

        <Specimen
          title="Writing vs speaking"
          note="Side by side from sm; a segmented switch on mobile."
        >
          <SkillComparison
            writing={{
              text: "Furthermore, this approach reduces congestion.",
              highlight: "Furthermore,",
            }}
            speaking={{
              text: "On top of that, it's just easier to get around.",
              highlight: "On top of that,",
            }}
          />
        </Specimen>
      </div>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        <Specimen title="Language row" note="Usage line, not a definition." className="p-1 sm:p-1">
          <LanguageRow
            href="/language/significant"
            term="significant"
            category="synonym"
            context="Use it with measurable change: “a significant increase in…”"
            status="learning"
          />
          <LanguageRow
            href="/language/depend-on"
            term="depend on"
            category="preposition"
            context="Always on — “many people depend on buses”"
            status="due"
          />
        </Specimen>

        <Specimen title="Mistake row" note="A correction with a next step." className="p-0 sm:p-0">
          <MistakeRow
            type="Preposition"
            wrong="depend of"
            right="depend on"
            why="Depend always takes on."
            action={{ label: "Practise", href: "/practice?step=3" }}
          />
        </Specimen>
      </div>
    </Section>
  );
}
