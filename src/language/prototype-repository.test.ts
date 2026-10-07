import { describe, expect, it } from "vitest";

import { PrototypeLanguageRepository } from "./prototype-repository";

describe("PrototypeLanguageRepository", () => {
  const repository = new PrototypeLanguageRepository();

  it("keeps learner data out of public language items", () => {
    for (const item of repository.listItems()) expect(item).not.toHaveProperty("status");
  });

  it("has unique slugs, and every relation points at a real item", () => {
    const slugs = repository.listItems().map((item) => item.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const item of repository.listItems()) {
      for (const related of item.related ?? []) {
        if (related.slug) expect(repository.getItem(related.slug)).toBeDefined();
      }
    }
  });
});
