import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PortfolioTagPage } from "@/components/portfolio/PortfolioTagPage";
import { getPublicAlbumsForTag, getPublicTagBySlug, getPublicTags } from "@/lib/portfolio";

export function generateStaticParams() {
  return getPublicTags().map((tag) => ({ slug: tag.slug }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tag = getPublicTagBySlug(slug);

  return {
    title: tag?.label ?? "Tag",
    description: tag ? `Photographs tagged ${tag.label}.` : "Photography tag."
  };
}

export default async function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tag = getPublicTagBySlug(slug);
  if (!tag) notFound();

  return <PortfolioTagPage albums={getPublicAlbumsForTag(slug)} tag={tag} />;
}
