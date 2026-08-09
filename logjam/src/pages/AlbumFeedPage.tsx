import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { AlbumDetail } from "../../shared/contracts";
import { PhotoDecisionCard } from "../components/PhotoDecisionCard";
import { ErrorState, LoadingState } from "../components/States";
import { publicApi } from "../lib/api";
import { decisionFromArrowShortcut, isAlbumDecisionComplete, shouldRenderAlbumInFeed } from "../lib/feed";
import { Link } from "../router";
import { useDecisions } from "../state/Decisions";

export function AlbumFeedPage({ slug }: { slug: string }) {
  const { decisions, decide, undoLastDecision, beginFeedUndoSession, canUndo, isBusy } = useDecisions();
  const [albums, setAlbums] = useState<AlbumDetail[]>([]);
  const [activeMemberships, setActiveMemberships] = useState<Set<string>>(() => new Set());
  const activeMembershipsRef = useRef(new Set<string>());
  const [announcement, setAnnouncement] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requested = useRef(new Set<string>());
  const sentinel = useRef<HTMLDivElement | null>(null);
  const currentSlug = useRef(slug);
  currentSlug.current = slug;

  useLayoutEffect(() => {
    return beginFeedUndoSession(slug);
  }, [beginFeedUndoSession, slug]);

  const markPhotoActive = useCallback((albumId: string, photoId: string, active: boolean) => {
    const membership = `${albumId}:${photoId}`;
    const next = new Set(activeMembershipsRef.current);
    if (active) next.add(membership);
    else next.delete(membership);
    activeMembershipsRef.current = next;
    setActiveMemberships(next);
  }, []);

  const load = useCallback(async (nextSlug: string, reset = false) => {
    if (!nextSlug || requested.current.has(nextSlug)) return;
    requested.current.add(nextSlug);
    setLoading(true);
    setError(null);
    try {
      const { album } = await publicApi<{ album: AlbumDetail }>(
        `/api/public/albums/${encodeURIComponent(nextSlug)}`
      );
      setAlbums((current) => reset ? [album] : [...current, album]);
      setError(null);
    } catch (cause) {
      requested.current.delete(nextSlug);
      setError(cause instanceof Error ? cause.message : "Album could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    requested.current.clear();
    activeMembershipsRef.current = new Set();
    setActiveMemberships(new Set());
    setAlbums([]);
    setError(null);
    void load(slug, true);
  }, [load, slug]);

  const visibleAlbums = useMemo(
    () => albums.filter((album) => shouldRenderAlbumInFeed(album, decisions, activeMemberships)),
    [activeMemberships, albums, decisions]
  );

  useEffect(() => {
    const first = visibleAlbums[0] ?? albums[0];
    if (first) document.title = `${first.title} — LogJam`;
  }, [albums, visibleAlbums]);

  useEffect(() => {
    const tail = albums.at(-1);
    const nextSlug = tail?.nextAlbumSlug;
    if (!tail || !nextSlug || loading || error || requested.current.has(nextSlug)) return;
    if (isAlbumDecisionComplete(tail, decisions)) void load(nextSlug);
  }, [albums, decisions, error, load, loading]);

  useEffect(() => {
    const node = sentinel.current;
    const nextSlug = albums.at(-1)?.nextAlbumSlug;
    if (!node || !nextSlug || loading || error) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void load(nextSlug);
    }, { rootMargin: "800px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [albums, error, load, loading]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented
        || event.repeat
        || isEditableShortcutTarget(event.target)
        || isBusy
        || activeMembershipsRef.current.size > 0
      ) return;

      if (isUndoShortcut(event)) {
        if (!canUndo) return;
        event.preventDefault();
        void undoLastDecision().then(async (result) => {
          if (!result || result.sessionId !== currentSlug.current) return;
          const restored = await focusRestoredPhoto(result.photoId, result.context);
          setAnnouncement(restored
            ? "Previous decision undone. The photograph is back in the sorting feed."
            : "Previous decision undone.");
        }).catch(() => {
          setAnnouncement("The previous decision could not be undone. Try again.");
        });
        return;
      }

      const decision = decisionFromArrowShortcut(event);
      if (!decision) return;
      const card = mostVisibleIdleCard();
      const button = card?.querySelector<HTMLButtonElement>(`button[data-decision="${decision}"]`);
      if (!button || button.disabled) return;
      event.preventDefault();
      button.click();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, isBusy, undoLastDecision]);

  if (albums.length === 0 && loading) {
    return <main className="feed-page page-width"><LoadingState label="Loading photographs" /></main>;
  }
  if (albums.length === 0 && error) {
    return (
      <main className="feed-page page-width">
        <ErrorState message={error} retry={() => void load(slug, true)} />
        <Link className="text-link" to="/">Back to albums</Link>
      </main>
    );
  }

  return (
    <main className="feed-page">
      <div className="visually-hidden" aria-live="polite">{announcement}</div>
      <div className="feed-topline page-width">
        <Link to="/" className="text-link">← All albums</Link>
        <p><span aria-hidden="true">←</span> pass · keep <span aria-hidden="true">→</span> · Z undo</p>
      </div>
      {visibleAlbums.map((album, albumIndex) => (
        <section
          className="album-feed"
          key={album.id}
          data-album-id={album.id}
          aria-labelledby={`album-${album.id}`}
        >
          <header className="album-feed__header page-width">
            <p className="eyebrow">Album {albumIndex + 1}</p>
            <h1 id={`album-${album.id}`}>{album.title}</h1>
            {album.subtitle && <p>{album.subtitle}</p>}
          </header>
          <div className="photo-column">
            {album.photos.map((photo, photoIndex) => (
              <PhotoDecisionCard
                key={`${album.id}:${photo.id}`}
                photo={photo}
                decision={decisions[photo.id]}
                onDecision={(decision) => decide(photo.id, decision, {
                  recordUndo: true,
                  undoContext: album.id,
                  undoSession: slug
                })}
                onActivityChange={(photoId, active) => markPhotoActive(album.id, photoId, active)}
                disabled={isBusy}
                eager={albumIndex === 0 && photoIndex < 2}
              />
            ))}
            {album.photos.length === 0 && <p className="empty-copy">This album has no display-ready photographs.</p>}
          </div>
        </section>
      ))}
      <div ref={sentinel} className="feed-sentinel" aria-live="polite">
        {loading && <LoadingState label="Loading next album" />}
        {!loading && isFeedEnd(albums, requested.current) && <p>You reached the end of the library.</p>}
        {error && albums.length > 0 && (
          <ErrorState
            message={error}
            retry={() => {
              const next = albums.at(-1)?.nextAlbumSlug;
              if (next) void load(next);
            }}
          />
        )}
      </div>
    </main>
  );
}

function isUndoShortcut(event: KeyboardEvent): boolean {
  const isZ = event.code === "KeyZ" || event.key.toLocaleLowerCase() === "z";
  return isZ && !event.altKey && !event.shiftKey && !(event.metaKey && event.ctrlKey);
}

function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])"));
}

