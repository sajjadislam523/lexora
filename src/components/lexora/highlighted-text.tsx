type Span = { start: number; end: number };

type HighlightedTextProps = {
  text: string;
  /** Substring of `text` to mark with the highlighter (first occurrence, case-insensitive). */
  highlight?: string;
  /** Exact character ranges to mark instead, e.g. authored highlights from the content. */
  spans?: readonly Span[];
  className?: string;
};

const MARK = "rounded-xs bg-highlight px-0.5 text-highlight-foreground";

/** Renders text with the target language marked by the Lexora highlighter. */
export function HighlightedText({ text, highlight, spans, className }: HighlightedTextProps) {
  if (spans && spans.length > 0) {
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    for (const span of [...spans].sort((a, b) => a.start - b.start)) {
      if (span.start < cursor || span.end > text.length) continue;
      parts.push(text.slice(cursor, span.start));
      parts.push(
        <mark key={span.start} className={MARK}>
          {text.slice(span.start, span.end)}
        </mark>,
      );
      cursor = span.end;
    }
    parts.push(text.slice(cursor));
    return <span className={className}>{parts}</span>;
  }

  const index = highlight ? text.toLowerCase().indexOf(highlight.toLowerCase()) : -1;
  if (!highlight || index === -1) return <span className={className}>{text}</span>;

  return (
    <span className={className}>
      {text.slice(0, index)}
      <mark className={MARK}>{text.slice(index, index + highlight.length)}</mark>
      {text.slice(index + highlight.length)}
    </span>
  );
}
