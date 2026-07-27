"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PortfolioAlbumCard } from "@/components/portfolio/PortfolioAlbumCard";
import { PortfolioImage } from "@/components/portfolio/PortfolioImage";
import {
  getPopularAlbumTags,
  type PublicAlbumSet,
  type PublicAlbumSummary
} from "@/lib/portfolio";

export function PortfolioIndex({
  albums = [],
  hero = false,
  heroAlbums = [],
  sets
}: {
  albums?: PublicAlbumSummary[];
  hero?: boolean;
  heroAlbums?: PublicAlbumSummary[];
  sets?: PublicAlbumSet[];
}) {
  const sections = sets ?? [{
    albums,
    id: "index",
    popularTags: getPopularAlbumTags(albums),
    slug: "index",
    subtitle: "",
    title: "index"
  }];

  return (
    <main className="portfolio-main">
      {hero && heroAlbums.length ? (
        <PortfolioHero albums={heroAlbums} />
      ) : (
        <div className="portfolio-header-spacer" />
      )}
      {sections.map((section, index) => (
        <section
          aria-label={section.title}
          className="portfolio-index"
          id={index === 0 ? "index" : `set-${section.slug}`}
          key={section.id}
        >
          <div className="portfolio-index__head">
            <h1>{section.title}</h1>
            {section.popularTags.length ? (
              <nav
                aria-label={`Popular tags in ${section.title}`}
                className="portfolio-popular-tags"
              >
                {section.popularTags.map((tag) => (
                  <Link href={`/tags/${tag.slug}`} key={tag.slug}>{tag.label}</Link>
                ))}
              </nav>
            ) : null}
          </div>
          <div className="portfolio-album-grid">
            {section.albums.map((album) => (
              <PortfolioAlbumCard album={album} key={album.id} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}

function PortfolioHero({ albums }: { albums: PublicAlbumSummary[] }) {
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
        return album.coverUrl ? (
          <PortfolioImage
            alt={`Cover of ${album.title}`}
            decoding="async"
            fetchPriority={index === 0 ? "high" : "low"}
            key={album.id}
            loading={index === 0 ? "eager" : "lazy"}
            src={album.coverUrl}
            wrapperClassName={index === active ? "is-active" : undefined}
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
