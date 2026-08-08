import { useCallback, useEffect, useRef, useState } from "react";

import type { AlbumDetail } from "../../shared/contracts";
import { PhotoDecisionCard } from "../components/PhotoDecisionCard";
import { ErrorState, LoadingState } from "../components/States";
import { publicApi } from "../lib/api";
import { Link } from "../router";
import { useDecisions } from "../state/Decisions";

export function AlbumFeedPage({ slug }: { slug: string }) {
  const { decisions, decide } = useDecisions();
  const [albums, setAlbums] = useState<AlbumDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requested = useRef(new Set<string>());
  const sentinel = useRef<HTMLDivElement | null>(null);

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
    setAlbums([]);
    setError(null);
    void load(slug, true);
  }, [load, slug]);

  useEffect(() => {
    const first = albums[0];
    if (first) document.title = `${first.title} — LogJam`;
  }, [albums]);

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
      <div className="feed-topline page-width">
        <Link to="/" className="text-link">← All albums</Link>
        <p><span aria-hidden="true">←</span> pass · keep <span aria-hidden="true">→</span></p>
      </div>
      {albums.map((album, albumIndex) => (
        <section className="album-feed" key={album.id} aria-labelledby={`album-${album.id}`}>
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
                onDecision={(decision) => decide(photo.id, decision)}
                eager={albumIndex === 0 && photoIndex < 2}
              />
            ))}
            {album.photos.length === 0 && <p className="empty-copy">This album has no display-ready photographs.</p>}
          </div>
        </section>
      ))}
      <div ref={sentinel} className="feed-sentinel" aria-live="polite">
        {loading && <LoadingState label="Loading next album" />}
        {!loading && !albums.at(-1)?.nextAlbumSlug && <p>You reached the end of the library.</p>}
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
