import { HighlightedText } from "@/components/lexora/highlighted-text";
import { TagBadge } from "@/components/lexora/tag-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DemoExample } from "@/demo/types";

function ExampleList({ examples }: { examples: DemoExample[] }) {
  return (
    <ul className="space-y-4">
      {examples.map((example) => (
        <li key={example.text} className="space-y-2 border-l-2 border-border-strong pl-4">
          <p className="type-example text-foreground">
            <HighlightedText text={example.text} highlight={example.highlight} />
          </p>
          <TagBadge tag={example.skill} />
        </li>
      ))}
    </ul>
  );
}

/** Examples, filterable by skill when both writing and speaking examples exist. */
export function ExamplesSection({ examples }: { examples: DemoExample[] }) {
  const writing = examples.filter((e) => e.skill === "writing");
  const speaking = examples.filter((e) => e.skill === "speaking");

  if (writing.length === 0 || speaking.length === 0) return <ExampleList examples={examples} />;

  return (
    <Tabs defaultValue="all" className="gap-5">
      <TabsList>
        <TabsTrigger value="all">All</TabsTrigger>
        <TabsTrigger value="writing">Writing</TabsTrigger>
        <TabsTrigger value="speaking">Speaking</TabsTrigger>
      </TabsList>
      <TabsContent value="all">
        <ExampleList examples={examples} />
      </TabsContent>
      <TabsContent value="writing">
        <ExampleList examples={writing} />
      </TabsContent>
      <TabsContent value="speaking">
        <ExampleList examples={speaking} />
      </TabsContent>
    </Tabs>
  );
}
