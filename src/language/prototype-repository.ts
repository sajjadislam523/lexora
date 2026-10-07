import { DEMO_LANGUAGE } from "@/demo/language";
import type { DemoLanguageItem } from "@/demo/types";

import type { LanguageRepository } from "./repository";
import type { LanguageItem } from "./types";

/** Strips the prototype's sample learner status so it can never reach a public page. */
function toLanguageItem({ status: _status, ...item }: DemoLanguageItem): LanguageItem {
  return item;
}

/** The hand-written prototype content (src/demo), served through the repository interface. */
export class PrototypeLanguageRepository implements LanguageRepository {
  private readonly items: readonly LanguageItem[];
  private readonly bySlug: ReadonlyMap<string, LanguageItem>;

  constructor(items: readonly DemoLanguageItem[] = DEMO_LANGUAGE) {
    this.items = items.map(toLanguageItem);
    this.bySlug = new Map(this.items.map((item) => [item.slug, item]));
  }

  getItem(slug: string) {
    return this.bySlug.get(slug);
  }

  listItems() {
    return this.items;
  }
}
