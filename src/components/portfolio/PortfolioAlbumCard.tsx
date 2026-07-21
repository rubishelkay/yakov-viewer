import Link from "next/link";

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
      <Link aria-label={`Open ${album.title}`} href={`/albums/${album.slug}`}>
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
      </Link>
      <span className="portfolio-album-card__meta">
        <Link href={`/albums/${album.slug}`}><strong>{album.title}</strong></Link>
        <small><PortfolioTagLinks album={album} count={album.photoCount} /></small>
      </span>
    </article>
  );
}
