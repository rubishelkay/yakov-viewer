"use client";

import Link from "next/link";

import { useAdminArchive } from "@/admin/admin-state";
import { PortfolioImage } from "@/components/portfolio/PortfolioImage";
import {
  getPortfolioPhotoSources,
  getPublicPhotosForTag,
  getPublicTagBySlug
} from "@/lib/portfolio";

export function PortfolioTagPage({ slug }: { slug: string }) {
  const { archive, previewUrls } = useAdminArchive();
  const tag = getPublicTagBySlug(archive, slug);
  const entries = tag ? getPublicPhotosForTag(archive, tag.id) : [];

  if (!tag) return <main className="portfolio-empty">Tag is not published.</main>;

  return (
    <main className="portfolio-tag-page">
      <header className="portfolio-tag-head">
        <h1>{tag.label}</h1>
        <p>{entries.length} photographs</p>
      </header>
      <div className="portfolio-tag-grid">
        {entries.map(({ album, index, photo }) => {
          const sources = getPortfolioPhotoSources(archive, previewUrls, photo);
          const source = sources.thumb ?? sources.display;

          return (
            <Link
              aria-label={`Open ${photo.title} in ${album.title}`}
              className="portfolio-tag-photo"
              href={`/albums/${album.slug}?photo=${index + 1}`}
              key={photo.id}
              style={{ "--photo-ratio": `${photo.width} / ${photo.height}` } as React.CSSProperties}
            >
              {source ? (
                <PortfolioImage
                  alt={photo.title}
                  decoding="async"
                  height={photo.height}
                  loading="lazy"
                  src={source}
                  width={photo.width}
                />
              ) : null}
            </Link>
          );
        })}
      </div>
    </main>
  );
}
