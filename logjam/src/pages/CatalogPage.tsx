import { useEffect, useMemo, useState } from "react";

import type { AlbumDecisionProgress, AlbumSummary } from "../../shared/contracts";
import { ErrorState, LoadingState } from "../components/States";
import { ApiError, privateApi, publicApi } from "../lib/api";
import { hasAuthenticatedHint, setAuthenticatedHint } from "../lib/auth";
import {
  formatAlbumProgress,
  isAlbumFullyDecided,
  shouldLockAlbumNavigation,
  type AlbumProgressStatus
} from "../lib/catalogProgress";
import { Link } from "../router";

export function CatalogPage() {
  const [albums, setAlbums] = useState<AlbumSummary[] | null>(null);
  const [progress, setProgress] = useState<AlbumDecisionProgress[] | null>(null);
  const [progressStatus, setProgressStatus] = useState<AlbumProgressStatus>(
    () => hasAuthenticatedHint() ? "loading" : "anonymous"
  );
  const [progressError, setProgressError] = useState<string | null>(null);
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

  useEffect(() => {
    if (!hasAuthenticatedHint()) {
      setProgress(null);
      setProgressStatus("anonymous");
      setProgressError(null);
      return;
    }
    const controller = new AbortController();
    setProgressStatus("loading");
    setProgressError(null);
    void privateApi<{ progress: AlbumDecisionProgress[] }>("/api/private/album-progress", {
      signal: controller.signal
    })
      .then((payload) => {
        setProgress(payload.progress);
        setProgressStatus("ready");
      })
      .catch((cause: unknown) => {
        if (cause instanceof ApiError && cause.authenticationRequired) {
          setAuthenticatedHint(false);
          setProgressStatus("anonymous");
          setProgressError(null);
        } else if (!controller.signal.aborted) {
          setProgressStatus("error");
          setProgressError(cause instanceof Error ? cause.message : "Album progress could not be loaded.");
        }
        if (!controller.signal.aborted) setProgress(null);
      });
    return () => controller.abort();
  }, [attempt]);

  const progressByAlbumId = useMemo(
    () => new Map((progress ?? []).map((item) => [item.albumId, item])),
    [progress]
  );

  return (
    <main className="catalog page-width">
      <section className="catalog-intro" aria-labelledby="catalog-title">
        <h1 id="catalog-title">Choose what stays.</h1>
        <p className="catalog-intro__description">
          Browse every published album. Swipe right to keep a frame, left to pass.
        </p>
      </section>

      {error ? (
        <ErrorState message={error} retry={() => setAttempt((value) => value + 1)} />
      ) : albums === null ? (
        <LoadingState label="Loading albums" />
      ) : albums.length === 0 ? (
        <p className="empty-copy">No published albums yet.</p>
      ) : (
        <>
          {progressError && (
            <p className="inline-notice inline-notice--error" role="alert">
              {progressError} Album links are paused until your progress is available.{" "}
              <button className="inline-action" type="button" onClick={() => setAttempt((value) => value + 1)}>
                Try again
              </button>
            </p>
          )}
          <section
            className="album-grid"
            aria-label="Published albums"
            aria-busy={progressStatus === "loading" || undefined}
          >
            {albums.map((album) => {
              const albumProgress = progressByAlbumId.get(album.id);
              const complete = isAlbumFullyDecided(albumProgress);
              const navigationLocked = shouldLockAlbumNavigation(progressStatus, albumProgress);
              const cardContent = (
                <>
                  <div className="album-card__cover">
                    {album.coverUrl ? (
                      <img src={album.coverUrl} alt="" loading="lazy" decoding="async" />
                    ) : (
                      <span>No cover</span>
                    )}
                  </div>
                  <div className="album-card__copy">
                    <div className="album-card__headline">
                      <h2 title={album.title}>{album.title}</h2>
                      <span className="album-card__frames">{album.photoCount} frames</span>
                    </div>
                    {albumProgress && (
                      <p className="album-card__progress">
                        <span>{formatAlbumProgress(albumProgress)}</span>
                        {complete && <span className="album-card__sorted">Sorted</span>}
                      </p>
                    )}
                  </div>
                </>
              );

              if (navigationLocked) {
                const stateClass = complete ? "album-card--complete" : "album-card--pending";
                return (
                  <article
                    className={`album-card ${stateClass}`}
                    key={album.id}
                    aria-disabled="true"
                    aria-busy={progressStatus === "loading" || undefined}
                  >
                    {cardContent}
                  </article>
                );
              }

              return (
                <Link
                  className="album-card"
                  key={album.id}
                  to={`/albums/${encodeURIComponent(album.slug)}`}
                >
                  {cardContent}
                </Link>
              );
            })}
          </section>
        </>
      )}
    </main>
  );
}
