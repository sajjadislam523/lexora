"use client";

import { CircleCheck, LoaderCircle } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef } from "react";

import { Callout } from "@/components/lexora/callout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FormField, fieldAria, focusFirstInvalid } from "@/components/lexora/form-field";

import { updateLearnerProfileAction, updateNameAction } from "./actions";
import { FOCUS_SKILLS, TARGET_BANDS, type FormState } from "./schemas";

const idle: FormState = { status: "idle" };

/**
 * Submit through a transition instead of the `action` prop, so React doesn't auto-reset the form
 * after saving — the fields keep showing what the user just saved.
 */
function submitWith(action: (formData: FormData) => void) {
  return (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  };
}

/** After the server rejects a field, focus moves to it so its error is read out. */
function useFocusOnFieldErrors(state: FormState) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "error" && state.fieldErrors) focusFirstInvalid(form.current);
  }, [state]);
  return form;
}

/** A form-level failure (not a field error), announced as it appears. */
function FormError({ state }: { state: FormState }) {
  return state.status === "error" && !state.fieldErrors ? (
    <Callout role="alert" tone="danger" title={state.message} />
  ) : null;
}

/** The polite "… saved." line. Always rendered, so the live region exists before it changes. */
function SavedStatus({ pending, state }: { pending: boolean; state: FormState }) {
  const saved = !pending && state.status === "success";
  return (
    <p role="status" className="flex items-center gap-1.5 type-caption text-success">
      {saved ? (
        <>
          <CircleCheck aria-hidden className="size-3.5" />
          {state.message}
        </>
      ) : null}
    </p>
  );
}

function SaveButton({
  pending,
  label,
  ...props
}: React.ComponentProps<typeof Button> & { pending: boolean; label: string }) {
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} {...props}>
      {pending ? (
        <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
      ) : null}
      {pending ? "Saving…" : label}
    </Button>
  );
}

/** The name and its Save sit on one row: a quiet outline action, not a second primary. */
export function NameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(updateNameAction, idle);
  const error = state.status === "error" ? state.fieldErrors?.name : undefined;
  const form = useFocusOnFieldErrors(state);

  return (
    <form ref={form} onSubmit={submitWith(action)} className="max-w-md space-y-2">
      <FormError state={state} />
      <FormField
        id="name"
        label="Name"
        error={error}
        hint="Shown in your greeting on Home and in the account menu."
      >
        <div className="flex gap-2">
          <Input
            id="name"
            name="name"
            defaultValue={name}
            autoComplete="name"
            {...fieldAria("name", error, true)}
          />
          <SaveButton
            pending={pending}
            label="Save name"
            variant="outline"
            // `!`: cn doesn't resolve two custom height tokens, so match the input explicitly.
            className="h-control-input!"
          />
        </div>
      </FormField>
      <SavedStatus pending={pending} state={state} />
    </form>
  );
}

const SKILL_LABELS: Record<(typeof FOCUS_SKILLS)[number], string> = {
  writing: "Writing",
  speaking: "Speaking",
  both: "Both",
};

/**
 * Target band, test date and focus in one panel — the page's main section — with the save in
 * the panel's footer. Empty values are saved as "not set" (null); the prompts in the controls
 * are never stored.
 */
export function LearnerProfileForm({
  targetBand,
  testDate,
  focusSkill,
}: {
  targetBand: string | null;
  testDate: string | null;
  focusSkill: string | null;
}) {
  const [state, action, pending] = useActionState(updateLearnerProfileAction, idle);
  const form = useFocusOnFieldErrors(state);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <form ref={form} onSubmit={submitWith(action)}>
      <Card>
        <CardContent className="space-y-6">
          <FormError state={state} />
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              id="targetBand"
              label="Target band"
              error={errors.targetBand}
              hint="The overall IELTS band you’re aiming for."
            >
              <NativeSelect
                id="targetBand"
                name="targetBand"
                defaultValue={targetBand ?? ""}
                {...fieldAria("targetBand", errors.targetBand, true)}
              >
                <option value="">Choose your target band</option>
                {TARGET_BANDS.map((band) => (
                  <option key={band} value={band}>
                    Band {band}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              id="testDate"
              label="Test date"
              error={errors.testDate}
              hint="Optional. Leave it empty if you haven’t booked yet."
            >
              <Input
                id="testDate"
                name="testDate"
                type="date"
                defaultValue={testDate ?? ""}
                {...fieldAria("testDate", errors.testDate, true)}
              />
            </FormField>
          </div>

          <fieldset
            className="min-w-0 space-y-1.5"
            aria-describedby={errors.focusSkill ? "focusSkill-error" : "focusSkill-hint"}
          >
            <legend className="type-label text-foreground">Focus</legend>
            <div
              role="presentation"
              // Two by two on phones (four in a row overflows at 320px), one row from `sm`.
              className="grid grid-cols-2 gap-0.5 rounded-md bg-muted p-0.5 sm:inline-flex sm:gap-0"
            >
              {[...FOCUS_SKILLS, ""].map((skill) => (
                <label
                  key={skill || "none"}
                  className="flex h-control-md cursor-pointer items-center justify-center rounded-sm px-3 type-label whitespace-nowrap text-muted-foreground transition-colors duration-120 ease-standard hover:text-foreground has-checked:bg-card has-checked:text-foreground has-checked:shadow-xs has-focus-visible:ring-2 has-focus-visible:ring-ring max-sm:h-11"
                >
                  <input
                    type="radio"
                    name="focusSkill"
                    value={skill}
                    defaultChecked={(focusSkill ?? "") === skill}
                    className="sr-only"
                  />
                  {skill ? SKILL_LABELS[skill as keyof typeof SKILL_LABELS] : "Not set"}
                </label>
              ))}
            </div>
            {errors.focusSkill ? (
              <p id="focusSkill-error" className="type-caption text-danger">
                {errors.focusSkill}
              </p>
            ) : (
              <p id="focusSkill-hint" className="type-caption text-subtle-foreground">
                The part of the test you most want to practise.
              </p>
            )}
          </fieldset>
        </CardContent>
        <CardFooter className="flex-wrap justify-between gap-3">
          <SavedStatus pending={pending} state={state} />
          <SaveButton pending={pending} label="Save goals" className="ml-auto" />
        </CardFooter>
      </Card>
    </form>
  );
}
