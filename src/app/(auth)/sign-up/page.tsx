import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignUpForm } from "@/features/auth/sign-up-form";
import { safeRedirect } from "@/lib/safe-redirect";
import { getSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage(props: PageProps<"/sign-up">) {
  const params = await props.searchParams;
  const next = safeRedirect(typeof params.next === "string" ? params.next : undefined);

  if (await getSession()) redirect(next);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="type-title text-foreground">Create your account</h1>
        <p className="type-reading text-muted-foreground">
          Find the right English for what you want to say — and keep it.
        </p>
      </header>
      <SignUpForm next={next} />
    </div>
  );
}
