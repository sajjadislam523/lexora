"use client";

import { Callout } from "@/components/lexora/callout";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";

/**
 * Calm error state for public pages (for example, when the language database can't be reached).
 * Never shows raw error details, and never falls back to sample content.
 */
export default function PublicError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageContainer className="max-w-reading">
      <Callout role="alert" tone="danger" title="This page couldn’t be loaded">
        It wasn’t something you did. Try again — if it keeps happening, come back in a few minutes.
      </Callout>
      <Button className="mt-4" variant="outline" onClick={reset}>
        Try again
      </Button>
    </PageContainer>
  );
}
