import { EmptyState } from "@/components/lexora/empty-state";
import { PageHeader } from "@/components/lexora/page-header";
import { Badge } from "@/components/ui/badge";

import { getNavEntry } from "./navigation";
import { PageContainer } from "./page-container";

/**
 * Honest stand-in for a page that is not built yet. States which phase delivers it.
 * Replace route by route as Phase 1 mocks and later phases land.
 */
export function RoutePlaceholder({ id }: { id: string }) {
  const entry = getNavEntry(id);

  return (
    <PageContainer className="space-y-10">
      <PageHeader
        eyebrow={<Badge variant="outline">Not built yet</Badge>}
        title={entry.label}
        description={entry.description}
      />
      <EmptyState
        icon={entry.icon}
        title="This screen is not built yet"
        description={entry.status}
      />
    </PageContainer>
  );
}
