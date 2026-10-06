import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DEMO_LANGUAGE, getLanguageItem } from "@/demo/language";
import { LanguageDetail } from "@/features/language/language-detail";

// Only the demo items exist in the prototype; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return DEMO_LANGUAGE.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata(props: PageProps<"/language/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const item = getLanguageItem(slug);
  return { title: item ? item.term.replace(/,$/, "") : "Language" };
}

export default async function LanguagePage(props: PageProps<"/language/[slug]">) {
  const { slug } = await props.params;
  const item = getLanguageItem(slug);
  if (!item) notFound();
  return <LanguageDetail item={item} />;
}
