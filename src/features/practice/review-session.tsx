"use client";

import { ArrowRight, CircleCheck, CircleX, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Callout } from "@/components/lexora/callout";
import { ChoiceOption, type ChoiceState } from "@/components/lexora/choice-option";
import { GapSentence, type GapPart } from "@/components/lexora/gap-sentence";
import { PageHeader } from "@/components/lexora/page-header";
import { ProgressTrack } from "@/components/lexora/progress-track";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ExerciseType } from "@/learning/exercises";
import { nextReviewText } from "@/learning/status";
import type { ReviewFeedback, ReviewItem, ReviewPrompt } from "@/server/learning/review";

const MODE: Record<ExerciseType, string> = {
  term: "Complete the sentence",
  preposition: "Type the preposition",
  mistake: "Which is correct?",
};

/** Why an answer was skipped (a 409): shown, then the next item. Never counted. */
const NOTICES: Record<string, string> = {
  stale: "This item was already reviewed.",
  not_due: "This item isn’t due any more.",
  exercise_changed: "This exercise changed, so it was skipped.",
  retired: "This meaning is no longer reviewed.",
  not_saved: "This meaning isn’t in your language bank any more.",
};

type Step =
  | { phase: "answering" | "pending"; error?: string; signedOut?: boolean }
  | { phase: "answered"; answer: string; feedback: ReviewFeedback }
  | { phase: "skipped"; notice: string };

type Result = { item: ReviewItem; feedback: ReviewFeedback };

function gapParts(prompt: ReviewPrompt): GapPart[] {
  return (prompt.sentence ?? []).map((part) => (typeof part === "string" ? part : { gap: 0 }));
}

/** "There was a … increase": the sentence with its blank, for the answer field's label. */
function sentenceText(prompt: ReviewPrompt) {
  return (prompt.sentence ?? []).map((part) => (typeof part === "string" ? part : "…")).join("");
}

type Sent =
  | { ok: true; feedback: ReviewFeedback }
  | { ok: false; skip?: string; error?: string; signedOut?: boolean };

async function send(item: ReviewItem, answer: string): Promise<Sent> {
  let response: Response;
  try {
    response = await fetch("/api/review/answers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        senseId: item.senseId,
        exerciseId: item.prompt.id,
        expectedReviews: item.expectedReviews,
        answer,
      }),
    });
  } catch {
    return { ok: false, error: "Your answer wasn’t saved. Try again." };
  }
  if (response.ok) return { ok: true, feedback: (await response.json()) as ReviewFeedback };
  const { error } = (await response.json().catch(() => ({}))) as { error?: string };
  if (response.status === 401) {
    return { ok: false, signedOut: true, error: "Your session ended. Sign in to continue." };
  }
  if (response.status === 429) {
    return { ok: false, error: "You’re going a little fast. Try again in a moment." };
  }
  if (response.status === 400 && error === "invalid_answer") {
    return {
      ok: false,
      error: item.prompt.type === "mistake" ? "Choose one of the two." : "Type a word to check it.",
    };
  }
  if ((response.status === 409 || response.status === 404) && error && NOTICES[error]) {
    return { ok: false, skip: NOTICES[error] };
  }
  return { ok: false, error: "Your answer wasn’t saved. Try again." };
}

/* ── Feedback ──────────────────────────────────────────────────── */

