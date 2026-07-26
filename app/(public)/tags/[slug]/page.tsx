import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PortfolioTagPage } from "@/components/portfolio/PortfolioTagPage";
import {
  readPublicAlbumsForTag,
  readPublicTagBySlug
} from "@/server/cloudflare/public-portfolio-d1";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tag = await readPublicTagBySlug(slug);

  return {
    title: tag?.label ?? "Tag",
    description: tag ? `Photographs tagged ${tag.label}.` : "Photography tag."
  };
}

export default async function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tag = await readPublicTagBySlug(slug);
  if (!tag) notFound();

  return <PortfolioTagPage albums={await readPublicAlbumsForTag(slug)} tag={tag} />;
}
