"use client";

import { ChevronLeft, ChevronRight, Download, ExternalLink, Info, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { Photo } from "@/content/schema";
import { getImageUrl } from "@/lib/images";

import { ResponsiveImage } from "./ResponsiveImage";

type PhotoLightboxProps = {
  photos: Photo[];
  dense?: boolean;
  layout?: "grid" | "scroll";
};

export function PhotoLightbox({ photos, dense = false, layout = "grid" }: PhotoLightboxProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [showInfo, setShowInfo] = useState(true);

  const activePhoto = activeIndex === null ? null : photos[activeIndex] ?? null;

  const canNavigate = photos.length > 1;

  useEffect(() => {
    if (activeIndex === null) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveIndex(null);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      }
      if (event.key.toLowerCase() === "i") {
        event.preventDefault();
        setShowInfo((value) => !value);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const ariaLabel = useMemo(() => {
    if (!activePhoto) {
      return "Photo lightbox";
    }
    return `${activePhoto.title}, frame ${activePhoto.frameNumber ?? activeIndex ?? 0}`;
  }, [activeIndex, activePhoto]);

  function go(direction: number) {
    setActiveIndex((current) => {
      if (current === null) {
        return current;
      }
      return (current + direction + photos.length) % photos.length;
    });
  }

  return (
    <>
      {layout === "scroll" ? (
        <div className="album-scroll">
          {photos.map((photo, index) => (
            <button
              type="button"
              className="album-frame album-frame-button"
              key={photo.id}
              onClick={() => setActiveIndex(index)}
              aria-label={`Open ${photo.title}`}
            >
              <div className="album-frame__image">
                <ResponsiveImage
                  photo={photo}
                  preset="detail"
                  sizes="min(100vw - 32px, 1600px)"
                />
              </div>
              <div className="album-frame__caption">
                <span>{photo.title}</span>
                <span>
                  {photo.camera} / {photo.filmStock}
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className={dense ? "photo-grid photo-grid--dense" : "photo-grid"}>
          {photos.map((photo, index) => (
            <button
              type="button"
              className="photo-tile"
              key={photo.id}
              onClick={() => setActiveIndex(index)}
              aria-label={`Open ${photo.title}`}
            >
              <ResponsiveImage
                photo={photo}
                preset={dense ? "thumb" : "grid"}
                sizes={
                  dense ? "150px" : "(min-width: 1100px) 25vw, (min-width: 720px) 33vw, 50vw"
                }
              />
            </button>
          ))}
        </div>
      )}

      {activePhoto ? (
        <div
          className="lightbox-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
        >
          <div className="lightbox-top">
            <button
              type="button"
              className="icon-button"
              aria-label="Close photo"
              onClick={() => setActiveIndex(null)}
            >
              <X aria-hidden="true" />
            </button>
            <div className="lightbox-nav">
              <button
                type="button"
                className="icon-button"
                aria-label="Previous photo"
                onClick={() => go(-1)}
                disabled={!canNavigate}
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label="Next photo"
                onClick={() => go(1)}
                disabled={!canNavigate}
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="lightbox-stage">
            <img
              src={getImageUrl(activePhoto, 2400, 90)}
              alt={activePhoto.alt}
              width={activePhoto.width}
              height={activePhoto.height}
            />
          </div>

          <div className="lightbox-bottom">
            {showInfo ? (
              <div>
                <strong>{activePhoto.title}</strong>
                <div className="meta-line">
                  {activePhoto.camera} / {activePhoto.filmStock} / {activePhoto.location.city}
                </div>
              </div>
            ) : (
              <span />
            )}
            <div className="lightbox-nav">
              <button
                type="button"
                className="icon-button"
                aria-label="Toggle photo info"
                onClick={() => setShowInfo((value) => !value)}
              >
                <Info aria-hidden="true" />
              </button>
              <Link className="icon-button" href={`/photos/${activePhoto.slug}`} aria-label="Open photo page">
                <ExternalLink aria-hidden="true" />
              </Link>
              {activePhoto.rights.downloadAllowed && activePhoto.rights.downloadUrl ? (
                <a
                  className="icon-button"
                  href={activePhoto.rights.downloadUrl}
                  aria-label="Download high resolution photo"
                  download
                >
                  <Download aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
