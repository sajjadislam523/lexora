"use client";

import {
  ArrowRight,
  BarChart3,
  BookMarked,
  Bookmark,
  ChevronDown,
  Dumbbell,
  Home,
  Mic,
  MoreHorizontal,
  PenLine,
  Plus,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

import { CategoryBadge } from "@/components/lexora/category-badge";
import { FilterChip } from "@/components/lexora/filter-chip";
import { Kbd } from "@/components/lexora/kbd";
import {
  LANGUAGE_CATEGORY_KEYS,
  type LanguageCategory,
} from "@/components/lexora/language-category";
import { LanguageResultCard } from "@/components/lexora/language-result-card";
import { NavItem } from "@/components/lexora/nav-item";
import { SearchField } from "@/components/lexora/search-field";
import { StatusBadge } from "@/components/lexora/status-badge";
import { TagBadge } from "@/components/lexora/tag-badge";
import { Tile } from "@/components/lexora/tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { SAMPLE_BANK, SAMPLE_QUERIES, SAMPLE_RESULTS } from "../_fixtures";
import { DemoSearchTrigger } from "./palette";
import { Section, Specimen } from "./section";

const BUTTON_VARIANTS = [
  "default",
  "ink",
  "outline",
  "secondary",
  "ghost",
  "destructive",
  "link",
] as const;

export const NAV_PREVIEW = [
  { label: "Home", icon: Home },
  { label: "Language Finder", icon: Search, active: true },
  { label: "Language bank", icon: BookMarked, count: 48 },
  { label: "Practice", icon: Dumbbell, count: 12 },
  { label: "Writing Lab", icon: PenLine },
  { label: "Speaking Lab", icon: Mic },
  { label: "Progress", icon: BarChart3 },
];

function useToggleSet<T>(initial: T[]) {
  const [set, setSet] = useState<Set<T>>(() => new Set(initial));
  const toggle = (value: T) =>
    setSet((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  return [set, toggle] as const;
}

export function ComponentsSection() {
  const [chips, toggleChip] = useToggleSet<LanguageCategory>(["preposition"]);
  const [saved, toggleSaved] = useToggleSet<string>(["significant"]);

  return (
    <Section
      id="components"
      eyebrow="Components"
      title="Components"
      description="shadcn/ui primitives on Radix, restyled through tokens, plus Lexora’s own patterns. Interactive states here are local demo state — nothing is saved."
    >
      {/* ── Buttons ─────────────────────────────────────────── */}
      <Specimen
        title="Buttons"
        note="Rectangular. Charcoal for the single primary action per view."
      >
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            {BUTTON_VARIANTS.map((variant) => (
              <Button key={variant} variant={variant}>
                {variant === "default" ? "Primary" : variant[0]!.toUpperCase() + variant.slice(1)}
              </Button>
            ))}
          </div>
          <Separator className="bg-border-subtle" />
          <div className="flex flex-wrap items-center gap-3">
            <Button size="xs" variant="outline">
              xs · 24
            </Button>
            <Button size="sm" variant="outline">
              sm · 28
            </Button>
            <Button variant="outline">default · 36</Button>
            <Button size="lg" variant="outline">
              lg · 44
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Save">
              <Bookmark />
            </Button>
            <Button size="icon" variant="outline" aria-label="Add">
              <Plus />
            </Button>
          </div>
          <Separator className="bg-border-subtle" />
          <div className="flex flex-wrap items-center gap-3">
            <Button>
              Start practice
              <ArrowRight data-icon="inline-end" />
            </Button>
            <Button variant="ink">
              <Sparkles data-icon="inline-start" />
              Get started
            </Button>
            <Button disabled>Disabled</Button>
            <Button variant="outline" disabled>
              Disabled
            </Button>
          </div>
          <p className="type-caption text-subtle-foreground">
            Disabled uses a recessed fill and disabled text — never a faded opacity. Press shifts
            1px and deepens the fill.
          </p>
        </div>
      </Specimen>

      {/* ── Inputs ──────────────────────────────────────────── */}
      <Specimen
        title="Inputs"
        note="40px in-app, 44px for auth and onboarding. Flat, with a 3:1 edge."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="ds-input" className="type-label text-foreground">
              Word or phrase
            </label>
            <Input id="ds-input" placeholder="e.g. responsible" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ds-input-lg" className="type-label text-foreground">
              Email
            </label>
            <Input id="ds-input-lg" size="lg" type="email" placeholder="you@example.com" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ds-input-invalid" className="type-label text-foreground">
              Invalid
            </label>
            <Input
              id="ds-input-invalid"
              defaultValue="responsible of"
              aria-invalid
              aria-describedby="ds-input-invalid-hint"
            />
            <p id="ds-input-invalid-hint" className="type-caption text-danger">
              Use “responsible for”.
            </p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ds-input-disabled" className="type-label text-disabled-foreground">
              Disabled
            </label>
            <Input id="ds-input-disabled" placeholder="Not available" disabled />
          </div>
        </div>
      </Specimen>

      {/* ── Search ──────────────────────────────────────────── */}
      <Specimen
        title="Search patterns"
        note="Recessed trigger in chrome, raised hero in the Finder, small field for filtering. Search itself is not wired up."
        className="bg-background"
      >
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-2">
            <p className="type-overline text-subtle-foreground">Trigger · chrome</p>
            <DemoSearchTrigger />
            <p className="type-caption text-muted-foreground">
              A button that opens the command palette. Try it, or press ⌘K / Ctrl+K.
            </p>
          </div>
          <div className="space-y-2 lg:col-span-2">
            <p className="type-overline text-subtle-foreground">Hero · Language Finder</p>
            <SearchField
              size="lg"
              label="Search for language"
              placeholder="What do you want to say?"
              hint={<Kbd>/</Kbd>}
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {SAMPLE_QUERIES.slice(0, 3).map((query) => (
                <span
                  key={query}
                  className="rounded-full bg-muted px-2.5 py-0.5 type-caption text-muted-foreground"
                >
                  {query}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="type-overline text-subtle-foreground">Filter · in page</p>
            <SearchField label="Filter saved language" placeholder="Filter…" />
          </div>
        </div>
      </Specimen>

      {/* ── Tabs & chips ────────────────────────────────────── */}
      <Specimen
        title="Tabs & filter chips"
        note="Pills switch filters, underlines navigate sections, segments flip views."
      >
        <div className="space-y-8">
          <div className="space-y-2">
            <p className="type-overline text-subtle-foreground">Filter chips · multi-select</p>
            <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2">
              {LANGUAGE_CATEGORY_KEYS.map((key, i) => (
                <FilterChip
                  key={key}
                  category={key}
                  pressed={chips.has(key)}
                  count={[124, 86, 41, 57, 63, 38, 72][i]}
                  onClick={() => toggleChip(key)}
                />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="type-overline text-subtle-foreground">Underline tabs · sections</p>
            <Tabs defaultValue="overview">
              <TabsList variant="line">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="examples">Examples</TabsTrigger>
                <TabsTrigger value="collocations">Collocations</TabsTrigger>
                <TabsTrigger value="mistakes">Mistakes</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="pt-3 type-body text-muted-foreground">
                Meaning, pattern and register at a glance.
              </TabsContent>
              <TabsContent value="examples" className="pt-3 type-body text-muted-foreground">
                Example sentences in IELTS contexts.
              </TabsContent>
              <TabsContent value="collocations" className="pt-3 type-body text-muted-foreground">
                Words that naturally go with this item.
              </TabsContent>
              <TabsContent value="mistakes" className="pt-3 type-body text-muted-foreground">
                Common learner errors and corrections.
              </TabsContent>
            </Tabs>
          </div>
          <div className="space-y-2">
            <p className="type-overline text-subtle-foreground">Segmented · binary view</p>
            <Tabs defaultValue="writing">
              <TabsList>
                <TabsTrigger value="writing">Writing</TabsTrigger>
                <TabsTrigger value="speaking">Speaking</TabsTrigger>
                <TabsTrigger value="both">Both</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </Specimen>

      {/* ── Badges ──────────────────────────────────────────── */}
      <Specimen
        title="Badges"
        note="Rectangles say what something is. Pills say where you are with it."
      >
        <div className="grid gap-8 md:grid-cols-3">
          <div className="space-y-3">
            <p className="type-overline text-subtle-foreground">Category · rectangle</p>
            <div className="flex flex-wrap gap-1.5">
              {LANGUAGE_CATEGORY_KEYS.map((key) => (
                <CategoryBadge key={key} category={key} />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <p className="type-overline text-subtle-foreground">Context tags · neutral</p>
            <div className="flex flex-wrap gap-1.5">
              <TagBadge tag="formal" />
              <TagBadge tag="neutral" />
              <TagBadge tag="informal" />
              <TagBadge tag="writing" />
              <TagBadge tag="speaking" />
            </div>
          </div>
          <div className="space-y-3">
            <p className="type-overline text-subtle-foreground">Learning status · pill</p>
            <div className="flex flex-wrap gap-1.5">
              <StatusBadge status="new" />
              <StatusBadge status="learning" />
              <StatusBadge status="due" />
              <StatusBadge status="mastered" />
            </div>
          </div>
        </div>
        <Separator className="my-6 bg-border-subtle" />
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-2 type-caption text-subtle-foreground">Generic</span>
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="ink">Beta</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Incorrect</Badge>
          <span className="ml-4 inline-flex items-center gap-1 type-caption text-muted-foreground">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
            <span className="ml-1">Keys</span>
          </span>
        </div>
      </Specimen>

      {/* ── Cards & tiles ───────────────────────────────────── */}
      <Specimen
        title="Tiles"
        note="Tinted, borderless entry points. Category tints carry meaning; the highlighter appears once per view."
        bare
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tile
            tone="highlight"
            icon={Sparkles}
            title="Today’s focus"
            description="12 prepositions are due"
            href="#components"
          />
          <Tile
            tone="preposition"
            icon={Search}
            title="Prepositions"
            description="responsible for, aware of…"
            href="#components"
          />
          <Tile
            tone="collocation"
            icon={BookMarked}
            title="Collocations"
            description="pose a threat, raise awareness…"
            href="#components"
          />
          <Tile
            tone="linker"
            icon={PenLine}
            title="Linkers"
            description="however, in contrast, whereas…"
            href="#components"
          />
        </div>
      </Specimen>

      <Specimen
        title="Language result cards"
        note="Flat at rest, lifted on hover. Target terms use the highlighter. Bookmark = local demo state."
        bare
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {SAMPLE_RESULTS.slice(0, 4).map(({ id, ...result }) => (
            <LanguageResultCard
              key={id}
              {...result}
              saved={saved.has(id)}
              onSaveToggle={() => toggleSaved(id)}
            />
          ))}
        </div>
      </Specimen>

      <Specimen
        title="Card"
        note="Generic container. Prefer a specific pattern when one exists."
        bare
      >
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Today’s review</CardTitle>
            <CardDescription>12 items are due, mostly prepositions.</CardDescription>
            <CardAction>
              <StatusBadge status="due" />
            </CardAction>
          </CardHeader>
          <CardContent className="type-body text-muted-foreground">
            Short, focused sessions work best. Static sample content.
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button variant="ghost" size="sm">
              Later
            </Button>
            <Button size="sm">Start review</Button>
          </CardFooter>
        </Card>
      </Specimen>

      {/* ── Table ───────────────────────────────────────────── */}
      <Specimen
        title="Table"
        note="Overline headers, subtle row dividers, 44px rows, tabular numbers."
        className="px-2 py-2 sm:px-3 sm:py-3"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Term</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Next review</TableHead>
              <TableHead className="text-right">Accuracy</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SAMPLE_BANK.map((row) => (
              <TableRow key={row.term}>
                <TableCell className="type-term-sm text-foreground">{row.term}</TableCell>
                <TableCell>
                  <CategoryBadge category={row.category} variant="dot" />
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">{row.nextReview}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground tabular-nums">
                  {row.accuracy ? `${row.accuracy}%` : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Specimen>

      {/* ── Navigation ──────────────────────────────────────── */}
      <div className="grid gap-12 lg:grid-cols-5">
        <Specimen
          title="Sidebar"
          note="Compact 30px rows."
          className="bg-sidebar p-3 sm:p-3"
          wrapperClassName="lg:col-span-2"
        >
          <nav aria-label="Sidebar preview" className="space-y-4">
            <div className="flex items-center gap-2 px-2 pt-1">
              <span
                aria-hidden
                className="flex size-6 items-center justify-center rounded-sm bg-primary type-micro font-semibold text-primary-foreground"
              >
                L
              </span>
              <span className="type-label text-foreground">Lexora</span>
            </div>
            <DemoSearchTrigger />
            <div className="space-y-0.5">
              {NAV_PREVIEW.map((item) => (
                <NavItem
                  key={item.label}
                  href="#components"
                  label={item.label}
                  icon={item.icon}
                  active={item.active}
                  count={item.count}
                />
              ))}
            </div>
            <div className="space-y-0.5 border-t border-border pt-3">
              <NavItem href="#components" label="Settings" icon={Settings} />
            </div>
          </nav>
        </Specimen>

        <Specimen
          title="Top bar"
          note="48px. Location left, actions right."
          className="p-0 sm:p-0"
          wrapperClassName="lg:col-span-3"
        >
          <div className="flex h-12 items-center gap-2 border-b border-border px-4">
            <span className="type-caption text-subtle-foreground">Language bank</span>
            <span aria-hidden className="text-subtle-foreground">
              /
            </span>
            <span className="truncate type-label text-foreground">Prepositions</span>
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="sm">
                Share
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </div>
          </div>
          <div className="space-y-2 p-6">
            <p className="type-overline text-subtle-foreground">Content area</p>
            <p className="type-body text-muted-foreground">
              Page content sits on the canvas below the bar, constrained to reading or page width.
            </p>
          </div>
        </Specimen>
      </div>

      {/* ── Overlays ────────────────────────────────────────── */}
      <Specimen
        title="Overlays"
        note="Tooltip, menu, dialog. Radix handles focus and keyboard behaviour."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">Hover or focus me</Button>
            </TooltipTrigger>
            <TooltipContent>Save to language bank</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Register
                <ChevronDown data-icon="inline-end" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>Filter by register</DropdownMenuLabel>
              <DropdownMenuGroup>
                <DropdownMenuItem>Formal</DropdownMenuItem>
                <DropdownMenuItem>Neutral</DropdownMenuItem>
                <DropdownMenuItem>Informal</DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                Clear filter
                <DropdownMenuShortcut>⌫</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Remove from language bank?</DialogTitle>
                <DialogDescription>
                  “pose a threat” and its practice history will be removed. This is a demo — nothing
                  is saved or deleted.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="destructive">Remove</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </Specimen>
    </Section>
  );
}
