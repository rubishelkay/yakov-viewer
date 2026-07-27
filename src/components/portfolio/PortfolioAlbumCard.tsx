import { PortfolioImage } from "@/components/portfolio/PortfolioImage";
import { PortfolioTagLinks } from "@/components/portfolio/PortfolioTagLinks";
import type { PublicAlbumSummary } from "@/lib/portfolio";

export function PortfolioAlbumCard({
  album
}: {
  album: PublicAlbumSummary;
}) {
  return (
    <article className="portfolio-album-card">
      <a aria-label={`Open ${album.title}`} href={`/albums/${album.slug}`}>
        <span className="portfolio-album-card__cover">
          {album.coverUrl ? (
            <PortfolioImage
              alt={`Cover of ${album.title}`}
              decoding="async"
              loading="lazy"
              src={album.coverUrl}
            />
          ) : null}
        </span>
      </a>
      <span className="portfolio-album-card__meta">
        <a href={`/albums/${album.slug}`}><strong>{album.title}</strong></a>
        <small><PortfolioTagLinks album={album} count={album.photoCount} /></small>
      </span>
    </article>
  );
}
