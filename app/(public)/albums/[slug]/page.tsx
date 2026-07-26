import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PortfolioAlbum } from "@/components/portfolio/PortfolioAlbum";
import { readPublicAlbumBySlug } from "@/server/cloudflare/public-portfolio-d1";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const album = await readPublicAlbumBySlug(slug);

  return {
    title: album?.title ?? "Album",
    description: album?.subtitle
  };
}

export default async function AlbumPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const album = await readPublicAlbumBySlug(slug);

  if (!album) notFound();

  return (
    <Suspense fallback={<main className="portfolio-empty">Loading album...</main>}>
      <PortfolioAlbum album={album} />
    </Suspense>
  );
}
