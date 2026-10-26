import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PageHeader } from "@/components/lexora/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { BankError, BankSkeleton, BankView } from "@/features/bank/bank-view";
import { requireSession } from "@/server/auth/session";
import {
  BANK_FILTERS,
  bankPath,
  loadBankCounts,
  loadBankPage,
  type BankFilter,
} from "@/server/learning/bank";

export const metadata: Metadata = { title: "Language bank" };

/** `?page=` as a whole number from 2; anything else is the first page. */
function pageOf(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) return 1;
  return /^[1-9]\d{0,5}$/.test(raw) ? Number(raw) : Number.NaN;
}

/** `?show=` as one of the bank's filters; absent is everything, anything else is null. */
function filterOf(value: string | string[] | undefined): BankFilter | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) return "all";
  return (BANK_FILTERS as readonly string[]).includes(raw) && raw !== "all"
    ? (raw as BankFilter)
    : null;
}

async function Bank({
  userId,
  page,
  filter,
  now,
  known,
}: {
  userId: string;
  page: number;
  filter: BankFilter;
  now: Date;
  known: Awaited<ReturnType<typeof loadBankCounts>>;
}) {
  // Only the data load is guarded; rendering errors go to the (app) error boundary.
  const bank = await loadBankPage(userId, page, now, known, filter).catch((error: unknown) => {
    console.error("Language bank failed to load", error instanceof Error ? error.name : "error");
    return null;
  });
  return bank ? <BankView bank={bank} /> : <BankError />;
}

export default async function BankPage(props: PageProps<"/bank">) {
  // The learner comes from the session, never from the request.
  const session = await requireSession();
  const params = await props.searchParams;
  const raw = params.page;
  const page = pageOf(raw);
  const filter = filterOf(params.show);
  // One URL per filtered page: no `?show=all` or `?page=1`, nothing that isn't a filter or a
  // page number, no repeated or extra parameters, and `show` before `page`.
  const canonical = bankPath(filter ?? "all", Number.isNaN(page) ? 1 : page);
  const given = new URLSearchParams(
    Object.entries(params).flatMap(([key, value]) =>
      (Array.isArray(value) ? value : [value ?? ""]).map((v) => [key, v]),
    ),
  ).toString();
  if (filter === null || Number.isNaN(page) || `/bank${given ? `?${given}` : ""}` !== canonical) {
    redirect(canonical);
  }

  // The counts come first (one statement), so a page past the end redirects before streaming.
  const now = new Date();
  let known: Awaited<ReturnType<typeof loadBankCounts>> | null = null;
  try {
    known = await loadBankCounts(session.user.id, now, filter);
  } catch (error) {
    console.error("Language bank failed to load", error instanceof Error ? error.name : "error");
  }
  if (known && page > known.pages) redirect(bankPath(filter, known.pages));

  return (
    <PageContainer className="space-y-8">
      <PageHeader
        title="Language bank"
        description="Everything you’ve saved, and when it comes back."
      />
      {known ? (
        <Suspense fallback={<BankSkeleton />}>
          <Bank userId={session.user.id} page={page} filter={filter} now={now} known={known} />
        </Suspense>
      ) : (
        <BankError />
      )}
    </PageContainer>
  );
}
