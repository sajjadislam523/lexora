import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LanguageDetail } from "@/features/language/language-detail";
import { languageRepository } from "@/language";
import type { LanguageItem } from "@/language/types";

// Only items in the library exist; anything else is a real 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return languageRepository.listItems().map((item) => ({ slug: item.slug }));
}

function displayTerm(item: LanguageItem) {
  return item.term.replace(/,$/, "");
}

/** Meaning first, then when to use it — trimmed to a search-result-sized description. */
function describe(item: LanguageItem) {
  const text = `${displayTerm(item)}: ${item.meaning} ${item.bestWhen}`;
  return text.length <= 160 ? text : `${text.slice(0, 157).replace(/\s+\S*$/, "")}…`;
}

export async function generateMetadata(props: PageProps<"/language/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const item = languageRepository.getItem(slug);
  if (!item) return { title: "Language" };

  const title = `${displayTerm(item)} — meaning, examples and how to use it`;
  const description = describe(item);
  return {
    title,
    description,
    alternates: { canonical: `/language/${item.slug}` },
    openGraph: { type: "article", title, description, url: `/language/${item.slug}` },
  };
}

/** schema.org DefinedTerm, so search engines can read the term and its meaning. */
function StructuredData({ item }: { item: LanguageItem }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: displayTerm(item),
    description: item.meaning,
    inDefinedTermSet: { "@type": "DefinedTermSet", name: "Lexora — English for IELTS Academic" },
  };
  return (
    <script
      type="application/ld+json"
      // Our own content, serialised; "<" is escaped so the JSON can't close the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export default async function LanguagePage(props: PageProps<"/language/[slug]">) {
  const { slug } = await props.params;
  const item = languageRepository.getItem(slug);
  if (!item) notFound();
  return (
    <>
      <StructuredData item={item} />
      <LanguageDetail item={item} />
    </>
  );
}
