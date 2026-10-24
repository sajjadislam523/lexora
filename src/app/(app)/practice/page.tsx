import type { Metadata } from "next";

import { PageContainer } from "@/components/shell/page-container";
import { PracticeError, PracticeView } from "@/features/practice/practice-view";
import { requireSession } from "@/server/auth/session";
import { loadReviewSession } from "@/server/learning/review";

export const metadata: Metadata = { title: "Practice" };

export default async function PracticePage() {
  // The learner comes from the session, never from the request.
  const session = await requireSession();
  const now = new Date();
  // Only the data load is guarded; rendering errors go to the (app) error boundary.
  const review = await loadReviewSession(session.user.id, now).catch((error: unknown) => {
    console.error("Practice failed to load", error instanceof Error ? error.name : "error");
    return null;
  });
  return (
    <PageContainer>
      <div className="mx-auto max-w-reading">
        {review ? (
          <PracticeView session={review} loadedAt={now.toISOString()} />
        ) : (
          <PracticeError />
        )}
      </div>
    </PageContainer>
  );
}
