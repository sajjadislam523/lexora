import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PageHeader } from "@/components/lexora/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { BankError, BankSkeleton, BankView } from "@/features/bank/bank-view";
import { requireSession } from "@/server/auth/session";
import { loadBankCounts, loadBankPage } from "@/server/learning/bank";

export const metadata: Metadata = { title: "Language bank" };

/** `?page=` as a whole number from 2; anything else is the first page. */
function pageOf(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) return 1;
  return /^[1-9]\d{0,5}$/.test(raw) ? Number(raw) : Number.NaN;
}

async function Bank({
  userId,
  page,
  now,
  known,
}: {
  userId: string;
  page: number;
  now: Date;
  known: Awaited<ReturnType<typeof loadBankCounts>>;
}) {
  // Only the data load is guarded; rendering errors go to the (app) error boundary.
  const bank = await loadBankPage(userId, page, now, known).catch((error: unknown) => {
    console.error("Language bank failed to load", error instanceof Error ? error.name : "error");
    return null;
  });
  return bank ? <BankView bank={bank} /> : <BankError />;
}

export default async function BankPage(props: PageProps<"/bank">) {
  // The learner comes from the session, never from the request.
  const session = await requireSession();
  const raw = (await props.searchParams).page;
  const page = pageOf(raw);
  // One URL per page: no `?page=1`, and nothing that isn't a page number.
  if (raw !== undefined && (Number.isNaN(page) || page === 1)) redirect("/bank");

  // The counts come first (one statement), so a page past the end redirects before streaming.
  const now = new Date();
  let known: Awaited<ReturnType<typeof loadBankCounts>> | null = null;
  try {
    known = await loadBankCounts(session.user.id, now);
  } catch (error) {
    console.error("Language bank failed to load", error instanceof Error ? error.name : "error");
  }
  if (known && page > known.pages) {
    redirect(known.pages === 1 ? "/bank" : `/bank?page=${known.pages}`);
  }

  return (
    <PageContainer className="space-y-8">
      <PageHeader
        title="Language bank"
        description="Everything you’ve saved, and when it comes back."
      />
      {known ? (
        <Suspense fallback={<BankSkeleton />}>
          <Bank userId={session.user.id} page={page} now={now} known={known} />
        </Suspense>
      ) : (
        <BankError />
      )}
    </PageContainer>
  );
}
