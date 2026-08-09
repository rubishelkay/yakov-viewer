"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArchiveX,
  ArrowRight,
  FolderUp,
  ListChecks,
  LockKeyhole,
  MailPlus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  X,
  UserRound,
  UsersRound
} from "lucide-react";

import {
  isLogjamSubmissionPhotoPromotable,
  mutateLogjamAdmin,
  readLogjamAdmin,
  readLogjamSubmissionDetail,
  type LogjamAdminCuration,
  type LogjamAdminInvite,
  type LogjamAdminMutation,
  type LogjamAdminSnapshot,
  type LogjamAdminSubmission,
  type LogjamAdminSubmissionDetail,
  type LogjamAdminUser
} from "@/admin/logjam-admin-api";
import { useAdminArchive } from "@/admin/cloud-admin-state";
import { useAdminConfirmDialog } from "@/components/admin/AdminConfirmDialog";

const logjamUrl = "https://logjam.shmol.cc";
const protectedOwnerEmail = "jacobjshmol@gmail.com";

const timestampFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC"
});

export function LogjamAdmin() {
  const { confirm, dialog } = useAdminConfirmDialog();
  const { actions: adminArchiveActions } = useAdminArchive();
  const [snapshot, setSnapshot] = useState<LogjamAdminSnapshot>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [inviteAddress, setInviteAddress] = useState("");
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
  const [titleOverrides, setTitleOverrides] = useState<Record<string, string>>({});
  const [selectedSubmissionId, setSelectedSubmissionId] = useState("");
  const [submissionDetail, setSubmissionDetail] = useState<LogjamAdminSubmissionDetail>();
  const [submissionDetailError, setSubmissionDetailError] = useState("");
  const [submissionDetailLoading, setSubmissionDetailLoading] = useState(false);
  const [submissionDetailAttempt, setSubmissionDetailAttempt] = useState(0);

  const applySnapshot = useCallback((next: LogjamAdminSnapshot) => {
    setSnapshot(next);
    setDisplayNames(Object.fromEntries(
      next.users.map((user) => [user.id, user.displayName ?? ""])
    ));
    setError("");
  }, []);

  const loadSnapshot = useCallback(async (signal?: AbortSignal) => {
    try {
      const next = await readLogjamAdmin(signal);
      applySnapshot(next);
    } catch (loadError) {
      if (isAbortError(loadError)) return;
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [applySnapshot]);

  useEffect(() => {
    const controller = new AbortController();
    void readLogjamAdmin(controller.signal)
      .then(applySnapshot)
      .catch((loadError) => {
        if (!isAbortError(loadError)) setError(errorMessage(loadError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [applySnapshot]);

  useEffect(() => {
    if (!selectedSubmissionId) return;

    const controller = new AbortController();
    void readLogjamSubmissionDetail(selectedSubmissionId, controller.signal)
      .then((detail) => setSubmissionDetail(detail))
      .catch((detailError) => {
        if (!isAbortError(detailError)) setSubmissionDetailError(errorMessage(detailError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setSubmissionDetailLoading(false);
      });

    return () => controller.abort();
  }, [selectedSubmissionId, submissionDetailAttempt]);

  const totals = useMemo(() => {
    const submissions = snapshot?.curations.flatMap((curation) => curation.submissions) ?? [];
    return {
      curations: snapshot?.curations.length ?? 0,
      promoted: submissions.filter((submission) => Boolean(submission.promotedAlbumId)).length,
      submissions: submissions.length,
      users: snapshot?.users.length ?? 0
    };
  }, [snapshot]);

  async function refresh() {
    setPendingAction("refresh");
    setNotice("");
    setError("");
    if (!snapshot) setLoading(true);
    await loadSnapshot();
    setPendingAction("");
  }

  function reviewSubmission(submissionId: string) {
    setSubmissionDetail(undefined);
    setSubmissionDetailError("");
    setSubmissionDetailLoading(true);
    setSelectedSubmissionId(submissionId);
  }

  function retrySubmissionDetail() {
    if (!selectedSubmissionId) return;
    setSubmissionDetail(undefined);
    setSubmissionDetailError("");
    setSubmissionDetailLoading(true);
    setSubmissionDetailAttempt((attempt) => attempt + 1);
  }

  async function runMutation(
    key: string,
    mutation: LogjamAdminMutation,
    success: string,
    afterSuccess?: () => Promise<void>
  ) {
    setPendingAction(key);
    setError("");
    setNotice("");
    try {
      await mutateLogjamAdmin(mutation);
      await loadSnapshot();
      await afterSuccess?.();
      setNotice(success);
      return true;
    } catch (mutationError) {
      setError(errorMessage(mutationError));
      return false;
    } finally {
      setPendingAction("");
    }
  }

  async function renameUser(user: LogjamAdminUser) {
    const displayName = (displayNames[user.id] ?? "").trim() || null;
    if (displayName === user.displayName) return;
    await runMutation(
      `rename:${user.id}`,
      { action: "rename-user", userId: user.id, displayName },
      `Display name updated for ${user.email}.`
    );
  }

  async function addInvitation() {
    const email = inviteAddress.trim();
    if (!email) return;
    const invited = await runMutation(
      `invite:${email.toLowerCase()}`,
      { action: "invite-email", email },
      `LogJam access is allowed for ${email.toLowerCase()}. Share the LogJam link manually.`
    );
    if (invited) setInviteAddress("");
  }

  async function revokeInvitation(invitation: LogjamAdminInvite) {
    if (invitation.email === protectedOwnerEmail) return;
    const confirmed = await confirm({
      confirmLabel: "Revoke access",
      message: `Remove ${invitation.email} from the LogJam access list? Their existing decisions and curations will be preserved.`,
      title: "Revoke LogJam access"
    });
    if (!confirmed) return;

    await runMutation(
      `revoke:${invitation.email}`,
      { action: "revoke-invite", email: invitation.email },
      `LogJam access revoked for ${invitation.email}. Existing work was preserved.`
    );
  }

  async function archiveSubmission(submission: LogjamAdminSubmission) {
    if (submission.promotedAlbumId || isArchived(submission)) return;
    const confirmed = await confirm({
      confirmLabel: "Archive submission",
      message: `Archive immutable submission v${submission.version} “${submission.title}”? Its working curation remains unchanged.`,
      title: "Archive LogJam submission"
    });
    if (!confirmed) return;

    await runMutation(
      `archive:${submission.id}`,
      { action: "archive-submission", submissionId: submission.id },
      `Submission v${submission.version} archived.`
    );
  }

  async function promoteSubmission(submission: LogjamAdminSubmission) {
    if (submission.promotedAlbumId || isArchived(submission)) return;
    const override = (titleOverrides[submission.id] ?? "").trim();
    const canonicalTitle = override || submission.title;
    const confirmed = await confirm({
      confirmLabel: "Create draft album",
      message: `Create canonical draft album “${canonicalTitle}” from immutable submission v${submission.version}? Existing Photo and Asset records will be reused.`,
      title: "Promote LogJam submission"
    });
    if (!confirmed) return;

    const promoted = await runMutation(
      `promote:${submission.id}`,
      {
        action: "promote-submission",
        submissionId: submission.id,
        ...(override ? { title: override } : {})
      },
      `Submission v${submission.version} promoted to a canonical draft album.`,
      adminArchiveActions.refreshArchive
    );
    if (promoted) {
      setTitleOverrides((current) => ({ ...current, [submission.id]: "" }));
      setSelectedSubmissionId("");
    }
  }

  return (
    <div className="admin-page admin-logjam-page">
      {dialog}
      <header className="admin-page__header">
        <div>
          <p className="admin-kicker">Curator intake</p>
          <h1>LogJam</h1>
          <p>
            Review private working curations and their immutable submissions. Only an owner
            promotion creates a canonical draft album in the public archive.
          </p>
        </div>
        <button
          className="admin-ghost-button"
          disabled={Boolean(pendingAction)}
          onClick={() => void refresh()}
          type="button"
        >
          <RefreshCw aria-hidden />
          {pendingAction === "refresh" ? "Refreshing" : "Refresh LogJam"}
        </button>
      </header>

      <section className="admin-logjam-metrics" aria-label="LogJam snapshot">
        <LogjamMetric icon={<UsersRound />} label="Curators" value={totals.users} />
        <LogjamMetric icon={<ListChecks />} label="Working curations" value={totals.curations} />
        <LogjamMetric icon={<LockKeyhole />} label="Submissions" value={totals.submissions} />
        <LogjamMetric icon={<FolderUp />} label="Promoted drafts" value={totals.promoted} />
      </section>

      {error && snapshot ? <p className="admin-logjam-message admin-logjam-message--error" role="alert">{error}</p> : null}
      {notice ? <p className="admin-logjam-message" role="status">{notice}</p> : null}

      {loading ? (
        <div className="admin-inline-empty" role="status">Loading LogJam curators and submissions…</div>
      ) : !snapshot && error ? (
        <div className="admin-logjam-message admin-logjam-message--error admin-logjam-message--action" role="alert">
          <span>{error}</span>
          <button
            className="admin-ghost-button"
            disabled={Boolean(pendingAction)}
            onClick={() => void refresh()}
            type="button"
          >
            <RefreshCw aria-hidden />
            Retry overview
          </button>
        </div>
      ) : snapshot ? (
        <>
          <LogjamInvitesPanel
            inviteAddress={inviteAddress}
            invitations={snapshot.invites}
            onAddressChange={setInviteAddress}
            onInvite={addInvitation}
            onRevoke={revokeInvitation}
            pendingAction={pendingAction}
          />
          {snapshot.users.length ? (
            <div className="admin-logjam-users">
              {snapshot.users.map((user) => (
                <LogjamUserPanel
                  curations={snapshot.curations.filter((curation) => curation.userId === user.id)}
                  displayName={displayNames[user.id] ?? ""}
                  key={user.id}
                  onArchive={archiveSubmission}
                  onDisplayNameChange={(value) => setDisplayNames((current) => ({
                    ...current,
                    [user.id]: value
                  }))}
                  onReview={reviewSubmission}
                  onRename={renameUser}
                  pendingAction={pendingAction}
                  user={user}
                />
              ))}
            </div>
          ) : (
            <div className="admin-inline-empty">No LogJam users yet. Curators appear after their first authenticated session.</div>
          )}
        </>
      ) : null}

      {selectedSubmissionId ? (
        <LogjamSubmissionDetailDialog
          detail={submissionDetail}
          error={submissionDetailError}
          loading={submissionDetailLoading}
          onClose={() => setSelectedSubmissionId("")}
          onPromote={promoteSubmission}
          onRetry={retrySubmissionDetail}
          onTitleOverrideChange={(submissionId, value) => setTitleOverrides((current) => ({
            ...current,
            [submissionId]: value
          }))}
          pendingAction={pendingAction}
          titleOverride={titleOverrides[selectedSubmissionId] ?? ""}
        />
      ) : null}
    </div>
  );
}

function LogjamInvitesPanel({
  inviteAddress,
  invitations,
  onAddressChange,
  onInvite,
  onRevoke,
  pendingAction
}: {
  inviteAddress: string;
  invitations: LogjamAdminInvite[];
  onAddressChange: (value: string) => void;
  onInvite: () => Promise<void>;
  onRevoke: (invitation: LogjamAdminInvite) => Promise<void>;
  pendingAction: string;
}) {
  return (
    <section className="admin-panel admin-logjam-invites">
      <header className="admin-panel__head">
        <div>
          <p className="admin-kicker">Access list</p>
          <h2>Invite curators</h2>
          <p className="admin-panel__copy">
            Add an email here, then share{" "}
            <a href={logjamUrl} rel="noreferrer" target="_blank">logjam.shmol.cc</a> manually.
            {" "}No invitation email is sent in this first version.
          </p>
        </div>
        <span className="admin-count" aria-label={`${invitations.length} allowed emails`}>
          {invitations.length}
        </span>
      </header>

      <form
        className="admin-logjam-invite-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onInvite();
        }}
      >
        <label className="admin-field">
          <span>Email allowed to use LogJam</span>
          <input
            autoComplete="email"
            inputMode="email"
            maxLength={254}
            onChange={(event) => onAddressChange(event.target.value)}
            placeholder="friend@example.com"
            required
            type="email"
            value={inviteAddress}
          />
        </label>
        <button
          className="admin-button admin-button--primary"
          disabled={Boolean(pendingAction) || !inviteAddress.trim()}
          type="submit"
        >
          <MailPlus aria-hidden />
          {pendingAction.startsWith("invite:") ? "Adding" : "Allow email"}
        </button>
      </form>

      <div className="admin-logjam-invite-list" aria-label="Allowed LogJam emails">
        {invitations.map((invitation) => {
          const owner = invitation.email === protectedOwnerEmail;
          const isRevoking = pendingAction === `revoke:${invitation.email}`;
          return (
            <div className="admin-logjam-invite" key={invitation.email}>
              <span className="admin-logjam-invite__icon" aria-hidden>
                {owner ? <ShieldCheck /> : <UserRound />}
              </span>
              <div className="admin-logjam-invite__identity">
                <a href={`mailto:${invitation.email}`}>{invitation.email}</a>
                <small>
                  Invited <TimestampValue value={invitation.invitedAt} />
                </small>
              </div>
              <span
                className="admin-status"
                data-status={invitation.joinedAt ? "published" : "review"}
              >
                {invitation.joinedAt ? "Joined" : "Not used yet"}
              </span>
              {owner ? (
                <span className="admin-logjam-invite__owner">Owner · permanent</span>
              ) : (
                <button
                  aria-label={`Revoke LogJam access for ${invitation.email}`}
                  className="admin-danger-button"
                  disabled={Boolean(pendingAction)}
                  onClick={() => void onRevoke(invitation)}
                  type="button"
                >
                  <Trash2 aria-hidden />
                  {isRevoking ? "Revoking" : "Revoke"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LogjamUserPanel({
  curations,
  displayName,
  onArchive,
  onDisplayNameChange,
  onReview,
  onRename,
  pendingAction,
  user
}: {
  curations: LogjamAdminCuration[];
  displayName: string;
  onArchive: (submission: LogjamAdminSubmission) => Promise<void>;
  onDisplayNameChange: (value: string) => void;
  onReview: (submissionId: string) => void;
  onRename: (user: LogjamAdminUser) => Promise<void>;
  pendingAction: string;
  user: LogjamAdminUser;
}) {
  const isRenaming = pendingAction === `rename:${user.id}`;
  const unchangedName = displayName.trim() === (user.displayName ?? "");

  return (
    <article className="admin-panel admin-logjam-user">
      <header className="admin-logjam-user__head">
        <div className="admin-logjam-user__identity">
          <span className="admin-logjam-user__avatar" aria-hidden><UserRound /></span>
          <div>
            <p className="admin-kicker">Curator</p>
            <h2>{user.displayName || user.email}</h2>
            <a href={`mailto:${user.email}`}>{user.email}</a>
          </div>
        </div>
        <div className="admin-logjam-user__dates">
          <Timestamp label="Joined" value={user.createdAt} />
          {user.lastSeenAt ? <Timestamp label="Last seen" value={user.lastSeenAt} /> : null}
        </div>
      </header>

      <div className="admin-logjam-rename">
        <label className="admin-field">
          <span>Owner display name</span>
          <input
            aria-label={`Display name for ${user.email}`}
            maxLength={120}
            onChange={(event) => onDisplayNameChange(event.target.value)}
            placeholder="Curator name"
            value={displayName}
          />
        </label>
        <button
          className="admin-button"
          disabled={Boolean(pendingAction) || unchangedName}
          onClick={() => void onRename(user)}
          type="button"
        >
          <Save aria-hidden />
          {isRenaming ? "Saving" : "Save name"}
        </button>
      </div>

      <div className="admin-logjam-curations">
        {curations.length ? curations.map((curation) => (
          <LogjamCurationPanel
            curation={curation}
            key={curation.id}
            onArchive={onArchive}
            onReview={onReview}
            pendingAction={pendingAction}
          />
        )) : (
          <div className="admin-inline-empty">This curator has no working curations.</div>
        )}
      </div>
    </article>
  );
}

function LogjamCurationPanel({
  curation,
  onArchive,
  onReview,
  pendingAction
}: {
  curation: LogjamAdminCuration;
  onArchive: (submission: LogjamAdminSubmission) => Promise<void>;
  onReview: (submissionId: string) => void;
  pendingAction: string;
}) {
  return (
    <section className="admin-logjam-curation">
      <div className="admin-logjam-curation__head">
        <div>
          <p className="admin-kicker">Private working curation</p>
          <h3>{curation.title}</h3>
          <p>
            {curation.locked ? "Locked after canonical publication" : "Mutable workspace"}
            {" · revision "}{curation.revision}{" · updated "}
            <TimestampValue value={curation.updatedAt} />
          </p>
        </div>
        <span className="admin-row-badges">
          {curation.locked ? <span className="admin-status" data-status="locked">locked</span> : null}
          <span className="admin-status" data-status={curation.status}>{curation.status}</span>
        </span>
      </div>

      <div className="admin-logjam-counts" aria-label={`${curation.title} counts`}>
        <Count label="Photos" value={curation.photoCount} />
        <Count label="Revision" value={curation.revision} />
        <Count label="Versions" value={curation.submissions.length} />
      </div>

      <div className="admin-logjam-submission-section">
        <div className="admin-logjam-submission-section__head">
          <div>
            <p className="admin-kicker">Immutable history</p>
            <h4>Submitted versions</h4>
          </div>
          <span className="admin-count">{curation.submissions.length}</span>
        </div>

        {curation.submissions.length ? (
          <div className="admin-logjam-submissions">
            {curation.submissions.map((submission) => (
              <LogjamSubmissionRow
                key={submission.id}
                onArchive={onArchive}
                onReview={onReview}
                pendingAction={pendingAction}
                submission={submission}
              />
            ))}
          </div>
        ) : (
          <div className="admin-inline-empty">No immutable submissions yet. The working curation is still private.</div>
        )}
      </div>
    </section>
  );
}

function LogjamSubmissionRow({
  onArchive,
  onReview,
  pendingAction,
  submission
}: {
  onArchive: (submission: LogjamAdminSubmission) => Promise<void>;
  onReview: (submissionId: string) => void;
  pendingAction: string;
  submission: LogjamAdminSubmission;
}) {
  const archived = isArchived(submission);
  const promoted = Boolean(submission.promotedAlbumId);
  const state = promoted ? "promoted" : archived ? "archived" : submission.status;
  const actionDisabled = Boolean(pendingAction) || promoted || archived;

  return (
    <article className="admin-logjam-submission" data-state={state}>
      <div className="admin-logjam-submission__summary">
        <span className="admin-logjam-submission__lock" aria-hidden><LockKeyhole /></span>
        <div>
          <div className="admin-logjam-submission__title">
            <strong>v{submission.version} · {submission.title}</strong>
            <span className="admin-status" data-status={state}>{state}</span>
          </div>
          <p>
            {submission.photoCount} photos · submitted <TimestampValue value={submission.submittedAt} />
          </p>
          {submission.archivedAt ? <p>Archived <TimestampValue value={submission.archivedAt} /></p> : null}
          {submission.promotedAt ? <p>Promoted <TimestampValue value={submission.promotedAt} /></p> : null}
        </div>
      </div>

      {promoted ? (
        <div className="admin-logjam-promoted">
          <div>
            <span>Canonical album</span>
            <strong>{submission.title}</strong>
            <small>{submission.promotedAlbumStatus ?? "status unavailable"}</small>
          </div>
          <Link className="admin-inline-link" href="/admin/albums" prefetch={false}>
            Open albums <ArrowRight aria-hidden />
          </Link>
        </div>
      ) : (
        <div className="admin-logjam-submission__actions">
          <button
            className="admin-button admin-button--primary"
            disabled={Boolean(pendingAction)}
            onClick={() => onReview(submission.id)}
            type="button"
          >
            <ListChecks aria-hidden />
            Review photos
          </button>
          <button
            className="admin-ghost-button"
            disabled={actionDisabled}
            onClick={() => void onArchive(submission)}
            type="button"
          >
            <ArchiveX aria-hidden />
            {pendingAction === `archive:${submission.id}` ? "Archiving" : "Archive"}
          </button>
        </div>
      )}
    </article>
  );
}

function LogjamSubmissionDetailDialog({
  detail,
  error,
  loading,
  onClose,
  onPromote,
  onRetry,
  onTitleOverrideChange,
  pendingAction,
  titleOverride
}: {
  detail: LogjamAdminSubmissionDetail | undefined;
  error: string;
  loading: boolean;
  onClose: () => void;
  onPromote: (submission: LogjamAdminSubmission) => Promise<void>;
  onRetry: () => void;
  onTitleOverrideChange: (submissionId: string, value: string) => void;
  pendingAction: string;
  titleOverride: string;
}) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const blockedPhotos = detail?.photos.filter((photo) => (
    !isLogjamSubmissionPhotoPromotable(photo)
  )) ?? [];
  const submission = detail?.submission;
  const promoted = Boolean(submission?.promotedAlbumId);
  const archived = submission ? isArchived(submission) : false;
  const canPromote = Boolean(
    submission && detail.photos.length > 0 && !blockedPhotos.length && !promoted && !archived
  );

  return (
    <div
      className="admin-modal-backdrop admin-logjam-detail-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        aria-labelledby="logjam-submission-detail-title"
        aria-modal="true"
        className="admin-logjam-detail"
        role="dialog"
      >
        <header className="admin-logjam-detail__head">
          <div>
            <p className="admin-kicker">Owner review · immutable snapshot</p>
            <h2 id="logjam-submission-detail-title">
              {submission ? `v${submission.version} · ${submission.title}` : "Submission photos"}
            </h2>
            {submission ? (
              <p>
                Source revision {submission.sourceRevision} · submitted{" "}
                <TimestampValue value={submission.submittedAt} />
              </p>
            ) : null}
          </div>
          <button
            aria-label="Close submission review"
            autoFocus
            className="admin-logjam-detail__close"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden />
          </button>
        </header>

        {loading ? <div className="admin-inline-empty" role="status">Loading immutable photo order…</div> : null}
        {error ? (
          <div className="admin-logjam-message admin-logjam-message--error admin-logjam-message--action" role="alert">
            <span>{error}</span>
            <button className="admin-ghost-button" disabled={loading} onClick={onRetry} type="button">
              <RefreshCw aria-hidden />
              Retry photos
            </button>
          </div>
        ) : null}

        {detail ? (
          <>
            <div className="admin-logjam-detail__meta">
              <div>
                <span>Curator</span>
                <strong>{detail.submission.userDisplayName || detail.submission.userEmail}</strong>
                <small>{detail.submission.userEmail}</small>
              </div>
              <div>
                <span>Photos</span>
                <strong>{detail.photos.length}</strong>
                <small>{blockedPhotos.length ? `${blockedPhotos.length} unavailable` : "All promotable"}</small>
              </div>
              <div>
                <span>Submission</span>
                <strong>{promoted ? "promoted" : detail.submission.status}</strong>
                <small>{detail.submission.promotedAlbumStatus ?? "immutable"}</small>
              </div>
            </div>

            {blockedPhotos.length ? (
              <p className="admin-logjam-message admin-logjam-message--error" role="alert">
                Promotion is blocked: {blockedPhotos.length} submitted photo{blockedPhotos.length === 1 ? " is" : "s are"}
                {" "}missing, unpublished, or lacks a public thumb/display asset in the canonical archive. The immutable order remains visible below.
              </p>
            ) : null}

            <div className="admin-logjam-detail__photos" aria-label="Submitted photo order">
              {detail.photos.map((photo) => {
                const previewUrl = photo.thumbUrl ?? photo.displayUrl;
                return (
                  <figure
                    data-available={photo.available && photo.published && previewUrl ? "true" : "false"}
                    key={`${photo.id}:${photo.position}`}
                    style={photo.width && photo.height
                      ? { "--logjam-photo-aspect": `${photo.width} / ${photo.height}` } as React.CSSProperties
                      : undefined}
                  >
                    <div className="admin-logjam-detail__photo">
                      {previewUrl ? (
                        <img alt={photo.title ?? `Submitted photo ${photo.position + 1}`} src={previewUrl} />
                      ) : (
                        <span className="admin-image-placeholder">Unavailable</span>
                      )}
                      <span>{photo.position + 1}</span>
                    </div>
                    <figcaption>
                      <strong>{photo.title ?? photo.id}</strong>
                      <small>{photo.available ? photo.published ? "published source" : "unpublished source" : "missing"}</small>
                    </figcaption>
                  </figure>
                );
              })}
            </div>

            {detail.photos.length ? null : (
              <div className="admin-inline-empty">This immutable submission contains no photos and cannot be promoted.</div>
            )}

            <footer className="admin-logjam-detail__footer">
              {promoted ? (
                <div className="admin-logjam-promoted admin-logjam-promoted--detail">
                  <div>
                    <span>Canonical album</span>
                    <strong>{detail.submission.title}</strong>
                    <small>{detail.submission.promotedAlbumStatus ?? "status unavailable"}</small>
                  </div>
                  <Link className="admin-button" href="/admin/albums" onClick={onClose} prefetch={false}>
                    Open albums <ArrowRight aria-hidden />
                  </Link>
                </div>
              ) : archived ? (
                <p className="admin-muted">Archived submissions stay immutable and cannot be promoted.</p>
              ) : (
                <>
                  <label className="admin-field">
                    <span>Optional canonical title</span>
                    <input
                      maxLength={160}
                      onChange={(event) => onTitleOverrideChange(detail.submission.id, event.target.value)}
                      placeholder={detail.submission.title}
                      value={titleOverride}
                    />
                  </label>
                  <button
                    className="admin-button admin-button--primary"
                    disabled={Boolean(pendingAction) || !canPromote}
                    onClick={() => void onPromote(detail.submission)}
                    type="button"
                  >
                    <FolderUp aria-hidden />
                    {pendingAction === `promote:${detail.submission.id}` ? "Promoting" : "Promote reviewed submission"}
                  </button>
                </>
              )}
            </footer>
          </>
        ) : null}
      </section>
    </div>
  );
}

function LogjamMetric({ icon, label, value }: { icon: React.ReactElement; label: string; value: number }) {
  return (
    <article className="admin-logjam-metric">
      <span aria-hidden>{icon}</span>
      <div>
        <strong>{value}</strong>
        <p>{label}</p>
      </div>
    </article>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Timestamp({ label, value }: { label: string; value: string }) {
  return (
    <span>
      {label} <time dateTime={value}>{formatTimestamp(value)}</time>
    </span>
  );
}

function TimestampValue({ value }: { value: string }) {
  return <time dateTime={value}>{formatTimestamp(value)}</time>;
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : `${timestampFormatter.format(date)} UTC`;
}

function isArchived(submission: LogjamAdminSubmission) {
  return submission.status === "archived" || Boolean(submission.archivedAt);
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "LogJam admin request failed.";
}
