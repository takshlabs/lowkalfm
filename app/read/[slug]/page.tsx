import { ReadArticle } from "@/components/ReadArticle";

import { isSanityConfigured, sanityFetch, storiesQuery } from "@/lib/sanity";

export async function generateStaticParams() {
  const stories = isSanityConfigured ? await sanityFetch<Array<{ slug: string }>>(storiesQuery) : [];
  return [...new Set(stories.map((story) => story.slug).filter(Boolean))].map((slug) => ({ slug }));
}

export default function ReadArticlePage() {
  return <ReadArticle />;
}
