import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PortfolioAlbum } from "@/components/portfolio/PortfolioAlbum";
import {
  readPublicAlbumNavigation,
  readPublicAlbumBySlug
} from "@/server/cloudflare/public-portfolio-d1";

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
  const [album, albums] = await Promise.all([
    readPublicAlbumBySlug(slug),
    readPublicAlbumNavigation()
  ]);

  if (!album) notFound();

  const currentIndex = albums.findIndex((item) => item.id === album.id);
  const hasNeighbors = currentIndex >= 0 && albums.length > 1;
  const previousAlbum = hasNeighbors
    ? albums[(currentIndex - 1 + albums.length) % albums.length]
    : undefined;
  const nextAlbum = hasNeighbors
    ? albums[(currentIndex + 1) % albums.length]
    : undefined;

  return (
    <Suspense fallback={<main className="portfolio-empty">Loading album...</main>}>
      <PortfolioAlbum
        album={album}
        currentYear={new Date().getUTCFullYear()}
        nextAlbum={nextAlbum ? { slug: nextAlbum.slug, title: nextAlbum.title } : undefined}
        previousAlbum={previousAlbum ? {
          slug: previousAlbum.slug,
          title: previousAlbum.title
        } : undefined}
      />
    </Suspense>
  );
}