function Feedback({ feedback, prompt }: { feedback: ReviewFeedback; prompt: ReviewPrompt }) {
  const correct = feedback.outcome === "correct";
  return (
    <Callout
      role="status"
      tone={correct ? "success" : "danger"}
      title={correct ? "Correct" : "Not quite"}
    >
      <div className="space-y-1.5">
        {correct && feedback.match === "form" ? (
          <p>
            In this sentence: <span className="font-semibold">{feedback.expected}</span>
          </p>
        ) : null}
        {correct && feedback.match === "accepted" ? (
          <p>
            Also natural here. You saved <span className="font-semibold">“{feedback.term}”</span>.
          </p>
        ) : null}
        {!correct ? (
          <p>
            {prompt.type === "mistake" ? "The correct version: " : "Lexora was looking for "}
            <span className="font-semibold">{feedback.expected}</span>
            {prompt.type === "mistake" ? "" : "."}
          </p>
        ) : null}
        {feedback.pattern ? <p className="type-mono">{feedback.pattern}</p> : null}
        {feedback.explanation ? <p>{feedback.explanation}</p> : null}
        {feedback.match === "unrecognised" ? (
          <p className="text-muted-foreground">
            Lexora checks answers only against the language it has written down.
          </p>
        ) : null}
        {feedback.accepted.length > 0 && feedback.match !== "accepted" ? (
          <p className="text-muted-foreground">
            Also accepted here: {feedback.accepted.join(", ")}.
          </p>
        ) : null}
        <p className="text-muted-foreground">{nextReviewText(feedback.nextReview)}.</p>
        {feedback.href ? (
          <Link
            href={feedback.href}
            className="inline-flex items-center gap-1 type-label text-ink hover:underline"
          >
            How to use “{feedback.term}”
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        ) : null}
      </div>
    </Callout>
  );
}

/* ── Exercise bodies ───────────────────────────────────────────── */

function TypedBody({
  prompt,
  step,
  inputRef,
  onSubmit,
}: {
  prompt: ReviewPrompt;
  step: Step;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSubmit: (answer: string) => void;
}) {
  const [value, setValue] = useState("");
  const answered = step.phase === "answered" ? step : null;
  const locked = step.phase !== "answering";
  const fill = answered
    ? answered.feedback.outcome === "correct"
      ? answered.feedback.expected
      : answered.answer
    : undefined;
  const what =
    prompt.type === "preposition"
      ? "Missing preposition"
      : (prompt.blankWords ?? 1) > 1
        ? "Missing words"
        : "Missing word";

  return (
    <div className="space-y-5">
      {prompt.type === "preposition" ? (
        <p className="type-mono text-muted-foreground">{prompt.cue}</p>
      ) : (
        <p className="type-body text-muted-foreground">
          {prompt.senseLabel ? (
            <span className="text-foreground">{prompt.senseLabel}: </span>
          ) : null}
          {prompt.cue}
        </p>
      )}
      <div className="rounded-md bg-muted px-4 py-4">
        <GapSentence
          parts={gapParts(prompt)}
          fills={fill ? [fill] : undefined}
          tone={answered?.feedback.outcome === "incorrect" ? "danger" : "highlight"}
        />
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!locked && value.trim()) onSubmit(value);
        }}
      >
        <label htmlFor="review-answer" className="sr-only">
          {what} in: {sentenceText(prompt)}
        </label>
        <Input
          ref={inputRef}
          id="review-answer"
          size="lg"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={80}
          placeholder="Type your answer"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          readOnly={locked}
          aria-describedby={prompt.blankWords && prompt.blankWords > 1 ? "review-words" : undefined}
          className="min-w-0 flex-1 sm:max-w-72"
        />
        <Button type="submit" size="lg" disabled={locked || !value.trim()}>
          {step.phase === "pending" ? "Checking…" : "Check"}
        </Button>
        {prompt.blankWords && prompt.blankWords > 1 ? (
          <p id="review-words" className="w-full type-caption text-muted-foreground">
            {prompt.blankWords} words
          </p>
        ) : null}
      </form>
    </div>
  );
}

