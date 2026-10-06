type HighlightedTextProps = {
  text: string;
  /** Substring of `text` to mark with the highlighter (first occurrence, case-insensitive). */
  highlight?: string;
  className?: string;
};

/** Renders text with the target language marked by the Lexora highlighter. */
export function HighlightedText({ text, highlight, className }: HighlightedTextProps) {
  const index = highlight ? text.toLowerCase().indexOf(highlight.toLowerCase()) : -1;
  if (!highlight || index === -1) return <span className={className}>{text}</span>;

  return (
    <span className={className}>
      {text.slice(0, index)}
      <mark className="rounded-xs bg-highlight px-0.5 text-highlight-foreground">
        {text.slice(index, index + highlight.length)}
      </mark>
      {text.slice(index + highlight.length)}
    </span>
  );
}
