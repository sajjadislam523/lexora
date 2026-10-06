"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { auth } from "@/server/auth/auth";
import { requireSession } from "@/server/auth/session";
import { upsertLearnerProfile } from "@/server/repositories/learner-profile";

import { learnerProfileSchema, nameSchema, type FormState } from "./schemas";

function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

/** Update the display name. Authorisation: the session's own user only. */
export async function updateNameAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const parsed = nameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted field.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }
  try {
    await auth.api.updateUser({ headers: await headers(), body: { name: parsed.data.name } });
  } catch {
    return { status: "error", message: "Your name couldn’t be saved. Please try again." };
  }
  revalidatePath("/", "layout");
  return { status: "success", message: "Name updated." };
}

/** Save the learning profile. The user id comes from the session, never from the form. */
export async function updateLearnerProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const parsed = learnerProfileSchema.safeParse({
    targetBand: formData.get("targetBand") ?? "",
    testDate: formData.get("testDate") ?? "",
    focusSkill: formData.get("focusSkill") ?? "",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }
  try {
    await upsertLearnerProfile(session.user.id, parsed.data);
  } catch {
    return {
      status: "error",
      message: "Your learning profile couldn’t be saved. Please try again.",
    };
  }
  revalidatePath("/settings");
  return { status: "success", message: "Learning profile saved." };
}