function mostVisibleIdleCard(): HTMLElement | null {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  let winner: { card: HTMLElement; score: number; centerDistance: number } | null = null;

  for (const gesture of document.querySelectorAll<HTMLElement>(
    ".photo-card[data-phase='idle']:not([aria-busy='true']) .photo-card__gesture"
  )) {
    const card = gesture.closest<HTMLElement>(".photo-card");
    if (!card || gesture.getAttribute("aria-disabled") === "true") continue;
    const rect = gesture.getBoundingClientRect();
    const visibleWidth = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0));
    const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
    const score = visibleWidth * visibleHeight;
    if (score <= 0) continue;
    const centerDistance = Math.abs((rect.top + rect.bottom) / 2 - viewportHeight / 2);
    if (!winner || score > winner.score || (score === winner.score && centerDistance < winner.centerDistance)) {
      winner = { card, score, centerDistance };
    }
  }
  return winner?.card ?? null;
}

async function focusRestoredPhoto(photoId: string, albumId?: string): Promise<boolean> {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    await nextAnimationFrame();
    const sections = albumId
      ? Array.from(document.querySelectorAll<HTMLElement>(".album-feed"))
          .filter((section) => section.dataset.albumId === albumId)
      : Array.from(document.querySelectorAll<HTMLElement>(".album-feed"));
    const card = sections
      .flatMap((section) => Array.from(section.querySelectorAll<HTMLElement>(".photo-card")))
      .find((candidate) => candidate.dataset.photoId === photoId && candidate.dataset.phase === "idle");
    const gesture = card?.querySelector<HTMLElement>(".photo-card__gesture");
    if (!gesture) continue;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gesture.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
    gesture.focus({ preventScroll: true });
    return true;
  }
  return false;
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

function isFeedEnd(albums: AlbumDetail[], requested: ReadonlySet<string>): boolean {
  const nextSlug = albums.at(-1)?.nextAlbumSlug;
  return !nextSlug || requested.has(nextSlug);
}
