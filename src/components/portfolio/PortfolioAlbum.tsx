"use client";

import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from "react";

import { PortfolioImage } from "@/components/portfolio/PortfolioImage";
import { PortfolioTagLinks } from "@/components/portfolio/PortfolioTagLinks";
import type { PublicAlbumDetail, PublicPhoto } from "@/lib/portfolio";

type ViewMode = "s" | "m" | "l";

const viewModeKey = "yakov-public-view-mode";
const viewModeListeners = new Set<() => void>();

export function PortfolioAlbum({ album }: { album: PublicAlbumDetail }) {
  const searchParams = useSearchParams();
  const photos = album.photos;
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
    window.history.replaceState(null, "", `/albums/${album.slug}?photo=${index + 1}`);
  }, [album.slug]);
  const closePhoto = useCallback(() => {
    setOpenIndex(null);
    window.history.replaceState(null, "", `/albums/${album.slug}`);
  }, [album.slug]);

  useEffect(() => {
    const syncFromHistory = () => {
      const value = new URL(window.location.href).searchParams.get("photo");
      setOpenIndex(parsePhotoIndex(value, photos.length));
    };
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, [photos.length]);

  return (
    <main className="portfolio-album-page">
      <header className="portfolio-album-head">
        <div>
          <h1>{album.title}</h1>
          <p><PortfolioTagLinks album={album} count={photos.length} /></p>
        </div>
        <ViewModeToggle mode={mode} onChange={setViewMode} />
      </header>
      <PortfolioPhotoGrid
        mode={mode}
        onOpen={openPhoto}
        photos={photos}
      />
      {openIndex !== null ? (
        <PortfolioViewer
          albumTitle={album.title}
          index={openIndex}
          onClose={closePhoto}
          onNavigate={openPhoto}
          photos={photos}
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
  mode,
  onOpen,
  photos
}: {
  mode: ViewMode;
  onOpen: (index: number) => void;
  photos: PublicPhoto[];
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
          />
        ))}
      </div>
    );
  }

  if (mode === "m") {
    return (
      <JustifiedPhotoGrid
        onOpen={onOpen}
        photos={photos}
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
        />
      ))}
    </div>
  );
}

type JustifiedRow = {
  filled: boolean;
  height: number;
  items: Array<{ index: number; photo: PublicPhoto }>;
};

