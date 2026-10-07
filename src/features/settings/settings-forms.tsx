"use client";

import { LoaderCircle } from "lucide-react";
import { startTransition, useActionState } from "react";

import { Callout } from "@/components/lexora/callout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FormField, fieldAria } from "@/components/lexora/form-field";

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

function SaveRow({ pending, state }: { pending: boolean; state: FormState }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? (
          <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
        ) : null}
        {pending ? "Saving…" : "Save"}
      </Button>
      <p role="status" className="type-caption text-muted-foreground">
        {!pending && state.status === "success" ? state.message : ""}
      </p>
    </div>
  );
}

export function NameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(updateNameAction, idle);
  const error = state.status === "error" ? state.fieldErrors?.name : undefined;

  return (
    <form onSubmit={submitWith(action)} className="space-y-4">
      {state.status === "error" && !state.fieldErrors ? (
        <Callout role="alert" tone="danger" title={state.message} />
      ) : null}
      <FormField id="name" label="Name" error={error}>
        <Input
          id="name"
          name="name"
          defaultValue={name}
          autoComplete="name"
          className="max-w-sm"
          {...fieldAria("name", error)}
        />
      </FormField>
      <SaveRow pending={pending} state={state} />
    </form>
  );
}

const SKILL_LABELS: Record<(typeof FOCUS_SKILLS)[number], string> = {
  writing: "Writing",
  speaking: "Speaking",
  both: "Both",
};

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
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <form onSubmit={submitWith(action)} className="space-y-5">
      {state.status === "error" && !state.fieldErrors ? (
        <Callout role="alert" tone="danger" title={state.message} />
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          id="targetBand"
          label="Target band"
          error={errors.targetBand}
          hint="The overall band you’re aiming for."
        >
          <NativeSelect
            id="targetBand"
            name="targetBand"
            defaultValue={targetBand ?? ""}
            {...fieldAria("targetBand", errors.targetBand, true)}
          >
            <option value="">Not set</option>
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
          hint="Optional. Helps pace your reviews later."
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

      <fieldset className="space-y-2">
        <legend className="type-label text-foreground">Focus</legend>
        <div className="inline-flex rounded-md bg-muted p-0.5" role="presentation">
          {[...FOCUS_SKILLS, ""].map((skill) => (
            <label
              key={skill || "none"}
              className="cursor-pointer rounded-sm px-3 py-1.5 type-label text-muted-foreground transition-colors duration-120 has-checked:bg-card has-checked:text-foreground has-checked:shadow-xs has-focus-visible:ring-2 has-focus-visible:ring-ring"
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
        {errors.focusSkill ? <p className="type-caption text-danger">{errors.focusSkill}</p> : null}
      </fieldset>

      <SaveRow pending={pending} state={state} />
    </form>
  );
}
