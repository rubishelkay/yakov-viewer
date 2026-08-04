import { useCallback, useEffect, useState } from "react";

import type { AccountPayload, CurationSummary, PublicPhoto } from "../../shared/contracts";
import { MAX_CURATIONS_PER_USER } from "../../shared/logic";
import { ErrorState, LoadingState } from "../components/States";
import { ApiError, jsonBody, privateApi } from "../lib/api";
import { redirectToSignIn, setAuthenticatedHint } from "../lib/auth";
import { Link, useRouter } from "../router";
import { useDecisions } from "../state/Decisions";

type Tab = "kept" | "passed" | "curations";

export function AccountPage() {
  const { navigate } = useRouter();
  const { hydrate } = useDecisions();
  const [account, setAccount] = useState<AccountPayload | null>(null);
  const [tab, setTab] = useState<Tab>("kept");
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

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

  if (!account && !error) return <main className="account-page page-width"><LoadingState label="Loading your edit" /></main>;
  if (!account && error) return <main className="account-page page-width"><ErrorState message={error} retry={() => void load()} /></main>;
  if (!account) return null;

  return (
    <main className="account-page page-width">
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

      {tab === "kept" && <PhotoGrid photos={account.keptPhotos} empty="No kept photographs yet." />}
      {tab === "passed" && <PhotoGrid photos={account.passedPhotos} empty="No passed photographs yet." />}
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

function PhotoGrid({ photos, empty }: { photos: PublicPhoto[]; empty: string }) {
  if (photos.length === 0) return <p className="empty-copy">{empty}</p>;
  return (
    <section className="selection-grid" aria-label="Photographs">
      {photos.map((photo) => (
        <figure key={photo.id}>
          <img src={photo.thumbUrl} alt={photo.title || "Untitled photograph"} loading="lazy" decoding="async" />
          <figcaption>{photo.title || "Untitled"}</figcaption>
        </figure>
      ))}
    </section>
  );
}
