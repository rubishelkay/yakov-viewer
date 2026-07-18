"use client";

import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { type LocalArchivePhoto, useAdminArchive } from "@/admin/admin-state";
import {
  getPortfolioPhotoSources,
  getPublicAlbumBySlug,
  getPublicPhotosForAlbum
} from "@/lib/portfolio";

type ViewMode = "s" | "m" | "l";

const viewModeKey = "yakov-public-view-mode";
const viewModeListeners = new Set<() => void>();

export function PortfolioAlbum({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const { archive, previewUrls } = useAdminArchive();
  const album = getPublicAlbumBySlug(archive, slug);
  const photos = useMemo(
    () => (album ? getPublicPhotosForAlbum(archive, album.id) : []),
    [album, archive]
  );
  const mode = useSyncExternalStore(subscribeToViewMode, getStoredViewMode, getServerViewMode);
  const [openIndex, setOpenIndex] = useState<number | null>(() =>
    parsePhotoIndex(searchParams.get("photo"), photos.length)
  );

  function setViewMode(next: ViewMode) {
    window.localStorage.setItem(viewModeKey, next);
    viewModeListeners.forEach((listener) => listener());
  }

  const openPhoto = useCallback((index: number) => {
    setOpenIndex(index);
    window.history.replaceState(null, "", `/albums/${slug}?photo=${index + 1}`);
  }, [slug]);
  const closePhoto = useCallback(() => {
    setOpenIndex(null);
    window.history.replaceState(null, "", `/albums/${slug}`);
  }, [slug]);

  useEffect(() => {
    const syncFromHistory = () => {
      const value = new URL(window.location.href).searchParams.get("photo");
      setOpenIndex(parsePhotoIndex(value, photos.length));
    };
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, [photos.length]);

  if (!album) {
    return <main className="portfolio-empty">Album is not published.</main>;
  }

  return (
    <main className="portfolio-album-page">
      <header className="portfolio-album-head">
        <div>
          <h1>{album.title}</h1>
          <p>{album.subtitle} <span>· {photos.length}</span></p>
        </div>
        <ViewModeToggle mode={mode} onChange={setViewMode} />
      </header>
      <PortfolioPhotoGrid
        archive={archive}
        mode={mode}
        onOpen={openPhoto}
        photos={photos}
        previewUrls={previewUrls}
      />
      {openIndex !== null ? (
        <PortfolioViewer
          albumTitle={album.title}
          archive={archive}
          index={openIndex}
          onClose={closePhoto}
          onNavigate={openPhoto}
          photos={photos}
          previewUrls={previewUrls}
        />
      ) : null}
    </main>
  );
}

function getServerViewMode(): ViewMode {
  return "m";
}

function getStoredViewMode(): ViewMode {
  const stored = window.localStorage.getItem(viewModeKey);
  return stored === "s" || stored === "l" ? stored : "m";
}

function subscribeToViewMode(listener: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === viewModeKey) listener();
  };

  viewModeListeners.add(listener);
  window.addEventListener("storage", handleStorage);

  return () => {
    viewModeListeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function parsePhotoIndex(value: string | null, total: number) {
  const photoNumber = Number(value);
  return Number.isInteger(photoNumber) && photoNumber >= 1 && photoNumber <= total
    ? photoNumber - 1
    : null;
}

function ViewModeToggle({ mode, onChange }: { mode: ViewMode; onChange: (mode: ViewMode) => void }) {
  const labels: Record<ViewMode, string> = { s: "Contact sheet", m: "Grid", l: "Large" };

  return (
    <div aria-label="View mode" className="portfolio-mode-toggle" role="group">
      {(["s", "m", "l"] as ViewMode[]).map((value) => (
        <button
          aria-label={`${labels[value]} view`}
          aria-pressed={mode === value}
          className={mode === value ? "is-active" : undefined}
          key={value}
          onClick={() => onChange(value)}
          title={labels[value]}
          type="button"
        >
          {value.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function PortfolioPhotoGrid({
  archive,
  mode,
  onOpen,
  photos,
  previewUrls
}: {
  archive: ReturnType<typeof useAdminArchive>["archive"];
  mode: ViewMode;
  onOpen: (index: number) => void;
  photos: LocalArchivePhoto[];
  previewUrls: Record<string, string>;
}) {
  if (mode === "l") {
    return (
      <div className="portfolio-grid-l">
        {photos.map((photo, index) => (
          <PhotoButton
            display
            key={photo.id}
            onOpen={() => onOpen(index)}
            photo={photo}
            sources={getPortfolioPhotoSources(archive, previewUrls, photo)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={mode === "s" ? "portfolio-grid-s" : "portfolio-grid-m"}>
      {photos.map((photo, index) => (
        <PhotoButton
          key={photo.id}
          onOpen={() => onOpen(index)}
          photo={photo}
          sources={getPortfolioPhotoSources(archive, previewUrls, photo)}
        />
      ))}
    </div>
  );
}

function PhotoButton({
  display = false,
  onOpen,
  photo,
  sources
}: {
  display?: boolean;
  onOpen: () => void;
  photo: LocalArchivePhoto;
  sources: { display?: string; thumb?: string };
}) {
  const source = display ? sources.display ?? sources.thumb : sources.thumb ?? sources.display;

  return (
    <button
      aria-label={`Open ${photo.title}`}
      className="portfolio-photo-button"
      onClick={onOpen}
      style={{ "--photo-ratio": `${photo.width} / ${photo.height}` } as React.CSSProperties}
      type="button"
    >
      {source ? (
        <img
          alt={photo.title}
          decoding="async"
          height={photo.height}
          loading="lazy"
          src={source}
          width={photo.width}
        />
      ) : null}
    </button>
  );
}

function PortfolioViewer({
  albumTitle,
  archive,
  index,
  onClose,
  onNavigate,
  photos,
  previewUrls
}: {
  albumTitle: string;
  archive: ReturnType<typeof useAdminArchive>["archive"];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  photos: LocalArchivePhoto[];
  previewUrls: Record<string, string>;
}) {
  const photo = photos[index];
  const source = getPortfolioPhotoSources(archive, previewUrls, photo).display;
  const closeRef = useRef<HTMLButtonElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<number | null>(null);
  const [controls, setControls] = useState(true);
  const [zoomed, setZoomed] = useState(false);
  const hideTimer = useRef<number | undefined>(undefined);
  const total = photos.length;
  const previous = useCallback(
    () => {
      setZoomed(false);
      onNavigate((index - 1 + total) % total);
    },
    [index, onNavigate, total]
  );
  const next = useCallback(
    () => {
      setZoomed(false);
      onNavigate((index + 1) % total);
    },
    [index, onNavigate, total]
  );
  const wakeControls = useCallback(() => {
    setControls(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setControls(false), 2600);
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    hideTimer.current = window.setTimeout(() => setControls(false), 2600);
    return () => {
      document.body.style.overflow = "";
      window.clearTimeout(hideTimer.current);
    };
  }, [wakeControls]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") previous();
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        next();
      }
      if (event.key === "Tab") {
        const controls = Array.from(
          viewerRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? []
        );
        if (!controls.length) return;
        const current = controls.indexOf(document.activeElement as HTMLButtonElement);
        const nextIndex = event.shiftKey
          ? current <= 0 ? controls.length - 1 : current - 1
          : current === controls.length - 1 ? 0 : current + 1;
        event.preventDefault();
        controls[nextIndex].focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, onClose, previous]);

  return (
    <div
      aria-label={`${albumTitle}, photo ${index + 1} of ${total}`}
      aria-modal="true"
      className="portfolio-viewer"
      data-controls={controls ? "shown" : "hidden"}
      onMouseMove={wakeControls}
      ref={viewerRef}
      role="dialog"
    >
      <button
        aria-label={zoomed ? "Reset zoom" : "Zoom photo"}
        className="portfolio-viewer__stage"
        data-zoomed={zoomed ? "true" : undefined}
        onClick={() => setControls((value) => !value)}
        onDoubleClick={() => setZoomed((value) => !value)}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          touchStart.current = null;
          if (start === null) return;
          const delta = event.changedTouches[0].clientX - start;
          if (delta > 55) previous();
          if (delta < -55) next();
        }}
        onTouchStart={(event) => {
          touchStart.current = event.touches[0].clientX;
          wakeControls();
        }}
        type="button"
      >
        {source ? <img alt={photo.title} draggable={false} height={photo.height} src={source} width={photo.width} /> : null}
      </button>
      <button aria-label="Close viewer" className="portfolio-viewer__control portfolio-viewer__close" onClick={onClose} ref={closeRef} type="button">
        <X aria-hidden />
      </button>
      <button aria-label="Previous photo" className="portfolio-viewer__control portfolio-viewer__arrow portfolio-viewer__arrow--previous" onClick={previous} type="button">
        <ChevronLeft aria-hidden />
      </button>
      <button aria-label="Next photo" className="portfolio-viewer__control portfolio-viewer__arrow portfolio-viewer__arrow--next" onClick={next} type="button">
        <ChevronRight aria-hidden />
      </button>
      <span className="portfolio-viewer__control portfolio-viewer__title">{albumTitle}</span>
      <span aria-live="polite" className="portfolio-viewer__control portfolio-viewer__counter">
        {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </span>
    </div>
  );
}
