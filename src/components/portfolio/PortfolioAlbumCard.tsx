import Link from "next/link";

import type { LocalAdminArchive, LocalArchiveAlbum } from "@/admin/admin-state";
import { PortfolioImage } from "@/components/portfolio/PortfolioImage";
import { PortfolioTagLinks } from "@/components/portfolio/PortfolioTagLinks";
import { getAlbumCover, getPublicPhotosForAlbum, type PreviewUrls } from "@/lib/portfolio";

export function PortfolioAlbumCard({
  album,
  archive,
  previewUrls
}: {
  album: LocalArchiveAlbum;
  archive: LocalAdminArchive;
  previewUrls: PreviewUrls;
}) {
  const cover = getAlbumCover(archive, previewUrls, album);
  const count = getPublicPhotosForAlbum(archive, album.id).length;

  return (
    <article className="portfolio-album-card">
      <Link aria-label={`Open ${album.title}`} href={`/albums/${album.slug}`}>
        <span className="portfolio-album-card__cover">
          {cover ? (
            <PortfolioImage
              alt={`Cover of ${album.title}`}
              decoding="async"
              loading="lazy"
              src={cover}
            />
          ) : null}
        </span>
      </Link>
      <span className="portfolio-album-card__meta">
        <Link href={`/albums/${album.slug}`}><strong>{album.title}</strong></Link>
        <small><PortfolioTagLinks album={album} archive={archive} count={count} /></small>
      </span>
    </article>
  );
}
