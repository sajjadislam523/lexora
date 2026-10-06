import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { LANGUAGE_CATEGORIES, type LanguageCategory } from "./language-category";

type TileTone = LanguageCategory | "neutral" | "highlight";

type TileProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** A category tint, `neutral` (muted surface) or `highlight` (max one per view). */
  tone?: TileTone;
  href?: string;
  className?: string;
};

const TONE_SURFACE: Record<"neutral" | "highlight", { surface: string; icon: string }> = {
  neutral: { surface: "bg-muted", icon: "text-foreground" },
  highlight: { surface: "bg-highlight", icon: "text-highlight-foreground" },
};

/**
 * Tinted entry-point tile: icon square, title, one line. Borderless — the tint is the surface.
 * Use for a small grid of destinations (e.g. practice areas), not for content lists.
 */
export function Tile({
  icon: Icon,
  title,
  description,
  tone = "neutral",
  href,
  className,
}: TileProps) {
  const toneClasses =
    tone === "neutral" || tone === "highlight"
      ? TONE_SURFACE[tone]
      : { surface: LANGUAGE_CATEGORIES[tone].soft, icon: LANGUAGE_CATEGORIES[tone].icon };

  const content = (
    <>
      <span className="flex size-9 items-center justify-center rounded-md bg-card">
        <Icon aria-hidden className={cn("size-4.5", toneClasses.icon)} />
      </span>
      <span className="mt-4 block type-subheading text-foreground">{title}</span>
      {description ? (
        <span className="mt-0.5 block type-caption text-muted-foreground">{description}</span>
      ) : null}
    </>
  );

  const classes = cn(
    "block rounded-lg p-5",
    toneClasses.surface,
    href &&
      "transition-shadow duration-120 ease-standard outline-none hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring",
    className,
  );

  return href ? (
    <Link href={href} data-slot="tile" className={classes}>
      {content}
    </Link>
  ) : (
    <div data-slot="tile" className={classes}>
      {content}
    </div>
  );
}
