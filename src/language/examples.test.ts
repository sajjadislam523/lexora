import { describe, expect, it } from "vitest";

import { EXAMPLE_SEARCHES, FEATURED_SEARCHES, searchHref } from "./examples";

describe("example searches", () => {
  it("features six searches", () => {
    expect(FEATURED_SEARCHES).toHaveLength(6);
    expect(new Set(EXAMPLE_SEARCHES.map((search) => search.id)).size).toBe(EXAMPLE_SEARCHES.length);
  });

  it("builds search URLs for the Finder and Explore", () => {
    expect(searchHref("/explore", "  responsible of ")).toBe("/explore?q=responsible%20of");
    expect(searchHref("/finder", "   ")).toBe("/finder");
  });
});
