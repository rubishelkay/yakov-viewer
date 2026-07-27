"use client";

import { usePathname } from "next/navigation";
import { Shuffle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ThemeToggle } from "@/components/layout/ThemeToggle";
import type { PublicAlbumSummary } from "@/lib/portfolio";

export function PortfolioHeader({ albums }: { albums: PublicAlbumSummary[] }) {
  const pathname = usePathname();
  const [overHero, setOverHero] = useState(pathname === "/");
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    if (pathname !== "/") return;

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const hero = document.querySelector(".portfolio-hero");
        setOverHero(Boolean(hero && hero.getBoundingClientRect().bottom > 52));
      });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
    };
  }, [pathname]);

  useEffect(() => {
    let frame = 0;
    lastScrollY.current = window.scrollY;
    frame = requestAnimationFrame(() => setHidden(false));

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const current = Math.max(0, window.scrollY);
        const delta = current - lastScrollY.current;

        if (current <= 12) setHidden(false);
        else if (delta > 6) setHidden(true);
        else if (delta < -6) setHidden(false);

        if (Math.abs(delta) > 2) lastScrollY.current = current;
      });
    };

    window.addEventListener("scroll", update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
    };
  }, [pathname]);

  function openRandomPhoto() {
    const choices = albums.filter((album) => album.photoCount > 0);

    if (!choices.length) return;
    const album = choices[Math.floor(Math.random() * choices.length)];
    const photoIndex = Math.floor(Math.random() * album.photoCount);
    window.location.assign(`/albums/${album.slug}?photo=${photoIndex + 1}`);
  }

  const headerClassName = [
    "portfolio-header",
    pathname === "/" && overHero ? "portfolio-header--overlay" : "",
    hidden ? "portfolio-header--hidden" : ""
  ].filter(Boolean).join(" ");

  return (
    <header className={headerClassName}>
      {/* A document navigation lets Cloudflare serve the cached public HTML. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a className="portfolio-title" href="/">
        Yakov Shmol
      </a>
      <div className="portfolio-header__actions">
        <button
          aria-label="Random photo"
          className="portfolio-icon-button"
          onClick={openRandomPhoto}
          title="Random photo"
          type="button"
        >
          <Shuffle aria-hidden />
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
}
