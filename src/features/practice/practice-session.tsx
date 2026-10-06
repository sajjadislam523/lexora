"use client";

import { ArrowLeft, ArrowRight, CircleCheck, CircleDot, CircleX, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Callout, type CalloutTone } from "@/components/lexora/callout";
import { ChoiceOption, type ChoiceState } from "@/components/lexora/choice-option";
import { GapSentence } from "@/components/lexora/gap-sentence";
import { LanguageRow } from "@/components/lexora/language-row";
import { PageHeader } from "@/components/lexora/page-header";
import { ProgressTrack } from "@/components/lexora/progress-track";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getLanguageItem } from "@/demo/language";
import {
  PRACTICE_SESSION,
  type ChoiceQuestion,
  type MultiQuestion,
  type PracticeQuestion,
  type TypedQuestion,
  type Verdict,
} from "@/demo/practice";

type Answer =
  | { kind: "choice"; optionId: string; verdict: Verdict }
  | { kind: "typed"; value: string; verdict: Verdict; explanation: string }
  | { kind: "multi"; selected: string[]; verdict: Verdict };

const VERDICT_CALLOUT: Record<Verdict, { tone: CalloutTone; title: string }> = {
  correct: { tone: "success", title: "Correct" },
  acceptable: { tone: "info", title: "Also natural" },
  incorrect: { tone: "danger", title: "Not quite" },
};

const TOTAL = PRACTICE_SESSION.length;

/* ── Question bodies ───────────────────────────────────────────── */

function ChoiceBody({
  question,
  answer,
  onAnswer,
}: {
  question: ChoiceQuestion;
  answer?: Extract<Answer, { kind: "choice" }>;
  onAnswer: (answer: Answer) => void;
}) {
  const chosen = question.options.find((o) => o.id === answer?.optionId);
  const best = question.options.find((o) => o.verdict === "correct");

  function stateFor(id: string, verdict: Verdict): ChoiceState {
    if (!answer) return "idle";
    if (id === answer.optionId) return verdict;
    if (verdict === "correct") return "revealed";
    return "dimmed";
  }

  return (
    <div className="space-y-5">
      {question.parts ? (
        <div className="rounded-md bg-muted px-4 py-4">
          <GapSentence
            parts={question.parts}
            fills={chosen ? [chosen.label] : undefined}
            tone={answer?.verdict === "incorrect" ? "danger" : "highlight"}
          />
        </div>
      ) : null}
      <div role="group" aria-label="Answers" className="space-y-2">
        {question.options.map((option, i) => (
          <ChoiceOption
            key={option.id}
            shortcut={i + 1}
            language={question.optionsAreLanguage}
            state={stateFor(option.id, option.verdict)}
            disabled={Boolean(answer)}
            onClick={() =>
              onAnswer({ kind: "choice", optionId: option.id, verdict: option.verdict })
            }
          >
            {option.label}
          </ChoiceOption>
        ))}
      </div>
      {answer && chosen ? (
        <Feedback verdict={answer.verdict} focusSlug={question.focusSlug}>
          {chosen.explanation}
          {answer.verdict !== "correct" && best ? (
            <span className="mt-1 block">
              Best answer: <span className="font-semibold">{best.label}</span>
            </span>
          ) : null}
        </Feedback>
      ) : null}
    </div>
  );
}

function TypedBody({
  question,
  answer,
  onAnswer,
}: {
  question: TypedQuestion;
  answer?: Extract<Answer, { kind: "typed" }>;
  onAnswer: (answer: Answer) => void;
}) {
  const [value, setValue] = useState("");

  function check() {
    const normalised = value.trim().toLowerCase();
    if (!normalised) return;
    const match = question.accepted.find((a) => a.answer === normalised);
    onAnswer({
      kind: "typed",
      value: normalised,
      verdict: match?.verdict ?? "incorrect",
      explanation: match?.explanation ?? question.wrongExplanation,
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-md bg-muted px-4 py-4">
        <GapSentence
          parts={question.parts}
          fills={answer ? [answer.value] : undefined}
          tone={answer?.verdict === "incorrect" ? "danger" : "highlight"}
        />
      </div>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          check();
        }}
      >
        <label htmlFor="typed-answer" className="sr-only">
          Missing preposition
        </label>
        <Input
          id="typed-answer"
          size="lg"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Type your answer"
          value={answer ? answer.value : value}
          onChange={(event) => setValue(event.target.value)}
          disabled={Boolean(answer)}
          className="max-w-56"
          autoFocus
        />
        <Button type="submit" size="lg" disabled={Boolean(answer) || !value.trim()}>
          Check
        </Button>
      </form>
      {answer ? (
        <Feedback verdict={answer.verdict} focusSlug={question.focusSlug}>
          {answer.explanation}
          {answer.verdict === "incorrect" ? (
            <span className="mt-1 block">
              Answer: <span className="font-semibold">{question.answer}</span>
            </span>
          ) : null}
        </Feedback>
      ) : null}
    </div>
  );
}

