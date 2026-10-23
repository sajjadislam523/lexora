"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { useSavedSense } from "@/components/language/saved-language";
import { Button } from "@/components/ui/button";

/**
 * Removes a sense from the bank through the shared save flow — the same `DELETE` endpoint and
 * client state the Finder and language pages use, so they all agree. The list is refreshed from
 * the server only once the server has confirmed; on failure (including the 429 rate limit) the
 * save flow restores the row and says why.
 */
export function RemoveButton({ senseId, label }: { senseId: string; label: string }) {
  const router = useRouter();
  const { saved, loading, pending, toggle } = useSavedSense({ senseId, label });
  const started = useRef(false);

  useEffect(() => {
    if (!started.current || pending) return;
    started.current = false;
    if (!saved) router.refresh();
  }, [pending, saved, router]);

  // Until the saved state has loaded, a press could be read as "save"; wait for it.
  const busy = loading || pending;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`Remove “${label}” from your language bank`}
      aria-busy={busy}
      disabled={busy || !saved}
      onClick={() => {
        started.current = true;
        toggle();
      }}
      className="shrink-0 text-subtle-foreground hover:text-foreground max-sm:size-11"
    >
      <Trash2 aria-hidden />
    </Button>
  );
}
