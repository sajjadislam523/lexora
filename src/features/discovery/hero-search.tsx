"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SearchField } from "@/components/lexora/search-field";
import { Button } from "@/components/ui/button";
import { searchHref } from "@/language/examples";

/** The landing page search. Searching opens Explore with the results — no account needed. */
export function HeroSearch() {
  const router = useRouter();
  const [text, setText] = useState("");

  return (
    <form
      role="search"
      aria-label="Search Lexora"
      onSubmit={(event) => {
        event.preventDefault();
        router.push(searchHref("/explore", text));
      }}
    >
      <SearchField
        size="lg"
        label="What are you trying to say?"
        placeholder="What are you trying to say?"
        value={text}
        onChange={(event) => setText(event.target.value)}
        hint={
          // Icon-only on phones, so the placeholder has room to be read.
          <Button type="submit" size="sm" aria-label="Search" className="max-sm:px-2">
            <span className="max-sm:hidden">Search</span>
            <ArrowRight aria-hidden className="sm:hidden" />
          </Button>
        }
      />
    </form>
  );
}
