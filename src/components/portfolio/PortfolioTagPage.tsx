import { PortfolioAlbumCard } from "@/components/portfolio/PortfolioAlbumCard";
import type { PublicAlbumSummary, PublicTag } from "@/lib/portfolio";

export function PortfolioTagPage({
  albums,
  tag
}: {
  albums: PublicAlbumSummary[];
  tag: PublicTag;
}) {

  return (
    <main className="portfolio-tag-page">
      <header className="portfolio-tag-head">
        <h1>{tag.label}</h1>
        <p>{albums.length} {albums.length === 1 ? "album" : "albums"}</p>
      </header>
      <div className="portfolio-album-grid">
        {albums.map((album) => (
          <PortfolioAlbumCard album={album} key={album.id} />
        ))}
      </div>
    </main>
  );
}
