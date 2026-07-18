"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Shuffle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useAdminArchive } from "@/admin/admin-state";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { getPublicAlbums, getPublicPhotosForAlbum } from "@/lib/portfolio";

export function PortfolioHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { archive } = useAdminArchive();
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
    const choices = getPublicAlbums(archive)
      .map((album) => ({ album, photos: getPublicPhotosForAlbum(archive, album.id) }))
      .filter((choice) => choice.photos.length > 0);

    if (!choices.length) return;
    const choice = choices[Math.floor(Math.random() * choices.length)];
    const photoIndex = Math.floor(Math.random() * choice.photos.length);
    router.push(`/albums/${choice.album.slug}?photo=${photoIndex + 1}`);
  }

  const headerClassName = [
    "portfolio-header",
    pathname === "/" && overHero ? "portfolio-header--overlay" : "",
    hidden ? "portfolio-header--hidden" : ""
  ].filter(Boolean).join(" ");

  return (
    <header className={headerClassName}>
      <Link className="portfolio-title" href="/">
        Yakov Shmol
      </Link>
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
