import type { Metadata } from "next";

import { adminArchive } from "@/admin/mock-data";
import { PortfolioTagPage } from "@/components/portfolio/PortfolioTagPage";

export function generateStaticParams() {
  const publicTagIds = new Set(
    adminArchive.albums
      .filter((album) => album.status === "published" && !album.isDemo)
      .flatMap((album) => album.tagIds)
  );

  return adminArchive.tags
    .filter((tag) => publicTagIds.has(tag.id))
    .map((tag) => ({ slug: tag.slug }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tag = adminArchive.tags.find((item) => item.slug === slug);

  return {
    title: tag?.label ?? "Tag",
    description: tag ? `Photographs tagged ${tag.label}.` : "Photography tag."
  };
}

export default async function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PortfolioTagPage slug={slug} />;
}
