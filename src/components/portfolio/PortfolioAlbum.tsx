"use client";

import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from "react";

import { type LocalArchivePhoto, useAdminArchive } from "@/admin/admin-state";
import { PortfolioImage } from "@/components/portfolio/PortfolioImage";
import { PortfolioTagLinks } from "@/components/portfolio/PortfolioTagLinks";
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
          <p><PortfolioTagLinks album={album} archive={archive} count={photos.length} /></p>
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
          key={photos[openIndex]?.id}
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

  if (mode === "m") {
    return (
      <JustifiedPhotoGrid
        archive={archive}
        onOpen={onOpen}
        photos={photos}
        previewUrls={previewUrls}
      />
    );
  }

  return (
    <div className="portfolio-grid-s">
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

type JustifiedRow = {
  filled: boolean;
  height: number;
  items: Array<{ index: number; photo: LocalArchivePhoto }>;
};

function JustifiedPhotoGrid({
  archive,
  onOpen,
  photos,
  previewUrls
}: {
  archive: ReturnType<typeof useAdminArchive>["archive"];
  onOpen: (index: number) => void;
  photos: LocalArchivePhoto[];
  previewUrls: Record<string, string>;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const updateWidth = () => setContainerWidth(Math.round(grid.getBoundingClientRect().width));
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  const rows = useMemo(
    () => buildJustifiedRows(photos, containerWidth, 7),
    [containerWidth, photos]
  );

  return (
    <div className="portfolio-grid-m" data-measured={containerWidth > 0 ? "true" : undefined} ref={gridRef}>
      {rows.map((row, rowIndex) => (
        <div
          className="portfolio-grid-m__row"
          data-filled={row.filled ? "true" : "false"}
          key={`${row.items[0]?.photo.id ?? "row"}-${rowIndex}`}
          style={{ "--row-height": `${row.height}px` } as CSSProperties}
        >
          {row.items.map(({ index, photo }) => (
            <PhotoButton
              justifiedWidth={row.height * safePhotoRatio(photo)}
              key={photo.id}
              onOpen={() => onOpen(index)}
              photo={photo}
              sources={getPortfolioPhotoSources(archive, previewUrls, photo)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function buildJustifiedRows(photos: LocalArchivePhoto[], width: number, gap: number): JustifiedRow[] {
  if (!photos.length) return [];

  const targetHeight = getTargetRowHeight(width);
  if (width <= 0) {
    return [{
      filled: false,
      height: targetHeight,
      items: photos.map((photo, index) => ({ index, photo }))
    }];
  }

  const rows: JustifiedRow[] = [];
  let current: JustifiedRow["items"] = [];

  const rowHeight = (items: JustifiedRow["items"]) => {
    const ratios = items.reduce((sum, item) => sum + safePhotoRatio(item.photo), 0);
    return (width - gap * Math.max(0, items.length - 1)) / ratios;
  };

  photos.forEach((photo, index) => {
    const candidate = [...current, { index, photo }];
    const candidateHeight = rowHeight(candidate);

    if (current.length && candidateHeight <= targetHeight) {
      const currentHeight = rowHeight(current);
      if (Math.abs(currentHeight - targetHeight) < Math.abs(candidateHeight - targetHeight)) {
        rows.push({ filled: true, height: currentHeight, items: current });
        current = [{ index, photo }];
      } else {
        rows.push({ filled: true, height: candidateHeight, items: candidate });
        current = [];
      }
      return;
    }

    current = candidate;
  });

  if (current.length) rows.push({ filled: false, height: targetHeight, items: current });
  return rows;
}

function getTargetRowHeight(width: number) {
  if (width <= 0) return 180;
  if (width <= 640) return Math.min(190, Math.max(150, width * 0.48));
  if (width <= 980) return 190;
  return Math.min(250, Math.max(195, width * 0.135));
}

function safePhotoRatio(photo: LocalArchivePhoto) {
  return photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 1.5;
}

function PhotoButton({
  display = false,
  justifiedWidth,
  onOpen,
  photo,
  sources
}: {
  display?: boolean;
  justifiedWidth?: number;
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
      style={{
        "--justified-width": justifiedWidth ? `${justifiedWidth}px` : undefined,
        "--photo-ratio": `${photo.width} / ${photo.height}`,
        "--photo-ratio-number": safePhotoRatio(photo)
      } as CSSProperties}
      type="button"
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
  const suppressStageClick = useRef(false);
  const [controls, setControls] = useState(true);
  const [transform, setTransform] = useState(defaultViewerTransform);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    moved: boolean;
    panX: number;
    panY: number;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const total = photos.length;
  const resetTransform = useCallback(() => {
    dragRef.current = null;
    setDragging(false);
    setTransform(defaultViewerTransform());
  }, []);
  const previous = useCallback(
    () => {
      resetTransform();
      onNavigate((index - 1 + total) % total);
    },
    [index, onNavigate, resetTransform, total]
  );
  const next = useCallback(
    () => {
      resetTransform();
      onNavigate((index + 1) % total);
    },
    [index, onNavigate, resetTransform, total]
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

  const handleStageClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (suppressStageClick.current) return;
    if (transform.zoomed) {
      resetTransform();
      wakeControls();
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const keyboardClick = event.detail === 0;
    setTransform({
      originX: keyboardClick ? 50 : clamp(((event.clientX - bounds.left) / bounds.width) * 100, 0, 100),
      originY: keyboardClick ? 50 : clamp(((event.clientY - bounds.top) / bounds.height) * 100, 0, 100),
      panX: 0,
      panY: 0,
      zoomed: true
    });
    wakeControls();
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!transform.zoomed || event.pointerType === "touch") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      moved: false,
      panX: transform.panX,
      panY: transform.panY,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY
    };
    setDragging(true);
    wakeControls();
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.hypot(deltaX, deltaY) > 3) drag.moved = true;

    const bounds = event.currentTarget.getBoundingClientRect();
    setTransform((value) => ({
      ...value,
      panX: clampViewerPan(drag.panX + deltaX, bounds.width, value.originX),
      panY: clampViewerPan(drag.panY + deltaY, bounds.height, value.originY)
    }));
  };

  const finishPointerDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setDragging(false);
    if (!drag.moved) return;

    suppressStageClick.current = true;
    window.setTimeout(() => {
      suppressStageClick.current = false;
    }, 0);
  };

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
        aria-label={transform.zoomed ? "Reset zoom" : "Zoom photo"}
        aria-pressed={transform.zoomed}
        className="portfolio-viewer__stage"
        data-dragging={dragging ? "true" : undefined}
        data-zoomed={transform.zoomed ? "true" : undefined}
        onClick={handleStageClick}
        onPointerCancel={finishPointerDrag}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerDrag}
        style={{
          "--viewer-origin-x": `${transform.originX}%`,
          "--viewer-origin-y": `${transform.originY}%`,
          "--viewer-pan-x": `${transform.panX}px`,
          "--viewer-pan-y": `${transform.panY}px`
        } as CSSProperties}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          touchStart.current = null;
          if (start === null) return;
          const delta = event.changedTouches[0].clientX - start;
          if (Math.abs(delta) > 55) {
            suppressStageClick.current = true;
            window.setTimeout(() => {
              suppressStageClick.current = false;
            }, 400);
          }
          if (delta > 55) previous();
          if (delta < -55) next();
        }}
        onTouchStart={(event) => {
          touchStart.current = event.touches[0].clientX;
          wakeControls();
        }}
        type="button"
      >
        {source ? (
          <PortfolioImage
            alt={photo.title}
            draggable={false}
            height={photo.height}
            key={photo.id}
            src={source}
            width={photo.width}
            wrapperClassName="portfolio-viewer__image"
          />
        ) : null}
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

const viewerScale = 2.2;

function defaultViewerTransform() {
  return { originX: 50, originY: 50, panX: 0, panY: 0, zoomed: false };
}

function clampViewerPan(value: number, size: number, originPercent: number) {
  const origin = originPercent / 100;
  const minimum = -(viewerScale - 1) * size * (1 - origin);
  const maximum = (viewerScale - 1) * size * origin;
  return clamp(value, minimum, maximum);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
