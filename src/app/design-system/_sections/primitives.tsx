import { ArrowRight, Bookmark, ChevronDown, Plus, Search } from "lucide-react";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Kbd } from "@/components/lexora/kbd";

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

export function PrimitivesSection() {
  return (
    <Section
      id="primitives"
      eyebrow="Components"
      title="Primitives"
      description="shadcn/ui on Radix, restyled through Lexora tokens. Accessible behaviour comes from Radix; appearance comes from us."
    >
      <Specimen title="Button" note="Charcoal for the primary action. One primary per view.">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            {BUTTON_VARIANTS.map((variant) => (
              <Button key={variant} variant={variant}>
                {variant === "default" ? "Primary" : variant[0]!.toUpperCase() + variant.slice(1)}
              </Button>
            ))}
          </div>
          <Separator />
          <div className="flex flex-wrap items-center gap-3">
            <Button size="xs">Extra small</Button>
            <Button size="sm">Small</Button>
            <Button>Default</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" variant="outline" aria-label="Add">
              <Plus />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Save">
              <Bookmark />
            </Button>
          </div>
          <Separator />
          <div className="flex flex-wrap items-center gap-3">
            <Button>
              Start practice
              <ArrowRight data-icon="inline-end" />
            </Button>
            <Button variant="outline">
              <Search data-icon="inline-start" />
              Search
            </Button>
            <Button disabled>Disabled</Button>
            <Button variant="outline" disabled>
              Disabled
            </Button>
          </div>
        </div>
      </Specimen>

      <div className="grid gap-10 lg:grid-cols-2">
        <Specimen title="Input" note="16px on mobile to prevent zoom; 14px from md.">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="ds-input-default" className="type-label text-foreground">
                Default
              </label>
              <Input id="ds-input-default" placeholder="e.g. responsible" />
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
              <label htmlFor="ds-input-disabled" className="type-label text-muted-foreground">
                Disabled
              </label>
              <Input id="ds-input-disabled" placeholder="Not available" disabled />
            </div>
          </div>
        </Specimen>

        <Specimen
          title="Badge"
          note="Rectangular, small, quiet. Language categories use CategoryBadge."
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="ink">New</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Incorrect</Badge>
          </div>
          <Separator className="my-5" />
          <p className="mb-3 type-label text-foreground">Keyboard keys</p>
          <div className="flex flex-wrap items-center gap-4 type-caption text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
              <span className="ml-1">Command palette</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Kbd>/</Kbd>
              <span className="ml-1">Focus search</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Kbd>Esc</Kbd>
              <span className="ml-1">Close</span>
            </span>
          </div>
        </Specimen>

        <Specimen title="Tabs" note="Segmented for views; line for page sections.">
          <div className="space-y-6">
            <Tabs defaultValue="writing">
              <TabsList>
                <TabsTrigger value="writing">Writing</TabsTrigger>
                <TabsTrigger value="speaking">Speaking</TabsTrigger>
                <TabsTrigger value="both">Both</TabsTrigger>
              </TabsList>
              <TabsContent value="writing" className="type-body text-muted-foreground">
                Formal alternatives suited to Task 1 and Task 2.
              </TabsContent>
              <TabsContent value="speaking" className="type-body text-muted-foreground">
                Natural spoken alternatives for Parts 1–3.
              </TabsContent>
              <TabsContent value="both" className="type-body text-muted-foreground">
                Language that works in either skill.
              </TabsContent>
            </Tabs>
            <Tabs defaultValue="overview">
              <TabsList variant="line">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="examples">Examples</TabsTrigger>
                <TabsTrigger value="mistakes">Mistakes</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </Specimen>

        <Specimen
          title="Overlays"
          note="Tooltip, menu, dialog. All keyboard and screen-reader accessible."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline">Hover or focus me</Button>
              </TooltipTrigger>
              <TooltipContent>
                Save to language bank{" "}
                <Kbd className="ml-1 border-transparent bg-background/15 text-background shadow-none">
                  S
                </Kbd>
              </TooltipContent>
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
                    “pose a threat” and its practice history will be removed. This is a
                    design-system demo — nothing is saved or deleted.
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
      </div>

      <Specimen
        title="Card"
        note="Generic container. Prefer specific patterns (result card, practice card) where they exist."
        className="bg-background"
      >
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Today’s review</CardTitle>
            <CardDescription>12 items are due, mostly prepositions.</CardDescription>
            <CardAction>
              <Badge variant="ink">12 due</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="type-body text-muted-foreground">
            Short, focused sessions work best. This card is static sample content.
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button variant="ghost" size="sm">
              Later
            </Button>
            <Button size="sm">Start review</Button>
          </CardFooter>
        </Card>
      </Specimen>
    </Section>
  );
}
