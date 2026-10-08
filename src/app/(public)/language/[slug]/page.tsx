import type { Metadata } from "next";
import { cache } from "react";

import { LanguageDetail } from "@/features/language/language-detail";
import { loadLanguagePage } from "@/features/language/load-language-page";
import { languageContent } from "@/language";
import type { LanguageDetail as LanguageDetailData } from "@/language/model";

/**
 * Language pages, rendered from the published content in PostgreSQL. Published items are built
 * at deploy time and refreshed hourly; anything published later renders on first request, so a
 * published item is never a 404. Drafts and unknown slugs are real 404s; old slugs and retired
 * items with a replacement redirect (308).
 */
export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  return (await languageContent.listPublishedSlugs()).map((slug) => ({ slug }));
}

/** One lookup per request, shared by the metadata and the page. */
const load = cache((slug: string) => loadLanguagePage(languageContent, slug));

/** Meaning first, then when to use it — trimmed to a search-result-sized description. */
function describe(item: LanguageDetailData) {
  const sense = item.senses[0]!;
  const text = `${item.headword}: ${sense.definition} ${sense.bestWhen}`;
  return text.length <= 160 ? text : `${text.slice(0, 157).replace(/\s+\S*$/, "")}…`;
}

export async function generateMetadata(props: PageProps<"/language/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const item = await load(slug);
  const title = `${item.headword} — meaning, examples and how to use it`;
  const description = describe(item);
  return {
    title,
    description,
    alternates: { canonical: `/language/${item.slug}` },
    openGraph: { type: "article", title, description, url: `/language/${item.slug}` },
  };
}

/** schema.org DefinedTerm, so search engines can read the term and its meaning. */
function StructuredData({ item }: { item: LanguageDetailData }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: item.headword,
    description: item.senses[0]!.definition,
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
  const item = await load(slug);
  return (
    <>
      <StructuredData item={item} />
      <LanguageDetail item={item} />
    </>
  );
}