function JustifiedPhotoGrid({
  onOpen,
  photos
}: {
  onOpen: (index: number) => void;
  photos: PublicPhoto[];
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
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function buildJustifiedRows(photos: PublicPhoto[], width: number, gap: number): JustifiedRow[] {
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

function safePhotoRatio(photo: PublicPhoto) {
  return photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 1.5;
}

function PhotoButton({
  display = false,
  justifiedWidth,
  onOpen,
  photo
}: {
  display?: boolean;
  justifiedWidth?: number;
  onOpen: () => void;
  photo: PublicPhoto;
}) {
  const source = display ? photo.displayUrl : photo.thumbUrl;

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
  index,
  onClose,
  onNavigate,
  photos
}: {
  albumTitle: string;
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  photos: PublicPhoto[];
}) {
  const photo = photos[index];
  const viewerRef = useRef<HTMLDivElement>(null);
  const suppressStageClick = useRef(false);
  const [controls, setControls] = useState(true);
  const [transform, setTransform] = useState(defaultViewerTransform);
  const [dragging, setDragging] = useState(false);
  const touchGestureRef = useRef<ViewerTouchGesture | null>(null);
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
  const zoomed = transform.scale > minimumZoomScale;
  const source = zoomed ? photo.expandedUrl : photo.displayUrl;
  const resetTransform = useCallback(() => {
    dragRef.current = null;
    touchGestureRef.current = null;
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
    viewerRef.current?.focus({ preventScroll: true });
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
    const stageBounds = event.currentTarget.getBoundingClientRect();
    const keyboardClick = event.detail === 0;
    const clientX = keyboardClick ? stageBounds.left + stageBounds.width / 2 : event.clientX;
    const clientY = keyboardClick ? stageBounds.top + stageBounds.height / 2 : event.clientY;

    if (!pointIsOnPhoto(clientX, clientY, stageBounds, photo, transform)) {
      wakeControls();
      return;
    }

    if (zoomed) {
      resetTransform();
      wakeControls();
      return;
    }

    setTransform({
      originX: clamp(((clientX - stageBounds.left) / stageBounds.width) * 100, 0, 100),
      originY: clamp(((clientY - stageBounds.top) / stageBounds.height) * 100, 0, 100),
      panX: 0,
      panY: 0,
      scale: clickZoomScale
    });
    wakeControls();
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!zoomed || event.pointerType === "touch") return;
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
      panX: clampViewerPan(drag.panX + deltaX, bounds.width, value.originX, value.scale),
      panY: clampViewerPan(drag.panY + deltaY, bounds.height, value.originY, value.scale)
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

  const beginPinch = (event: ReactTouchEvent<HTMLButtonElement>) => {
    if (event.touches.length < 2) return;
    const stageBounds = event.currentTarget.getBoundingClientRect();
    const first = event.touches[0];
    const second = event.touches[1];
    const center = touchCenter(first, second, stageBounds);
    const enabled = pointIsOnPhoto(
      center.x + stageBounds.left,
      center.y + stageBounds.top,
      stageBounds,
      photo,
      transform
    );
    const originX = transform.scale <= minimumZoomScale
      ? (center.x / stageBounds.width) * 100
      : transform.originX;
    const originY = transform.scale <= minimumZoomScale
      ? (center.y / stageBounds.height) * 100
      : transform.originY;

    touchGestureRef.current = {
      enabled,
      hadMultipleTouches: true,
      mode: "pinch",
      moved: false,
      originX,
      originY,
      startCenterX: center.x,
      startCenterY: center.y,
      startDistance: touchDistance(first, second),
      startPanX: transform.panX,
      startPanY: transform.panY,
      startScale: transform.scale,
      startX: first.clientX,
      startY: first.clientY
    };
    if (!enabled) return;

    event.preventDefault();
    setDragging(true);
    setTransform((value) => ({ ...value, originX, originY }));
  };

  const handleTouchStart = (event: ReactTouchEvent<HTMLButtonElement>) => {
    wakeControls();
    if (event.touches.length >= 2) {
      beginPinch(event);
      return;
    }

    const touch = event.touches[0];
    touchGestureRef.current = {
      enabled: true,
      hadMultipleTouches: false,
      mode: "single",
      moved: false,
      originX: transform.originX,
      originY: transform.originY,
      startCenterX: touch.clientX,
      startCenterY: touch.clientY,
      startDistance: 0,
      startPanX: transform.panX,
      startPanY: transform.panY,
      startScale: transform.scale,
      startX: touch.clientX,
      startY: touch.clientY
    };
  };

  const handleTouchMove = (event: ReactTouchEvent<HTMLButtonElement>) => {
    if (event.touches.length >= 2) {
      if (touchGestureRef.current?.mode !== "pinch") beginPinch(event);
      const gesture = touchGestureRef.current;
      if (!gesture?.enabled || gesture.mode !== "pinch") return;

      event.preventDefault();
      const stageBounds = event.currentTarget.getBoundingClientRect();
      const first = event.touches[0];
      const second = event.touches[1];
      const center = touchCenter(first, second, stageBounds);
      const distance = touchDistance(first, second);
      const scale = clamp(
        gesture.startScale * (distance / Math.max(1, gesture.startDistance)),
        1,
        maximumZoomScale
      );
      const originXPixels = stageBounds.width * gesture.originX / 100;
      const originYPixels = stageBounds.height * gesture.originY / 100;
      const panX = center.x - originXPixels - scale * (
        (gesture.startCenterX - originXPixels - gesture.startPanX) / gesture.startScale
      );
      const panY = center.y - originYPixels - scale * (
        (gesture.startCenterY - originYPixels - gesture.startPanY) / gesture.startScale
      );

      gesture.moved = gesture.moved || Math.abs(distance - gesture.startDistance) > 2;
      setTransform({
        originX: gesture.originX,
        originY: gesture.originY,
        panX: clampViewerPan(panX, stageBounds.width, gesture.originX, scale),
        panY: clampViewerPan(panY, stageBounds.height, gesture.originY, scale),
        scale
      });
      return;
    }

    const gesture = touchGestureRef.current;
    const touch = event.touches[0];
    if (!gesture || !touch || gesture.mode !== "single") return;
    const deltaX = touch.clientX - gesture.startX;
    const deltaY = touch.clientY - gesture.startY;
    gesture.moved = gesture.moved || Math.hypot(deltaX, deltaY) > 4;

    if (gesture.startScale <= minimumZoomScale) return;
    event.preventDefault();
    const stageBounds = event.currentTarget.getBoundingClientRect();
    setDragging(true);
    setTransform((value) => ({
      ...value,
      panX: clampViewerPan(gesture.startPanX + deltaX, stageBounds.width, value.originX, value.scale),
      panY: clampViewerPan(gesture.startPanY + deltaY, stageBounds.height, value.originY, value.scale)
    }));
  };

  const handleTouchEnd = (event: ReactTouchEvent<HTMLButtonElement>) => {
    const gesture = touchGestureRef.current;
    if (!gesture || event.touches.length > 0) return;
    touchGestureRef.current = null;
    setDragging(false);

    if (gesture.hadMultipleTouches) {
      if (transform.scale <= minimumZoomScale) resetTransform();
      suppressClickFor(450, suppressStageClick);
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - gesture.startX;
    const deltaY = touch.clientY - gesture.startY;
    if (gesture.startScale > minimumZoomScale) {
      if (gesture.moved) suppressClickFor(300, suppressStageClick);
      return;
    }

    if (Math.abs(deltaX) > 55 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15) {
      suppressClickFor(400, suppressStageClick);
      if (deltaX > 0) previous();
      else next();
      return;
    }

    if (gesture.moved) suppressClickFor(300, suppressStageClick);
  };

  const handleTouchCancel = () => {
    touchGestureRef.current = null;
    setDragging(false);
    suppressClickFor(300, suppressStageClick);
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
      tabIndex={-1}
    >
      <button
        aria-label={zoomed ? "Reset zoom" : "Zoom photo"}
        aria-pressed={zoomed}
        className="portfolio-viewer__stage"
        data-dragging={dragging ? "true" : undefined}
        data-zoomed={zoomed ? "true" : undefined}
        onClick={handleStageClick}
        onPointerCancel={finishPointerDrag}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerDrag}
        onTouchCancel={handleTouchCancel}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onTouchStart={handleTouchStart}
        style={{
          "--viewer-origin-x": `${transform.originX}%`,
          "--viewer-origin-y": `${transform.originY}%`,
          "--viewer-pan-x": `${transform.panX}px`,
          "--viewer-pan-y": `${transform.panY}px`,
          "--viewer-scale": transform.scale
        } as CSSProperties}
        type="button"
      >
        {source ? (
          <PortfolioImage
            alt={photo.title}
            draggable={false}
            height={photo.height}
            key={`${photo.id}:${zoomed ? "expanded" : "display"}`}
            src={source}
            width={photo.width}
            wrapperClassName="portfolio-viewer__image"
          />
        ) : null}
      </button>
      <button aria-label="Close viewer" className="portfolio-viewer__control portfolio-viewer__close" onClick={onClose} type="button">
        <X aria-hidden />
      </button>
      <button aria-label="Previous photo" className="portfolio-viewer__control portfolio-viewer__arrow portfolio-viewer__arrow--previous" onClick={previous} type="button">
        <ChevronLeft aria-hidden />
      </button>
      <button aria-label="Next photo" className="portfolio-viewer__control portfolio-viewer__arrow portfolio-viewer__arrow--next" onClick={next} type="button">
        <ChevronRight aria-hidden />
      </button>
      {photo.downloadUrl ? (
        <a
          aria-label={`Download ${photo.title}`}
          className="portfolio-viewer__control portfolio-viewer__download"
          download
          href={photo.downloadUrl}
        >
          <Download aria-hidden />
          <span>Download</span>
        </a>
      ) : null}
      <span className="portfolio-viewer__control portfolio-viewer__title">{albumTitle}</span>
      <span aria-live="polite" className="portfolio-viewer__control portfolio-viewer__counter">
        {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </span>
    </div>
  );
}

type ViewerTransform = ReturnType<typeof defaultViewerTransform>;

type ViewerTouchGesture = {
  enabled: boolean;
  hadMultipleTouches: boolean;
  mode: "pinch" | "single";
  moved: boolean;
  originX: number;
  originY: number;
  startCenterX: number;
  startCenterY: number;
  startDistance: number;
  startPanX: number;
  startPanY: number;
  startScale: number;
  startX: number;
  startY: number;
};

const clickZoomScale = 2.2;
const maximumZoomScale = 4;
const minimumZoomScale = 1.01;

function defaultViewerTransform() {
  return { originX: 50, originY: 50, panX: 0, panY: 0, scale: 1 };
}

function clampViewerPan(value: number, size: number, originPercent: number, scale: number) {
  const origin = originPercent / 100;
  const minimum = -(scale - 1) * size * (1 - origin);
  const maximum = (scale - 1) * size * origin;
  return clamp(value, minimum, maximum);
}

function pointIsOnPhoto(
  clientX: number,
  clientY: number,
  stageBounds: DOMRect,
  photo: PublicPhoto,
  transform: ViewerTransform
) {
  const ratio = safePhotoRatio(photo);
  const baseWidth = Math.min(stageBounds.width, stageBounds.height * ratio);
  const baseHeight = baseWidth / ratio;
  const baseLeft = (stageBounds.width - baseWidth) / 2;
  const baseTop = (stageBounds.height - baseHeight) / 2;
  const originX = stageBounds.width * transform.originX / 100;
  const originY = stageBounds.height * transform.originY / 100;
  const left = stageBounds.left + originX + transform.scale * (baseLeft - originX) + transform.panX;
  const top = stageBounds.top + originY + transform.scale * (baseTop - originY) + transform.panY;
  const right = left + baseWidth * transform.scale;
  const bottom = top + baseHeight * transform.scale;
  return clientX >= left && clientX <= right && clientY >= top && clientY <= bottom;
}

type TouchPoint = { clientX: number; clientY: number };

function touchCenter(first: TouchPoint, second: TouchPoint, stageBounds: DOMRect) {
  return {
    x: (first.clientX + second.clientX) / 2 - stageBounds.left,
    y: (first.clientY + second.clientY) / 2 - stageBounds.top
  };
}

function touchDistance(first: TouchPoint, second: TouchPoint) {
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
}

function suppressClickFor(duration: number, target: { current: boolean }) {
  target.current = true;
  window.setTimeout(() => {
    target.current = false;
  }, duration);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
