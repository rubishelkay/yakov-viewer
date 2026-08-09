import { useCallback, useEffect, useId, useRef, useState } from "react";

import type { AccountPayload, AccountPhoto, CurationSummary, DecisionValue } from "../../shared/contracts";
import { MAX_CURATIONS_PER_USER } from "../../shared/logic";
import { ErrorState, LoadingState } from "../components/States";
import { reclassifyAccountPhoto } from "../lib/account";
import { ApiError, jsonBody, privateApi } from "../lib/api";
import { redirectToSignIn, setAuthenticatedHint } from "../lib/auth";
import { Link, useRouter } from "../router";
import { useDecisions } from "../state/Decisions";

type Tab = "kept" | "passed" | "curations";

export function AccountPage() {
  const { navigate } = useRouter();
  const { decide, hydrate, isBusy } = useDecisions();
  const [account, setAccount] = useState<AccountPayload | null>(null);
  const [tab, setTab] = useState<Tab>("kept");
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [changingPhotoIds, setChangingPhotoIds] = useState<Set<string>>(() => new Set());
  const [announcement, setAnnouncement] = useState("");
  const changingPhotoIdsRef = useRef(new Set<string>());

  const load = useCallback(async () => {
    setError(null);
    try {
      const payload = await privateApi<AccountPayload>("/api/private/account");
      setAuthenticatedHint(true);
      hydrate(payload.decisions);
      setAccount(payload);
    } catch (cause) {
      if (cause instanceof ApiError && cause.authenticationRequired) {
        redirectToSignIn("/account");
        return;
      }
      setError(cause instanceof Error ? cause.message : "Your edit could not be loaded.");
    }
  }, [hydrate]);

  useEffect(() => {
    document.title = "My edit — LogJam";
    void load();
  }, [load]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || creating) return;
    setCreating(true);
    try {
      const { curation } = await privateApi<{ curation: CurationSummary }>("/api/private/curations", {
        method: "POST",
        body: jsonBody({ title })
      });
      navigate(`/account/curations/${encodeURIComponent(curation.id)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Curation could not be created.");
    } finally {
      setCreating(false);
    }
  };

  const changePhotoStatus = useCallback(async (
    photo: AccountPhoto,
    previousDecision: DecisionValue,
    nextDecision: DecisionValue
  ) => {
    if (isBusy || changingPhotoIdsRef.current.size > 0) return;
    changingPhotoIdsRef.current.add(photo.id);
    setChangingPhotoIds((current) => new Set(current).add(photo.id));
    setError(null);

    const previousUpdatedAt = account?.decisions.find((record) => record.photoId === photo.id)?.updatedAt;
    setAccount((current) => current
      ? reclassifyAccountPhoto(current, photo.id, nextDecision)
      : current);

    try {
      await decide(photo.id, nextDecision, { recordUndo: false });
      const destination = nextDecision === "keep" ? "Kept" : "Passed";
      setAnnouncement(`Moved photograph from ${photo.sourceAlbumTitle || "Untitled album"} to ${destination}.`);
      await load();
    } catch (cause) {
      setAccount((current) => current
        ? reclassifyAccountPhoto(current, photo.id, previousDecision, previousUpdatedAt)
        : current);
      setError(cause instanceof Error ? cause.message : "Photo status could not be changed.");
      setAnnouncement("Photo status could not be changed. The previous status was restored.");
    } finally {
      changingPhotoIdsRef.current.delete(photo.id);
      setChangingPhotoIds((current) => {
        const next = new Set(current);
        next.delete(photo.id);
        return next;
      });
    }
  }, [account?.decisions, decide, isBusy, load]);

  const statusMutationBusy = isBusy || changingPhotoIds.size > 0;

  if (!account && !error) return <main className="account-page page-width"><LoadingState label="Loading your edit" /></main>;
  if (!account && error) return <main className="account-page page-width"><ErrorState message={error} retry={() => void load()} /></main>;
  if (!account) return null;

  return (
    <main className="account-page page-width">
      <div className="visually-hidden" aria-live="polite">{announcement}</div>
      <header className="account-heading">
        <p className="eyebrow">Private workspace</p>
        <h1>{account.viewer.displayName}’s edit</h1>
        <p>{account.viewer.email}</p>
      </header>
      {error && <div className="inline-notice" role="alert">{error}</div>}
      <nav className="account-tabs" aria-label="Your decisions">
        <TabButton active={tab === "kept"} onClick={() => setTab("kept")}>Kept <span>{account.keptPhotos.length}</span></TabButton>
        <TabButton active={tab === "passed"} onClick={() => setTab("passed")}>Passed <span>{account.passedPhotos.length}</span></TabButton>
        <TabButton active={tab === "curations"} onClick={() => setTab("curations")}>Curations <span>{account.curations.length}</span></TabButton>
      </nav>

      {tab === "kept" && (
        <PhotoGrid
          photos={account.keptPhotos}
          empty="No kept photographs yet."
          label="Kept photographs"
          currentDecision="keep"
          changingPhotoIds={changingPhotoIds}
          statusMutationBusy={statusMutationBusy}
          onChangeStatus={changePhotoStatus}
        />
      )}
      {tab === "passed" && (
        <PhotoGrid
          photos={account.passedPhotos}
          empty="No passed photographs yet."
          label="Passed photographs"
          currentDecision="pass"
          changingPhotoIds={changingPhotoIds}
          statusMutationBusy={statusMutationBusy}
          onChangeStatus={changePhotoStatus}
        />
      )}
      {tab === "curations" && (
        <section className="curations-panel">
          <form className="new-curation" onSubmit={create}>
            <label htmlFor="curation-title">New curation</label>
            <div>
              <input
                id="curation-title"
                value={title}
                maxLength={160}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="A quiet sequence"
              />
              <button className="button button--dark" disabled={creating || !title.trim()} type="submit">
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
            <p>Up to {MAX_CURATIONS_PER_USER} curations per account.</p>
          </form>
          <div className="curation-list">
            {account.curations.map((curation) => (
              <Link key={curation.id} to={`/account/curations/${encodeURIComponent(curation.id)}`}>
                <div>
                  <h2>{curation.title}</h2>
                  <p>{curation.itemCount} photos · {curation.submissionCount} snapshots</p>
                </div>
                <span>{curation.locked ? "Published · locked" : curation.status}</span>
              </Link>
            ))}
            {account.curations.length === 0 && <p className="empty-copy">Create a curation from photographs you kept.</p>}
          </div>
        </section>
      )}
    </main>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick(): void; children: React.ReactNode }) {
  return <button type="button" className={active ? "is-active" : ""} onClick={onClick} aria-pressed={active}>{children}</button>;
}

function PhotoGrid({
  photos,
  empty,
  label,
  currentDecision,
  changingPhotoIds,
  statusMutationBusy,
  onChangeStatus
}: {
  photos: AccountPhoto[];
  empty: string;
  label: string;
  currentDecision: DecisionValue;
  changingPhotoIds: Set<string>;
  statusMutationBusy: boolean;
  onChangeStatus(photo: AccountPhoto, previousDecision: DecisionValue, nextDecision: DecisionValue): Promise<void>;
}) {
  if (photos.length === 0) return <p className="empty-copy">{empty}</p>;
  const nextDecision: DecisionValue = currentDecision === "keep" ? "pass" : "keep";
  return (
    <section className="selection-grid" aria-label={label}>
      {photos.map((photo) => (
        <DecisionPhoto
          key={photo.id}
          photo={photo}
          currentDecision={currentDecision}
          nextDecision={nextDecision}
          changing={changingPhotoIds.has(photo.id)}
          disabled={statusMutationBusy}
          onChangeStatus={onChangeStatus}
        />
      ))}
    </section>
  );
}

function DecisionPhoto({
  photo,
  currentDecision,
  nextDecision,
  changing,
  disabled,
  onChangeStatus
}: {
  photo: AccountPhoto;
  currentDecision: DecisionValue;
  nextDecision: DecisionValue;
  changing: boolean;
  disabled: boolean;
  onChangeStatus(photo: AccountPhoto, previousDecision: DecisionValue, nextDecision: DecisionValue): Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const figureRef = useRef<HTMLElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    menuItemRef.current?.focus({ preventScroll: true });
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!statusRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [menuOpen]);

  const destination = nextDecision === "keep" ? "Kept" : "Passed";
  const albumTitle = photo.sourceAlbumTitle || "Untitled album";

  return (
    <figure ref={figureRef} className="selection-card" aria-busy={changing || undefined}>
      <div className="selection-card__media">
        <img src={photo.thumbUrl} alt={`Photograph from ${albumTitle}`} loading="lazy" decoding="async" />
        <div
          ref={statusRef}
          className="selection-card__status"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            setMenuOpen(false);
            triggerRef.current?.focus();
          }}
        >
          <button
            ref={triggerRef}
            className="selection-card__status-trigger"
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? menuId : undefined}
            aria-label={`Change status for photograph from ${albumTitle}`}
            disabled={changing || disabled}
            onClick={() => setMenuOpen((open) => !open)}
          >
            Change status
          </button>
          {menuOpen && (
            <div id={menuId} className="selection-card__status-menu" role="menu" aria-label={`Change status for photograph from ${albumTitle}`}>
              <button
                ref={menuItemRef}
                type="button"
                role="menuitem"
                disabled={changing || disabled}
                onClick={() => {
                  const adjacentTrigger = figureRef.current?.nextElementSibling
                    ?.querySelector<HTMLButtonElement>(".selection-card__status-trigger")
                    ?? figureRef.current?.previousElementSibling
                      ?.querySelector<HTMLButtonElement>(".selection-card__status-trigger")
                    ?? document.querySelector<HTMLButtonElement>(".account-tabs button.is-active");
                  setMenuOpen(false);
                  adjacentTrigger?.focus({ preventScroll: true });
                  void onChangeStatus(photo, currentDecision, nextDecision);
                }}
              >
                Move to {destination}
              </button>
            </div>
          )}
        </div>
      </div>
      <figcaption>{albumTitle}</figcaption>
    </figure>
  );
}
