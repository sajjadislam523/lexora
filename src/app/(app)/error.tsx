"use client";

import { Callout } from "@/components/lexora/callout";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";

/** Calm error state inside the shell. Never shows raw error details to the user. */
export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageContainer className="max-w-reading">
      <Callout role="alert" tone="danger" title="Something went wrong on this page">
        It wasn’t something you did. Try again — if it keeps happening, reload the page.
      </Callout>
      <Button className="mt-4" variant="outline" onClick={reset}>
        Try again
      </Button>
    </PageContainer>
  );
}
