import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PortfolioAlbum } from "@/components/portfolio/PortfolioAlbum";
import { adminArchive } from "@/admin/mock-data";

export function generateStaticParams() {
  return adminArchive.albums
    .filter((album) => album.status === "published" && !album.isDemo)
    .map((album) => ({ slug: album.slug }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const album = adminArchive.albums.find((item) => item.slug === slug);

  return {
    title: album?.title ?? "Album",
    description: album?.subtitle
  };
}

export default async function AlbumPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const album = adminArchive.albums.find(
    (item) => item.slug === slug && item.status === "published" && !item.isDemo
  );

  if (!album) notFound();

  return (
    <Suspense fallback={<main className="portfolio-empty">Loading album...</main>}>
      <PortfolioAlbum slug={slug} />
    </Suspense>
  );
}
