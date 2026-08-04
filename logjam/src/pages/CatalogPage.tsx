import { useEffect, useState } from "react";

import type { AlbumSummary } from "../../shared/contracts";
import { ErrorState, LoadingState } from "../components/States";
import { publicApi } from "../lib/api";
import { Link } from "../router";

export function CatalogPage() {
  const [albums, setAlbums] = useState<AlbumSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    document.title = "LogJam — choose what stays";
    const controller = new AbortController();
    setError(null);
    void publicApi<{ albums: AlbumSummary[] }>("/api/public/albums", controller.signal)
      .then((payload) => setAlbums(payload.albums))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Albums could not be loaded.");
      });
    return () => controller.abort();
  }, [attempt]);

  return (
    <main className="catalog page-width">
      <section className="catalog-intro" aria-labelledby="catalog-title">
        <p className="eyebrow">A shared edit</p>
        <h1 id="catalog-title">Choose what stays.</h1>
        <p>Browse every published album. Swipe right to keep a frame, left to pass.</p>
      </section>

      {error ? (
        <ErrorState message={error} retry={() => setAttempt((value) => value + 1)} />
      ) : albums === null ? (
        <LoadingState label="Loading albums" />
      ) : albums.length === 0 ? (
        <p className="empty-copy">No published albums yet.</p>
      ) : (
        <section className="album-grid" aria-label="Published albums">
          {albums.map((album) => (
            <Link className="album-card" key={album.id} to={`/albums/${encodeURIComponent(album.slug)}`}>
              <div className="album-card__cover">
                {album.coverUrl ? (
                  <img src={album.coverUrl} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span>No cover</span>
                )}
              </div>
              <div className="album-card__copy">
                <h2>{album.title}</h2>
                <p>{album.subtitle || `${album.photoCount} photographs`}</p>
                <span>{album.photoCount} frames</span>
              </div>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