function MultiBody({
  question,
  answer,
  draft,
  onToggle,
}: {
  question: MultiQuestion;
  answer?: Extract<Answer, { kind: "multi" }>;
  draft: string[];
  onToggle: (label: string) => void;
}) {
  function stateFor(label: string, correct: boolean): ChoiceState {
    const selected = (answer?.selected ?? draft).includes(label);
    if (!answer) return selected ? "selected" : "idle";
    if (selected) return correct ? "correct" : "incorrect";
    return correct ? "revealed" : "dimmed";
  }

  const missed = answer
    ? question.options
        .filter((o) => o.correct && !answer.selected.includes(o.label))
        .map((o) => o.label)
    : [];

  return (
    <div className="space-y-5">
      <p className="type-term text-foreground">
        {question.head} <span className="text-subtle-foreground">+ …</span>
      </p>
      <div role="group" aria-label="Nouns" className="grid gap-2 sm:grid-cols-2">
        {question.options.map((option, i) => (
          <ChoiceOption
            key={option.label}
            shortcut={i + 1}
            language
            pressed={answer ? undefined : draft.includes(option.label)}
            state={stateFor(option.label, option.correct)}
            disabled={Boolean(answer)}
            onClick={() => onToggle(option.label)}
          >
            {question.head} {option.label}
          </ChoiceOption>
        ))}
      </div>
      {answer ? (
        <Feedback
          verdict={answer.verdict}
          focusSlug={question.focusSlug}
          titleOverride={answer.verdict === "acceptable" ? "Nearly there" : undefined}
        >
          {question.explanation}
          {missed.length > 0 ? (
            <span className="mt-1 block">Also correct: {missed.join(", ")}.</span>
          ) : null}
        </Feedback>
      ) : null}
    </div>
  );
}

function Feedback({
  verdict,
  focusSlug,
  titleOverride,
  children,
}: {
  verdict: Verdict;
  focusSlug?: string;
  titleOverride?: string;
  children: React.ReactNode;
}) {
  const config = VERDICT_CALLOUT[verdict];
  const item = focusSlug ? getLanguageItem(focusSlug) : undefined;
  return (
    <Callout role="status" tone={config.tone} title={titleOverride ?? config.title}>
      {children}
      {item ? (
        <Link
          href={`/language/${item.slug}`}
          className="mt-2 inline-flex items-center gap-1 type-label text-ink hover:underline"
        >
          How to use “{item.term.replace(/,$/, "")}”
          <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      ) : null}
    </Callout>
  );
}

/* ── Intro and summary ─────────────────────────────────────────── */

