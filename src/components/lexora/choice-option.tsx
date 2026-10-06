import { CircleCheck, CircleX } from "lucide-react";

import { cn } from "@/lib/utils";

import { Kbd } from "./kbd";

export type ChoiceState =
  | "idle"
  | "selected"
  | "correct"
  | "acceptable"
  | "incorrect"
  /** The right answer, revealed after a wrong choice. */
  | "revealed"
  /** Not chosen, after the answer is known. */
  | "dimmed";

const STATE_CLASSES: Record<ChoiceState, string> = {
  idle: "border-border-strong bg-card hover:border-input hover:bg-accent/40",
  selected: "border-ink bg-ink-soft",
  correct: "border-success bg-success-soft",
  acceptable: "border-ink bg-ink-soft",
  incorrect: "border-danger bg-danger-soft",
  revealed: "border-dashed border-success bg-card",
  dimmed: "border-border bg-card text-muted-foreground",
};

const STATE_TEXT: Partial<Record<ChoiceState, string>> = {
  correct: "Your answer — correct",
  acceptable: "Your answer — also natural",
  incorrect: "Your answer — not quite",
  revealed: "Best answer",
};

type ChoiceOptionProps = Omit<React.ComponentProps<"button">, "type"> & {
  state?: ChoiceState;
  /** 1-based keyboard shortcut shown as a key cap. */
  shortcut?: number;
  /** Render the label in the serif language voice (for sentences and terms). */
  language?: boolean;
  /** Toggle semantics for multi-select questions. */
  pressed?: boolean;
};

/**
 * A full-width answer row for practice and contextual choices. The verdict is shown with
 * colour, an icon and visually hidden text — never colour alone.
 */
export function ChoiceOption({
  state = "idle",
  shortcut,
  language = false,
  pressed,
  className,
  children,
  ...props
}: ChoiceOptionProps) {
  const verdictText = STATE_TEXT[state];
  const isPositive = state === "correct" || state === "acceptable" || state === "revealed";

  return (
    <button
      type="button"
      data-slot="choice-option"
      data-state={state}
      aria-pressed={pressed}
      className={cn(
        "group/choice flex min-h-control-lg w-full cursor-pointer items-center gap-3 rounded-md border px-3.5 py-2.5 text-left text-foreground transition-[background-color,border-color,color] duration-120 ease-standard outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-default",
        STATE_CLASSES[state],
        className,
      )}
      {...props}
    >
      {shortcut !== undefined ? (
        <Kbd aria-hidden className="shrink-0 max-sm:hidden">
          {shortcut}
        </Kbd>
      ) : null}
      <span className={cn("min-w-0 flex-1", language ? "type-term-sm font-normal" : "type-label")}>
        {children}
      </span>
      {verdictText ? <span className="sr-only">{verdictText}</span> : null}
      {isPositive ? (
        <CircleCheck
          aria-hidden
          className={cn("size-4.5 shrink-0", state === "acceptable" ? "text-ink" : "text-success")}
        />
      ) : null}
      {state === "incorrect" ? (
        <CircleX aria-hidden className="size-4.5 shrink-0 text-danger" />
      ) : null}
    </button>
  );
}
