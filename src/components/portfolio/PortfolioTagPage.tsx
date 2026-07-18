"use client";

import { useAdminArchive } from "@/admin/admin-state";
import { PortfolioAlbumCard } from "@/components/portfolio/PortfolioAlbumCard";
import {
  getPublicAlbumsForTag,
  getPublicTagBySlug
} from "@/lib/portfolio";

export function PortfolioTagPage({ slug }: { slug: string }) {
  const { archive, previewUrls } = useAdminArchive();
  const tag = getPublicTagBySlug(archive, slug);
  const albums = tag ? getPublicAlbumsForTag(archive, tag.id) : [];

  if (!tag) return <main className="portfolio-empty">Tag is not published.</main>;

  return (
    <main className="portfolio-tag-page">
      <header className="portfolio-tag-head">
        <h1>{tag.label}</h1>
        <p>{albums.length} {albums.length === 1 ? "album" : "albums"}</p>
      </header>
      <div className="portfolio-album-grid">
        {albums.map((album) => (
          <PortfolioAlbumCard
            album={album}
            archive={archive}
            key={album.id}
            previewUrls={previewUrls}
          />
        ))}
      </div>
    </main>
  );
}
