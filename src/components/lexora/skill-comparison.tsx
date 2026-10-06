import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { HighlightedText } from "./highlighted-text";
import { TagBadge } from "./tag-badge";

type Line = { text: string; highlight?: string };

type SkillComparisonProps = {
  writing: Line;
  speaking: Line;
  /** One short line on why they differ. */
  note?: string;
  className?: string;
};

function Panel({ skill, line }: { skill: "writing" | "speaking"; line: Line }) {
  return (
    <div className="h-full rounded-md border border-border bg-card p-4">
      <TagBadge tag={skill} />
      <p className="mt-3 type-example text-foreground">
        <HighlightedText text={line.text} highlight={line.highlight} />
      </p>
    </div>
  );
}

/**
 * The same idea in writing and in speaking. Side by side from `sm`; a segmented switch on
 * small screens so the pair stays comparable without a long stack.
 */
export function SkillComparison({ writing, speaking, note, className }: SkillComparisonProps) {
  return (
    <div data-slot="skill-comparison" className={cn("space-y-3", className)}>
      <div className="grid grid-cols-2 gap-3 max-sm:hidden">
        <Panel skill="writing" line={writing} />
        <Panel skill="speaking" line={speaking} />
      </div>
      <Tabs defaultValue="writing" className="sm:hidden">
        <TabsList className="w-full">
          <TabsTrigger value="writing">Writing</TabsTrigger>
          <TabsTrigger value="speaking">Speaking</TabsTrigger>
        </TabsList>
        <TabsContent value="writing">
          <Panel skill="writing" line={writing} />
        </TabsContent>
        <TabsContent value="speaking">
          <Panel skill="speaking" line={speaking} />
        </TabsContent>
      </Tabs>
      {note ? <p className="type-caption text-muted-foreground">{note}</p> : null}
    </div>
  );
}