function Intro({ onStart }: { onStart: (index: number) => void }) {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Practice"
        title="Today’s session"
        description="Five short questions built from your language bank. The goal is to retrieve the language you need — not to recognise a definition."
      />
      <ol className="divide-y divide-border-subtle rounded-lg border border-border bg-card">
        {PRACTICE_SESSION.map((question, i) => (
          <li key={question.id}>
            <button
              type="button"
              onClick={() => onStart(i)}
              className="flex w-full cursor-pointer items-center gap-4 px-4 py-3.5 text-left transition-colors duration-120 outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted type-micro text-muted-foreground">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block type-label text-foreground">{question.mode}</span>
                <span className="block type-caption text-muted-foreground">{question.purpose}</span>
              </span>
              <ArrowRight aria-hidden className="size-4 shrink-0 text-subtle-foreground" />
            </button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button size="lg" onClick={() => onStart(0)}>
          Start session
          <ArrowRight data-icon="inline-end" />
        </Button>
        <p className="type-caption text-subtle-foreground">
          About 4 minutes · Prototype — results aren&apos;t saved.
        </p>
      </div>
    </div>
  );
}

function Summary({
  answers,
  onRestart,
}: {
  answers: Record<string, Answer>;
  onRestart: () => void;
}) {
  const retrieved = PRACTICE_SESSION.filter((q) => {
    const verdict = answers[q.id]?.verdict;
    return verdict === "correct" || verdict === "acceptable";
  }).length;
  const revisit = PRACTICE_SESSION.filter(
    (q) => answers[q.id]?.verdict !== "correct" && q.focusSlug,
  )
    .map((q) => getLanguageItem(q.focusSlug!))
    .filter((item) => item !== undefined);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Session complete"
        title={`You retrieved ${retrieved} of ${TOTAL}`}
        description="Language you found harder will come back sooner. In the full product this schedule is personal to you."
      />
      <ul className="divide-y divide-border-subtle rounded-lg border border-border bg-card">
        {PRACTICE_SESSION.map((question) => {
          const verdict = answers[question.id]?.verdict;
          const Icon =
            verdict === "correct" ? CircleCheck : verdict === "acceptable" ? CircleDot : CircleX;
          const label =
            verdict === "correct"
              ? "Correct"
              : verdict === "acceptable"
                ? "Nearly"
                : verdict
                  ? "Not yet"
                  : "Skipped";
          return (
            <li key={question.id} className="flex items-center gap-3 px-4 py-3">
              <Icon
                aria-hidden
                className={
                  verdict === "correct"
                    ? "size-4 text-success"
                    : verdict === "acceptable"
                      ? "size-4 text-ink"
                      : "size-4 text-subtle-foreground"
                }
              />
              <span className="min-w-0 flex-1 type-body text-foreground">{question.mode}</span>
              <span className="type-caption text-muted-foreground">{label}</span>
            </li>
          );
        })}
      </ul>
      {revisit.length > 0 ? (
        <section aria-labelledby="revisit-title" className="space-y-3">
          <h2 id="revisit-title" className="type-subheading text-foreground">
            Worth revisiting
          </h2>
          <div className="rounded-lg border border-border bg-card p-1">
            {revisit.map((item) => (
              <LanguageRow
                key={item.slug}
                href={`/language/${item.slug}`}
                term={item.term}
                category={item.category}
                context={item.bestWhen}
              />
            ))}
          </div>
        </section>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onRestart}>
          <RotateCcw data-icon="inline-start" />
          Practise again
        </Button>
        <Button asChild variant="ghost">
          <Link href="/home">Back to Home</Link>
        </Button>
        <p className="w-full type-caption text-subtle-foreground">
          Prototype — results aren&apos;t saved anywhere.
        </p>
      </div>
    </div>
  );
}

/* ── Session ───────────────────────────────────────────────────── */

/**
 * The practice prototype: a fixed five-question session with immediate, explained feedback.
 * Keyboard: 1–9 choose, Enter checks or continues. Nothing is stored.
 */
export function PracticeSession({ initialStep }: { initialStep?: number }) {
  const startIndex =
    initialStep && initialStep >= 1 && initialStep <= TOTAL ? initialStep - 1 : undefined;
  const [phase, setPhase] = useState<"intro" | "question" | "summary">(
    startIndex === undefined ? "intro" : "question",
  );
  const [index, setIndex] = useState(startIndex ?? 0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [multiDraft, setMultiDraft] = useState<string[]>([]);
  const continueRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const question: PracticeQuestion = PRACTICE_SESSION[index]!;
  const answer = answers[question.id];

  const answerQuestion = useCallback(
    (value: Answer) => setAnswers((current) => ({ ...current, [question.id]: value })),
    [question.id],
  );

  const goTo = useCallback((next: number) => {
    setMultiDraft([]);
    if (next >= TOTAL) setPhase("summary");
    else {
      setIndex(next);
      setPhase("question");
    }
  }, []);

  const checkMulti = useCallback(() => {
    if (question.kind !== "multi" || multiDraft.length === 0) return;
    const wrong = multiDraft.some(
      (label) => !question.options.find((o) => o.label === label)?.correct,
    );
    const allCorrect = question.options
      .filter((o) => o.correct)
      .every((o) => multiDraft.includes(o.label));
    answerQuestion({
      kind: "multi",
      selected: multiDraft,
      verdict: wrong ? "incorrect" : allCorrect ? "correct" : "acceptable",
    });
  }, [question, multiDraft, answerQuestion]);

  // Move focus to Continue once answered, and to the question heading on a new question.
  useEffect(() => {
    if (phase !== "question") return;
    if (answer) continueRef.current?.focus();
  }, [answer, phase]);

  useEffect(() => {
    // Typed questions focus their input instead.
    if (phase === "question" && PRACTICE_SESSION[index]?.kind !== "typed")
      headingRef.current?.focus();
  }, [index, phase]);

  // Number keys choose; Enter checks or continues.
  useEffect(() => {
    if (phase !== "question") return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea") || event.metaKey || event.ctrlKey || event.altKey)
        return;
      const number = Number(event.key);
      if (!answer && Number.isInteger(number) && number >= 1) {
        if (question.kind === "choice") {
          const option = question.options[number - 1];
          if (option)
            answerQuestion({ kind: "choice", optionId: option.id, verdict: option.verdict });
        } else if (question.kind === "multi") {
          const option = question.options[number - 1];
          if (option)
            setMultiDraft((d) =>
              d.includes(option.label) ? d.filter((l) => l !== option.label) : [...d, option.label],
            );
        }
      } else if (event.key === "Enter" && !target.closest("button, a")) {
        // Focus moves to Continue during this keypress; stop the browser from activating it too.
        event.preventDefault();
        if (answer) goTo(index + 1);
        else if (question.kind === "multi") checkMulti();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [phase, answer, question, index, answerQuestion, goTo, checkMulti]);

  const restart = () => {
    setAnswers({});
    setMultiDraft([]);
    setIndex(0);
    setPhase("intro");
  };

  return (
    <PageContainer>
      <div className="mx-auto max-w-reading">
        {phase === "intro" ? <Intro onStart={goTo} /> : null}
        {phase === "summary" ? <Summary answers={answers} onRestart={restart} /> : null}
        {phase === "question" ? (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="type-caption text-muted-foreground">
                  Question {index + 1} of {TOTAL}
                  <span className="text-subtle-foreground"> · {question.mode}</span>
                </p>
                <Button variant="ghost" size="sm" onClick={() => setPhase("summary")}>
                  End session
                </Button>
              </div>
              <ProgressTrack
                value={index + (answer ? 1 : 0)}
                max={TOTAL}
                label="Session progress"
              />
            </div>

            <section
              aria-labelledby="question-prompt"
              className="space-y-5 rounded-lg border border-border bg-card p-5 sm:p-8"
            >
              <h1
                id="question-prompt"
                ref={headingRef}
                tabIndex={-1}
                className="type-subheading text-foreground outline-none"
              >
                {question.prompt}
              </h1>
              {question.kind === "choice" ? (
                <ChoiceBody
                  key={question.id}
                  question={question}
                  answer={answer?.kind === "choice" ? answer : undefined}
                  onAnswer={answerQuestion}
                />
              ) : null}
              {question.kind === "typed" ? (
                <TypedBody
                  key={question.id}
                  question={question}
                  answer={answer?.kind === "typed" ? answer : undefined}
                  onAnswer={answerQuestion}
                />
              ) : null}
              {question.kind === "multi" ? (
                <MultiBody
                  key={question.id}
                  question={question}
                  answer={answer?.kind === "multi" ? answer : undefined}
                  draft={multiDraft}
                  onToggle={(label) =>
                    setMultiDraft((d) =>
                      d.includes(label) ? d.filter((l) => l !== label) : [...d, label],
                    )
                  }
                />
              ) : null}
            </section>

            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" onClick={() => goTo(index - 1)} disabled={index === 0}>
                <ArrowLeft data-icon="inline-start" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                {!answer ? (
                  <Button variant="ghost" onClick={() => goTo(index + 1)}>
                    Skip
                  </Button>
                ) : null}
                {question.kind === "multi" && !answer ? (
                  <Button onClick={checkMulti} disabled={multiDraft.length === 0}>
                    Check
                  </Button>
                ) : (
                  <Button ref={continueRef} onClick={() => goTo(index + 1)} disabled={!answer}>
                    {index + 1 === TOTAL ? "Finish" : "Continue"}
                    <ArrowRight data-icon="inline-end" />
                  </Button>
                )}
              </div>
            </div>
            <p className="text-center type-caption text-subtle-foreground max-sm:hidden">
              {question.kind === "typed"
                ? "Type your answer · Enter to check"
                : `Press 1–${question.options.length} to choose · Enter to ${question.kind === "multi" && !answer ? "check" : "continue"}`}
            </p>
          </div>
        ) : null}
      </div>
    </PageContainer>
  );
}
