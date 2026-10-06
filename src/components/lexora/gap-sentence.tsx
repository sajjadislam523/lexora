import { cn } from "@/lib/utils";

export type GapPart = string | { gap: number };

type GapSentenceProps = {
  parts: GapPart[];
  /** Text for each gap; an undefined entry renders as an empty slot. */
  fills?: (string | undefined)[];
  /** `highlight` for chosen language; `danger` marks a wrong attempt. */
  tone?: "highlight" | "danger";
  className?: string;
};

/**
 * A sentence in the language voice with gaps. Empty gaps are underlined slots; filled gaps
 * use the highlighter. Shared by the Finder context tool and Practice.
 */
export function GapSentence({
  parts,
  fills = [],
  tone = "highlight",
  className,
}: GapSentenceProps) {
  return (
    <p className={cn("type-example text-foreground", className)}>
      {parts.map((part, i) => {
        if (typeof part === "string") return <span key={i}>{part}</span>;
        const fill = fills[part.gap];
        if (!fill) {
          return (
            <span key={i}>
              <span
                aria-hidden
                className="mx-0.5 inline-block w-16 translate-y-1 border-b-2 border-input sm:w-20"
              />
              <span className="sr-only">blank</span>
            </span>
          );
        }
        return (
          <mark
            key={i}
            className={cn(
              "rounded-xs px-1",
              tone === "danger"
                ? "bg-danger-soft text-danger line-through decoration-danger/60"
                : "bg-highlight text-highlight-foreground",
            )}
          >
            {fill}
          </mark>
        );
      })}
    </p>
  );
}
