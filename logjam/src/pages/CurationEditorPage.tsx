import { useCallback, useEffect, useMemo, useState } from "react";

import type { AccountPayload, CurationDetail, PublicPhoto } from "../../shared/contracts";
import { MAX_PHOTOS_PER_CURATION, moveItem } from "../../shared/logic";
import { ErrorState, LoadingState } from "../components/States";
import { ApiError, jsonBody, privateApi } from "../lib/api";
import { redirectToSignIn, setAuthenticatedHint } from "../lib/auth";
import { Link, useNavigationBlocker, useRouter } from "../router";
import { useDecisions } from "../state/Decisions";

export function CurationEditorPage({ id }: { id: string }) {
  const { navigate } = useRouter();
  const { hydrate } = useDecisions();
  const [account, setAccount] = useState<AccountPayload | null>(null);
  const [curation, setCuration] = useState<CurationDetail | null>(null);
  const [title, setTitle] = useState("");
  const [photos, setPhotos] = useState<PublicPhoto[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [accountPayload, curationPayload] = await Promise.all([
        privateApi<AccountPayload>("/api/private/account"),
        privateApi<{ curation: CurationDetail }>(`/api/private/curations/${encodeURIComponent(id)}`)
      ]);
      setAuthenticatedHint(true);
      hydrate(accountPayload.decisions);
      setAccount(accountPayload);
      setCuration(curationPayload.curation);
      setTitle(curationPayload.curation.title);
      setPhotos(curationPayload.curation.photos);
      setDirty(false);
    } catch (cause) {
      if (cause instanceof ApiError && cause.authenticationRequired) {
        redirectToSignIn(`/account/curations/${encodeURIComponent(id)}`);
        return;
      }
      setError(cause instanceof Error ? cause.message : "Curation could not be loaded.");
    }
  }, [hydrate, id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (curation) document.title = `${curation.title} — LogJam`;
  }, [curation]);

  const selected = useMemo(() => new Set(photos.map((photo) => photo.id)), [photos]);
  const canEdit = Boolean(curation && curation.status === "active" && !curation.locked);
  useNavigationBlocker(dirty);

  const save = useCallback(async (): Promise<CurationDetail> => {
    if (!curation) throw new Error("Curation is not loaded.");
    if (!dirty) return curation;
    const payload = await privateApi<{ curation: CurationDetail }>(
      `/api/private/curations/${encodeURIComponent(curation.id)}`,
      {
        method: "PATCH",
        body: jsonBody({ title, photoIds: photos.map((photo) => photo.id) })
      }
    );
    setCuration(payload.curation);
    setTitle(payload.curation.title);
    setPhotos(payload.curation.photos);
    setDirty(false);
    return payload.curation;
  }, [curation, dirty, photos, title]);

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The curation could not be updated.");
    } finally {
      setBusy(false);
    }
  };

  if (!curation && !error) return <main className="editor-page page-width"><LoadingState label="Loading curation" /></main>;
  if (!curation && error) return <main className="editor-page page-width"><ErrorState message={error} retry={() => void load()} /></main>;
  if (!curation || !account) return null;

  const unavailableCount = Math.max(0, curation.itemCount - photos.length);

  return (
    <main className="editor-page page-width">
      <div className="editor-topline">
        <Link to="/account" className="text-link">← My edit</Link>
        <span>Draft revision {curation.revision}</span>
      </div>
      <header className="editor-heading">
        <p className="eyebrow">Curation</p>
        <input
          aria-label="Curation title"
          value={title}
          maxLength={160}
          disabled={!canEdit}
          onChange={(event) => {
            setTitle(event.target.value);
            setDirty(true);
          }}
        />
        <p>Build one sequence from any photographs you kept. Drag, or use the arrow controls, to set the order.</p>
      </header>

      {curation.locked && <div className="inline-notice">This curation is locked because its promoted album is now published.</div>}
      {curation.status === "archived" && <div className="inline-notice">This curation is archived and read-only.</div>}
      {unavailableCount > 0 && (
        <div className="inline-notice">
          {unavailableCount} saved photo(s) are no longer published and are hidden.{" "}
          {canEdit && (
            <button type="button" className="inline-action" onClick={() => setDirty(true)}>
              Remove unavailable from draft
            </button>
          )}
        </div>
      )}
      {error && <div className="inline-notice inline-notice--error" role="alert">{error}</div>}
      {notice && <div className="inline-notice" role="status">{notice}</div>}

      <div className="editor-layout">
        <aside className="sequence-panel" aria-label="Current sequence">
          <div className="sequence-panel__heading">
            <h2>Sequence</h2>
            <span>{photos.length}/{MAX_PHOTOS_PER_CURATION}</span>
          </div>
          <ol>
            {photos.map((photo, index) => (
              <li
                key={photo.id}
                draggable={canEdit}
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => canEdit && event.preventDefault()}
                onDrop={() => {
                  if (!canEdit || dragIndex === null) return;
                  setPhotos((current) => moveItem(current, dragIndex, index));
                  setDragIndex(null);
                  setDirty(true);
                }}
              >
                <img src={photo.thumbUrl} alt="" loading="lazy" decoding="async" />
                <span>{photo.title || `Photo ${index + 1}`}</span>
                <div>
                  <button
                    type="button"
                    disabled={!canEdit || index === 0}
                    onClick={() => { setPhotos((current) => moveItem(current, index, index - 1)); setDirty(true); }}
                    aria-label={`Move ${photo.title || "photo"} up`}
                  >↑</button>
                  <button
                    type="button"
                    disabled={!canEdit || index === photos.length - 1}
                    onClick={() => { setPhotos((current) => moveItem(current, index, index + 1)); setDirty(true); }}
                    aria-label={`Move ${photo.title || "photo"} down`}
                  >↓</button>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => { setPhotos((current) => current.filter((item) => item.id !== photo.id)); setDirty(true); }}
                    aria-label={`Remove ${photo.title || "photo"} from sequence`}
                  >×</button>
                </div>
              </li>
            ))}
          </ol>
          {photos.length === 0 && <p className="empty-copy">Add kept photographs from the pool.</p>}
        </aside>

        <section className="photo-pool" aria-labelledby="photo-pool-title">
          <div className="photo-pool__heading">
            <h2 id="photo-pool-title">Kept photographs</h2>
            <span>{account.keptPhotos.length}</span>
          </div>
          <div className="photo-pool__grid">
            {account.keptPhotos.map((photo) => {
              const inSequence = selected.has(photo.id);
              return (
                <button
                  type="button"
                  key={photo.id}
                  className={inSequence ? "is-selected" : ""}
                  disabled={!canEdit || (!inSequence && photos.length >= MAX_PHOTOS_PER_CURATION)}
                  aria-pressed={inSequence}
                  onClick={() => {
                    setPhotos((current) => inSequence
                      ? current.filter((item) => item.id !== photo.id)
                      : [...current, photo]);
                    setDirty(true);
                  }}
                >
                  <img src={photo.thumbUrl} alt={photo.title || "Untitled photograph"} loading="lazy" decoding="async" />
                  <span>{inSequence ? "Remove" : "Add"}</span>
                </button>
              );
            })}
          </div>
          {account.keptPhotos.length === 0 && <p className="empty-copy">Keep some photographs before building a curation.</p>}
        </section>
      </div>

      <div className="editor-actions">
        <button
          type="button"
          className="button"
          disabled={!canEdit || !dirty || busy || !title.trim()}
          onClick={() => void run(async () => { await save(); setNotice("Draft saved."); })}
        >
          {busy ? "Working…" : "Save draft"}
        </button>
        <button
          type="button"
          className="button button--dark"
          disabled={!canEdit || busy || photos.length === 0 || !title.trim() || (unavailableCount > 0 && !dirty)}
          onClick={() => void run(async () => {
            const saved = await save();
            const { submission } = await privateApi<{ submission: { version: number } }>(
              `/api/private/curations/${encodeURIComponent(saved.id)}/submit`,
              { method: "POST", body: jsonBody({}) }
            );
            setNotice(`Snapshot v${submission.version} submitted. Your draft remains editable.`);
            await load();
          })}
        >
          Submit snapshot
        </button>
        <button
          type="button"
          className="button button--quiet"
          disabled={!canEdit || busy}
          onClick={() => {
            const detail = dirty ? " Unsaved changes will be discarded." : "";
            if (!window.confirm(`Archive “${curation.title}”?${detail}`)) return;
            void run(async () => {
              await privateApi<void>(`/api/private/curations/${encodeURIComponent(curation.id)}`, {
                method: "DELETE",
                body: jsonBody({})
              });
              navigate("/account", { bypassBlocker: true });
            });
          }}
        >
          Archive
        </button>
      </div>

      {curation.submissions.length > 0 && (
        <section className="snapshot-list">
          <h2>Submitted snapshots</h2>
          {curation.submissions.map((submission) => (
            <div key={submission.id}>
              <span>v{submission.version} · {submission.itemCount} photos</span>
              <time dateTime={submission.submittedAt}>{new Date(submission.submittedAt).toLocaleString()}</time>
              <span>{submission.promotedAlbumId ? "Promoted" : submission.status}</span>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