function ChoiceBody({
  prompt,
  step,
  chosen,
  onChoose,
}: {
  prompt: ReviewPrompt;
  step: Step;
  chosen: string | null;
  onChoose: (id: string) => void;
}) {
  const answered = step.phase === "answered" ? step : null;

  function stateFor(id: string, text: string): ChoiceState {
    if (!answered) return chosen === id ? "selected" : "idle";
    const isRight = text.trim() === answered.feedback.expected.trim();
    if (id === answered.answer) return isRight ? "correct" : "incorrect";
    return isRight ? "revealed" : "dimmed";
  }

  return (
    <div className="space-y-5">
      <p className="type-body text-muted-foreground">
        <span className="type-term-sm text-foreground">{prompt.term}</span>
        {prompt.senseLabel ? <span> · {prompt.senseLabel}</span> : null}
      </p>
      <div role="group" aria-label="Answers" className="space-y-2">
        {(prompt.options ?? []).map((option, i) => (
          <ChoiceOption
            key={option.id}
            shortcut={i + 1}
            language
            state={stateFor(option.id, option.text)}
            disabled={step.phase !== "answering"}
            onClick={() => onChoose(option.id)}
          >
            {option.text}
          </ChoiceOption>
        ))}
      </div>
    </div>
  );
}

/* ── Summary ───────────────────────────────────────────────────── */

