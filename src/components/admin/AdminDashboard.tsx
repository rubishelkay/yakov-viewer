"use client";

import Link from "next/link";
import {
  ArrowRight,
  CircleAlert,
  Cloud,
  Eye,
  HardDrive,
  RotateCcw,
  UploadCloud
} from "lucide-react";

import {
  getAlbumCoverPreviewUrlFromArchive,
  getDashboardSnapshotFromArchive,
  getOrderedAlbumsFromArchive,
  getPhotoThumbnailUrlFromArchive,
  useAdminArchive
} from "@/admin/admin-state";
import { formatBytes } from "@/admin/repository";
import { useAdminConfirmDialog } from "@/components/admin/AdminConfirmDialog";
import type { LocalArchiveAlbum, LocalArchivePhoto } from "@/admin/admin-state";

export function AdminDashboard() {
  const { actions, archive, hydrated, previewUrls } = useAdminArchive();
  const { confirm, dialog } = useAdminConfirmDialog();
  const snapshot = getDashboardSnapshotFromArchive(archive);
  const latestAlbums = getOrderedAlbumsFromArchive(archive).slice(0, 5);
  const draftAlbums = getOrderedAlbumsFromArchive(archive).filter((album) => album.status === "draft");

  async function resetLocalArchive() {
    const confirmed = await confirm({
      confirmLabel: "Reset archive",
      message: "Reset localStorage and local preview blobs back to the seed archive?",
      title: "Reset local archive",
      tone: "danger"
    });

    if (confirmed) await actions.resetLocalArchive();
  }

  return (
    <div className="admin-page admin-page--dashboard">
      {dialog}
      <header className="admin-page__header">
        <div>
          <p className="admin-kicker">Private archive workspace</p>
          <h1>Dashboard</h1>
          <p>
            Upload, review, publish, and clean up the archive before the public portfolio
            starts reading live Cloudflare data.
          </p>
        </div>
        <div className="admin-header-actions">
          <button className="admin-ghost-button" onClick={() => void resetLocalArchive()} type="button">
            <RotateCcw aria-hidden />
            Reset local
          </button>
          <Link className="admin-button admin-button--primary" href="/admin/albums">
            <UploadCloud aria-hidden />
            New upload
          </Link>
        </div>
      </header>

      <section className="admin-metric-grid" aria-label="Archive snapshot">
        <MetricCard label="Today" value={`${snapshot.analytics.visitsToday}`} detail="Local analytics waits for Cloudflare" icon={<Eye />} />
        <MetricCard label="7 days" value={`${snapshot.analytics.visitsSevenDays}`} detail={hydrated ? "Local state loaded" : "Loading local state"} icon={<Cloud />} />
        <MetricCard label="Review photos" value={`${snapshot.reviewPhotos}`} detail={`${draftAlbums.length} draft albums`} icon={<CircleAlert />} />
        <MetricCard
          label="Storage"
          value={formatBytes(snapshot.storage.totalBytes)}
          detail={`${formatBytes(snapshot.storage.privateBytes)} private`}
          icon={<HardDrive />}
        />
      </section>

      <div className="admin-dashboard-layout">
        <section className="admin-panel">
          <div className="admin-panel__head">
            <div>
              <p className="admin-kicker">Work in progress</p>
              <h2>Processing queue</h2>
            </div>
            <span className="admin-count">{snapshot.processingJobs.length}</span>
          </div>

          <div className="admin-upload-list">
            {snapshot.processingJobs.length ? (
              snapshot.processingJobs.map((job) => (
                <div className="admin-upload-row" key={job.id}>
                  <div className="admin-progress-ring" style={{ "--progress-angle": `${job.progress * 3.6}deg` } as React.CSSProperties}>
                    <span>{job.progress}</span>
                  </div>
                  <div>
                    <strong>{job.fileName}</strong>
                    <p>{job.status} · {formatBytes(job.bytes)}</p>
                  </div>
                  <div className="admin-derivatives" aria-label="Derivative states">
                    {job.derivatives.map((derivative) => (
                      <span data-state={derivative.status} key={`${job.id}-${derivative.version}`}>
                        {derivative.version}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="admin-inline-empty">No active processing jobs. New uploads will appear here.</div>
            )}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel__head">
            <div>
              <p className="admin-kicker">Popular</p>
              <h2>Photo attention</h2>
            </div>
            <span className="admin-muted">local preview</span>
          </div>

          <div className="admin-photo-strip">
            {snapshot.popularPhotos.map((photo) => (
              <PopularPhoto archive={archive} photo={photo} previewUrls={previewUrls} key={photo.id} />
            ))}
          </div>
        </section>

        <section className="admin-panel admin-panel--wide">
          <div className="admin-panel__head">
            <div>
              <p className="admin-kicker">Recent albums</p>
              <h2>Ready to organize</h2>
            </div>
            <Link className="admin-inline-link" href="/admin/sets">
              Open sets <ArrowRight aria-hidden />
            </Link>
          </div>

          <div className="admin-table">
            {latestAlbums.map((album) => (
              <AlbumRow album={album} key={album.id} />
            ))}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel__head">
            <div>
              <p className="admin-kicker">Bin</p>
              <h2>Cleanup reminder</h2>
            </div>
            <span className="admin-count">{snapshot.trashItems.length}</span>
          </div>
          <p className="admin-panel__copy">
            Deleted records stay recoverable. Permanent purge is a separate action and will
            later remove R2 files from Cloudflare.
          </p>
          <Link className="admin-inline-link admin-inline-link--spaced" href="/admin/bin">
            Open bin <ArrowRight aria-hidden />
          </Link>
        </section>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactElement;
}) {
  return (
    <article className="admin-metric">
      <div className="admin-metric__icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function AlbumRow({ album }: { album: LocalArchiveAlbum }) {
  const { archive, previewUrls } = useAdminArchive();
  const setCount = archive.sets.filter((set) =>
    set.albumIdsWithOrder.some((albumRef) => albumRef.albumId === album.id)
  ).length;

  return (
    <div className="admin-table__row">
      <CoverImage url={getAlbumCoverPreviewUrlFromArchive(archive, previewUrls, album)} />
      <div>
        <strong>{album.title}</strong>
        <span>{album.subtitle || "No subtitle"}</span>
      </div>
      <span className="admin-status" data-status={album.status}>{album.status}</span>
      <span>{setCount || "No"} sets</span>
    </div>
  );
}

function PopularPhoto({
  archive,
  photo,
  previewUrls
}: {
  archive: ReturnType<typeof useAdminArchive>["archive"];
  photo: LocalArchivePhoto;
  previewUrls: Record<string, string>;
}) {
  return (
    <figure>
      <CoverImage url={getPhotoThumbnailUrlFromArchive(archive, previewUrls, photo)} />
      <figcaption>{photo.title}</figcaption>
    </figure>
  );
}

function CoverImage({ url }: { url: string | undefined }) {
  return url ? <img alt="" src={url} /> : <span className="admin-image-placeholder" aria-hidden />;
}
