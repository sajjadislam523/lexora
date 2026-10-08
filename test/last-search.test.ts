import { afterEach, describe, expect, it, vi } from "vitest";

import { readLastSearch, rememberSearch } from "@/lib/last-search";

/** "Back to search" links to this value, so only Lexora's own search pages may come back out. */
function withStorage(storage: Partial<Storage>) {
  vi.stubGlobal("window", { sessionStorage: storage });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("last search", () => {
  it("remembers the last results page of Explore or the Finder", () => {
    const store = new Map<string, string>();
    withStorage({
      setItem: (k, v) => void store.set(k, v),
      getItem: (k) => store.get(k) ?? null,
    });
    expect(readLastSearch()).toBeNull();
    rememberSearch("/explore?q=important");
    expect(readLastSearch()).toBe("/explore?q=important");
    rememberSearch("/finder?q=preposition%20after%20responsible");
    expect(readLastSearch()).toBe("/finder?q=preposition%20after%20responsible");
  });

  it.each([
    "https://evil.example/explore?q=x",
    "//evil.example/explore?q=x",
    "/explore",
    "/language/significant",
    "javascript:alert(1)",
  ])("ignores %s", (value) => {
    withStorage({ getItem: () => value });
    expect(readLastSearch()).toBeNull();
  });

  it("works without storage (private browsing)", () => {
    withStorage({
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    });
    expect(() => rememberSearch("/explore?q=important")).not.toThrow();
    expect(readLastSearch()).toBeNull();
  });
});