function Summary({ results, more }: { results: Result[]; more: boolean }) {
  const router = useRouter();
  // Focus moves to the summary, so it's read out when the session ends.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => rootRef.current?.focus(), []);
  const correct = results.filter((r) => r.feedback.outcome === "correct").length;

  return (
    <div ref={rootRef} tabIndex={-1} className="space-y-8 outline-none">
      <PageHeader
        eyebrow="Session complete"
        title={
          results.length === 0
            ? "Nothing was answered"
            : `You reviewed ${results.length} · ${correct} correct`
        }
        description={
          results.length === 0
            ? "Unanswered items stay due, so they’ll be here next time."
            : "Each answer is saved, and each meaning comes back when its next review is due."
        }
      />
      {results.length > 0 ? (
        <ul className="divide-y divide-border-subtle rounded-lg border border-border bg-card">
          {results.map(({ item, feedback }) => {
            const ok = feedback.outcome === "correct";
            const Icon = ok ? CircleCheck : CircleX;
            return (
              <li
                key={item.senseId}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3"
              >
                <Icon
                  aria-hidden
                  className={ok ? "size-4 shrink-0 text-success" : "size-4 shrink-0 text-danger"}
                />
                <span className="min-w-0 flex-1">
                  {feedback.href ? (
                    <Link
                      href={feedback.href}
                      className="type-term-sm text-foreground hover:underline"
                    >
                      {feedback.term}
                    </Link>
                  ) : (
                    <span className="type-term-sm text-foreground">{feedback.term}</span>
                  )}
                  {feedback.senseLabel ? (
                    <span className="type-caption text-muted-foreground">
                      {" "}
                      · {feedback.senseLabel}
                    </span>
                  ) : null}
                </span>
                <span className="type-caption text-muted-foreground">
                  {ok ? "Correct" : "Not quite"} · {nextReviewText(feedback.nextReview)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {more ? (
          <Button onClick={() => router.refresh()}>
            <RotateCcw data-icon="inline-start" />
            Review 5 more
          </Button>
        ) : null}
        <Button asChild variant={more ? "ghost" : "default"}>
          <Link href="/bank">Open language bank</Link>
        </Button>
      </div>
    </div>
  );
}

/* ── Session ───────────────────────────────────────────────────── */

/**
 * A review session (Phase 5 specification §15): one exercise at a time, checked and recorded by
 * the server, whose answer is the only feedback shown. Keyboard: 1–2 choose, Enter checks or
 * continues. A refresh reselects: answered cards aren't due any more, so nothing repeats.
 */
export function ReviewSession({ items, more }: { items: ReviewItem[]; more: boolean }) {
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState<Step>({ phase: "answering" });
  const [chosen, setChosen] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [done, setDone] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);

  const item = items[index]!;
  const typed = item.prompt.type !== "mistake";
  const settled = step.phase === "answered" || step.phase === "skipped";

  const submit = useCallback(
    async (answer: string) => {
      setStep({ phase: "pending" });
      const sent = await send(item, answer);
      if (sent.ok) {
        setStep({ phase: "answered", answer, feedback: sent.feedback });
        setResults((current) => [...current, { item, feedback: sent.feedback }]);
      } else if (sent.skip) {
        setStep({ phase: "skipped", notice: sent.skip });
      } else {
        setStep({ phase: "answering", error: sent.error, signedOut: sent.signedOut });
      }
    },
    [item],
  );

  const choose = useCallback(
    (id: string) => {
      if (step.phase !== "answering") return;
      setChosen(id);
      void submit(id);
    },
    [step.phase, submit],
  );

  const next = useCallback(() => {
    if (index + 1 >= items.length) {
      setDone(true);
      return;
    }
    setIndex(index + 1);
    setStep({ phase: "answering" });
    setChosen(null);
  }, [index, items.length]);

  // A new exercise: focus its answer field (its label carries the sentence), or its heading.
  useEffect(() => {
    if (done) return;
    if (typed) inputRef.current?.focus();
    else headingRef.current?.focus();
  }, [index, typed, done]);

  // Once answered or skipped, Continue takes focus.
  useEffect(() => {
    if (settled) continueRef.current?.focus();
  }, [settled]);

  // Number keys choose; Enter continues.
  useEffect(() => {
    if (done) return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea") || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const number = Number(event.key);
      if (!typed && step.phase === "answering" && (number === 1 || number === 2)) {
        const option = item.prompt.options?.[number - 1];
        if (option) choose(option.id);
      } else if (event.key === "Enter" && settled && !target.closest("button, a")) {
        event.preventDefault();
        next();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [done, typed, step.phase, settled, item, choose, next]);

  if (done) return <Summary results={results} more={more} />;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="type-caption text-muted-foreground">
            Review {index + 1} of {items.length}
            <span className="text-subtle-foreground"> · {MODE[item.prompt.type]}</span>
          </p>
          <Button variant="ghost" size="sm" onClick={() => setDone(true)}>
            End session
          </Button>
        </div>
        <ProgressTrack
          value={index + (settled ? 1 : 0)}
          max={items.length}
          label="Session progress"
        />
      </div>

      <section
        aria-labelledby="review-prompt"
        className="space-y-5 rounded-lg border border-border bg-card p-5 sm:p-8"
      >
        <h1
          id="review-prompt"
          ref={headingRef}
          tabIndex={-1}
          className="type-subheading text-foreground outline-none"
        >
          {MODE[item.prompt.type]}
        </h1>
        {typed ? (
          <TypedBody
            key={item.prompt.id}
            prompt={item.prompt}
            step={step}
            inputRef={inputRef}
            onSubmit={(answer) => void submit(answer)}
          />
        ) : (
          <ChoiceBody prompt={item.prompt} step={step} chosen={chosen} onChoose={choose} />
        )}
        {step.phase === "answered" ? (
          <Feedback feedback={step.feedback} prompt={item.prompt} />
        ) : null}
        {step.phase === "skipped" ? <Callout role="status" title={step.notice} /> : null}
        {step.phase === "answering" && step.error ? (
          <Callout role="alert" tone="danger" title={step.error}>
            {step.signedOut ? (
              <Link href="/sign-in?next=/practice" className="type-label text-ink hover:underline">
                Sign in
              </Link>
            ) : null}
          </Callout>
        ) : null}
        {step.phase === "pending" ? (
          <p role="status" className="sr-only">
            Checking your answer
          </p>
        ) : null}
      </section>

      <div className="flex items-center justify-end gap-2">
        <Button ref={continueRef} onClick={next} disabled={!settled}>
          {index + 1 === items.length ? "Finish" : "Continue"}
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
      <p className="text-center type-caption text-subtle-foreground max-sm:hidden">
        {typed
          ? "Type your answer · Enter to check, then to continue"
          : "Press 1–2 to choose · Enter to continue"}
      </p>
    </div>
  );
}
