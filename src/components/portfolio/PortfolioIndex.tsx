"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAdminArchive } from "@/admin/admin-state";
import {
  getAlbumCover,
  getHomepageAlbums,
  getHeroAlbums,
  getPublicAlbums,
  getPublicPhotosForAlbum,
  isFilmAlbum
} from "@/lib/portfolio";

type AlbumFilter = "all" | "film" | "digital";

export function PortfolioIndex({ hero = false }: { hero?: boolean }) {
  const { archive, previewUrls } = useAdminArchive();
  const albums = hero ? getHomepageAlbums(archive) : getPublicAlbums(archive);
  const heroAlbums = getHeroAlbums(archive).filter((album) =>
    getAlbumCover(archive, previewUrls, album)
  );
  const [filter, setFilter] = useState<AlbumFilter>("all");
  const shownAlbums = useMemo(
    () =>
      albums.filter((album) => {
        if (filter === "all") return true;
        return filter === "film" ? isFilmAlbum(album) : !isFilmAlbum(album);
      }),
    [albums, filter]
  );

  return (
    <main className="portfolio-main">
      {hero && heroAlbums.length ? (
        <PortfolioHero albums={heroAlbums} />
      ) : (
        <div className="portfolio-header-spacer" />
      )}
      <section aria-label="Albums" className="portfolio-index" id="index">
        <div className="portfolio-index__head">
          <h1>index</h1>
          <div aria-label="Filter albums" className="portfolio-filters" role="group">
            {(["all", "film", "digital"] as AlbumFilter[]).map((value) => (
              <button
                aria-pressed={filter === value}
                className={filter === value ? "is-active" : undefined}
                key={value}
                onClick={() => setFilter(value)}
                type="button"
              >
                {value === "film" ? "film photography" : value === "digital" ? "digital photo" : "all"}
              </button>
            ))}
          </div>
        </div>
        <div className="portfolio-album-grid">
          {shownAlbums.map((album) => {
            const cover = getAlbumCover(archive, previewUrls, album);
            const count = getPublicPhotosForAlbum(archive, album.id).length;

            return (
              <Link className="portfolio-album-card" href={`/albums/${album.slug}`} key={album.id}>
                <span className="portfolio-album-card__cover">
                  {cover ? <img alt={`Cover of ${album.title}`} decoding="async" loading="lazy" src={cover} /> : null}
                </span>
                <span className="portfolio-album-card__meta">
                  <strong>{album.title}</strong>
                  <small>{album.subtitle}{count ? ` · ${count}` : ""}</small>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function PortfolioHero({ albums }: { albums: ReturnType<typeof getHeroAlbums> }) {
  const { archive, previewUrls } = useAdminArchive();
  const [active, setActive] = useState(0);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion.current || albums.length < 2) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setActive((index) => (index + 1) % albums.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [albums.length]);

  const current = albums[active] ?? albums[0];

  return (
    <section className="portfolio-hero">
      {albums.map((album, index) => {
        const cover = getAlbumCover(archive, previewUrls, album);
        return cover ? (
          <img
            alt={`Cover of ${album.title}`}
            className={index === active ? "is-active" : undefined}
            decoding="async"
            fetchPriority={index === 0 ? "high" : "low"}
            key={album.id}
            loading={index === 0 ? "eager" : "lazy"}
            src={cover}
          />
        ) : null;
      })}
      <Link aria-label={`Open ${current.title}`} className="portfolio-hero__link" href={`/albums/${current.slug}`}>
        <span>{current.title}</span>
        <small>view</small>
      </Link>
      <button
        aria-label="Scroll to album index"
        className="portfolio-hero__cue portfolio-icon-button"
        onClick={() => document.getElementById("index")?.scrollIntoView({ behavior: "smooth" })}
        type="button"
      >
        <ChevronDown aria-hidden />
      </button>
    </section>
  );
}
