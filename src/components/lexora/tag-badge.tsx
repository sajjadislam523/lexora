import { MessageCircle, PenLine } from "lucide-react";

import { cn } from "@/lib/utils";

const TAGS = {
  academic: { label: "Academic", icon: null },
  formal: { label: "Formal", icon: null },
  neutral: { label: "Neutral", icon: null },
  informal: { label: "Informal", icon: null },
  writing: { label: "Writing", icon: PenLine },
  speaking: { label: "Speaking", icon: MessageCircle },
} as const;

export type LanguageTag = keyof typeof TAGS;

/**
 * Context tags: register (academic / formal / neutral / informal) and skill (writing / speaking).
 * Deliberately neutral in color so category color keeps its meaning.
 */
export function TagBadge({
  tag,
  className,
  ...props
}: React.ComponentProps<"span"> & { tag: LanguageTag }) {
  const { label, icon: Icon } = TAGS[tag];

  return (
    <span
      data-slot="tag-badge"
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-xs bg-muted px-1.5 type-micro font-normal text-muted-foreground",
        className,
      )}
      {...props}
    >
      {Icon ? <Icon aria-hidden className="size-3" /> : null}
      {label}
    </span>
  );
}
