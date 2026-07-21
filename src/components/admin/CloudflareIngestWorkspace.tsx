"use client";

import {
  Check,
  CircleAlert,
  CloudUpload,
  FileImage,
  FolderPlus,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Upload,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AdminArchive, ArchiveAlbum } from "@/admin/archive-schema";
import { prepareJpegUpload } from "@/admin/browser-image-derivatives";
import {
  CloudflareArchiveApiError,
  createCloudflareAlbum,
  getCloudflareAdminAssetUrl,
  readCloudflareArchive,
  type UploadPhotoResult,
  uploadCloudflareJpeg
} from "@/admin/cloudflare-api-client";
import { formatBytes } from "@/admin/repository";

type QueueStatus = "queued" | "preparing" | "uploading" | "done" | "failed";

type QueueItem = {
  albumId: string;
  displayBytes?: number;
  error?: string;
  file: File;
  id: string;
  previewUrl?: string;
  progress: number;
  result?: UploadPhotoResult;
  status: QueueStatus;
  thumbBytes?: number;
};

const maxSourceBytes = 20 * 1024 * 1024;

export function CloudflareIngestWorkspace() {
  const [archive, setArchive] = useState<AdminArchive>();
  const [archiveError, setArchiveError] = useState<string>();
  const [archiveLoading, setArchiveLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef(new Set<string>());

  const loadArchive = useCallback(async (quiet = false) => {
    if (!quiet) setArchiveLoading(true);
    try {
      const next = await readCloudflareArchive();
      setArchive(next);
      setArchiveError(undefined);
      setSelectedAlbumId((current) => {
        if (current && next.albums.some((album) => album.id === current)) return current;
        return [...next.albums].sort((a, b) => b.sortOrder - a.sortOrder)[0]?.id;
      });
    } catch (error) {
      setArchiveError(apiErrorMessage(error));
    } finally {
      setArchiveLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadArchive(), 0);
    return () => window.clearTimeout(timer);
  }, [loadArchive]);

  useEffect(() => () => {
    for (const url of previewUrlsRef.current) URL.revokeObjectURL(url);
  }, []);

  const albums = useMemo(
    () => [...(archive?.albums ?? [])].sort((a, b) => b.sortOrder - a.sortOrder),
    [archive?.albums]
  );
  const selectedAlbum = albums.find((album) => album.id === selectedAlbumId);
  const selectedPhotoCount = archive?.albumPhotos.filter(
    (albumPhoto) => albumPhoto.albumId === selectedAlbumId
  ).length ?? 0;
  const pendingCount = queue.filter(canUploadItem).length;
  const storedBytes = archive?.assets.reduce((sum, asset) => sum + asset.bytes, 0) ?? 0;
  const storageWarning = storedBytes >= 8 * 1024 * 1024 * 1024;

  async function createAlbum() {
    const title = newTitle.trim();
    if (!title || creating) return;
    setCreating(true);
    try {
      const album = await createCloudflareAlbum({ title, status: "draft" });
      setArchive((current) => current ? { ...current, albums: [...current.albums, album] } : current);
      setSelectedAlbumId(album.id);
      setNewTitle("");
      setArchiveError(undefined);
    } catch (error) {
      setArchiveError(apiErrorMessage(error));
    } finally {
      setCreating(false);
    }
  }

  function addFiles(files: File[]) {
    if (!selectedAlbum || uploading) return;
    const known = new Set(queue.map((item) => fileIdentity(item.file)));
    const next = files.flatMap<QueueItem>((file) => {
      const identity = fileIdentity(file);
      if (known.has(identity)) return [];
      known.add(identity);
      const invalid = file.type !== "image/jpeg"
        ? "Only JPEG files are supported."
        : !file.size || file.size > maxSourceBytes
          ? "Source JPEG must be between 1 byte and 20 MiB."
          : undefined;
      return [{
        albumId: selectedAlbum.id,
        error: invalid,
        file,
        id: crypto.randomUUID(),
        progress: invalid ? 0 : 5,
        status: invalid ? "failed" : "queued"
      }];
    });
    setQueue((current) => [...current, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function updateQueue(id: string, update: Partial<QueueItem>) {
    setQueue((current) => current.map((item) => item.id === id ? { ...item, ...update } : item));
  }

  async function uploadPending() {
    if (!pendingCount || uploading) return;
    setUploading(true);
    const pending = queue.filter(canUploadItem);

    for (const item of pending) {
      if (item.file.type !== "image/jpeg" || !item.file.size || item.file.size > maxSourceBytes) continue;
      try {
        updateQueue(item.id, { error: undefined, progress: 15, status: "preparing" });
        const prepared = await prepareJpegUpload(item.file);
        const oldPreview = item.previewUrl;
        if (oldPreview) {
          URL.revokeObjectURL(oldPreview);
          previewUrlsRef.current.delete(oldPreview);
        }
        const previewUrl = URL.createObjectURL(prepared.thumb.blob);
        previewUrlsRef.current.add(previewUrl);
        updateQueue(item.id, {
          displayBytes: prepared.display.blob.size,
          previewUrl,
          progress: 45,
          status: "uploading",
          thumbBytes: prepared.thumb.blob.size
        });
        const result = await uploadCloudflareJpeg(item.albumId, {
          clientUploadId: item.id,
          display: prepared.display,
          file: item.file,
          height: prepared.height,
          thumb: prepared.thumb,
          width: prepared.width
        });
        updateQueue(item.id, { progress: 100, result, status: "done" });
      } catch (error) {
        updateQueue(item.id, { error: apiErrorMessage(error), progress: 0, status: "failed" });
      }
    }

    await loadArchive(true);
    setUploading(false);
  }

  function removeQueueItem(id: string) {
    setQueue((current) => {
      const item = current.find((entry) => entry.id === id);
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
        previewUrlsRef.current.delete(item.previewUrl);
      }
      return current.filter((entry) => entry.id !== id);
    });
  }

  function clearCompleted() {
    setQueue((current) => {
      for (const item of current) {
        if (item.status === "done" && item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
          previewUrlsRef.current.delete(item.previewUrl);
        }
      }
      return current.filter((item) => item.status !== "done");
    });
  }

  return (
    <main className="admin-ingest">
      <section className="admin-ingest__pane admin-ingest__albums">
        <PaneHeading eyebrow="Cloudflare archive" title="Cloud upload" />
        <div className="admin-cloud-state" data-error={archiveError ? "true" : undefined}>
          {archiveLoading ? <LoaderCircle className="is-spinning" aria-hidden /> : archiveError ? <CircleAlert aria-hidden /> : <Check aria-hidden />}
          <span>{archiveLoading ? "Connecting to D1" : archiveError ?? "Connected to D1 + R2"}</span>
          <button aria-label="Refresh Cloudflare archive" disabled={archiveLoading} onClick={() => void loadArchive()} type="button">
            <RefreshCw aria-hidden />
          </button>
        </div>

        <div className="admin-ingest__create">
          <label className="admin-field">
            <span>New draft album</span>
            <div className="admin-ingest__create-row">
              <input
                onChange={(event) => setNewTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void createAlbum();
                }}
                placeholder="Album title"
                value={newTitle}
              />
              <button aria-label="Create Cloudflare album" className="admin-button" disabled={!newTitle.trim() || creating || Boolean(archiveError)} onClick={() => void createAlbum()} type="button">
                {creating ? <LoaderCircle className="is-spinning" aria-hidden /> : <FolderPlus aria-hidden />}
              </button>
            </div>
          </label>
        </div>

        <div className="admin-ingest__album-list">
          {albums.map((album) => (
            <button
              className="admin-ingest__album-row"
              data-selected={album.id === selectedAlbumId ? "true" : undefined}
              key={album.id}
              onClick={() => {
                if (!uploading) setSelectedAlbumId(album.id);
              }}
              type="button"
            >
              <span>{album.title}</span>
              <small>{photoCount(album, archive)} photos · {album.status}</small>
            </button>
          ))}
          {!archiveLoading && !albums.length ? <p className="admin-inline-empty">No Cloudflare albums yet.</p> : null}
        </div>
      </section>

      <section className="admin-ingest__pane admin-ingest__source">
        <PaneHeading eyebrow="Selected album" title={selectedAlbum?.title ?? "Choose an album"} />
        {selectedAlbum ? (
          <>
            <dl className="admin-ingest__facts">
              <div><dt>Status</dt><dd>{selectedAlbum.status}</dd></div>
              <div><dt>Stored photos</dt><dd>{selectedPhotoCount}</dd></div>
              <div><dt>Next position</dt><dd>{selectedPhotoCount + 1}</dd></div>
              <div><dt>Archive storage</dt><dd>{formatBytes(storedBytes)}</dd></div>
            </dl>
            {storageWarning ? (
              <p className="admin-ingest__storage-warning"><CircleAlert aria-hidden />Archive storage is above the 8 GiB working budget. Review R2 billing before a large upload.</p>
            ) : null}
            <div
              className="admin-ingest__drop"
              data-disabled={uploading ? "true" : undefined}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                addFiles(Array.from(event.dataTransfer.files));
              }}
            >
              <CloudUpload aria-hidden />
              <strong>Drop JPEGs</strong>
              <span>File order becomes album order. Source limit: 20 MiB.</span>
              <button className="admin-button" disabled={uploading} onClick={() => fileInputRef.current?.click()} type="button">
                <FileImage aria-hidden />
                Select JPEGs
              </button>
              <input
                accept="image/jpeg,.jpg,.jpeg"
                hidden
                multiple
                onChange={(event) => addFiles(Array.from(event.target.files ?? []))}
                ref={fileInputRef}
                type="file"
              />
            </div>
            <div className="admin-ingest__pipeline">
              <span>thumb <b>≤ 300 KB</b></span>
              <span>display <b>≈ 1 MB</b></span>
              <span>source <b>unchanged · private</b></span>
            </div>
            <button className="admin-button admin-button--primary admin-button--full" disabled={!pendingCount || uploading} onClick={() => void uploadPending()} type="button">
              {uploading ? <LoaderCircle className="is-spinning" aria-hidden /> : <Upload aria-hidden />}
              {uploading ? "Uploading sequentially" : `Upload ${pendingCount || ""} JPEG${pendingCount === 1 ? "" : "s"}`}
            </button>
            <p className="admin-ingest__note">Albums stay draft. Publishing, tags, covers, sets, and deletion move to Cloudflare in the next mutation pass.</p>
          </>
        ) : (
          <p className="admin-inline-empty">Create or select a Cloudflare album before choosing files.</p>
        )}
      </section>

      <section className="admin-ingest__pane admin-ingest__queue">
        <div className="admin-ingest__queue-head">
          <PaneHeading eyebrow="Current browser session" title={`Upload queue${queue.length ? ` · ${queue.length}` : ""}`} />
          {queue.some((item) => item.status === "done") ? (
            <button className="admin-ghost-button" disabled={uploading} onClick={clearCompleted} type="button">
              <RotateCcw aria-hidden />
              Clear completed
            </button>
          ) : null}
        </div>
        <div className="admin-ingest__queue-grid">
          {queue.map((item, index) => {
            const savedPreview = item.result?.assets.find((asset) => asset.version === "thumb");
            const preview = item.previewUrl ?? (savedPreview ? getCloudflareAdminAssetUrl(savedPreview.id) : undefined);
            return (
              <article className="admin-ingest__queue-item" data-status={item.status} key={item.id}>
                <div className="admin-ingest__queue-preview">
                  {preview ? <img alt="" src={preview} /> : <FileImage aria-hidden />}
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </div>
                <div className="admin-ingest__queue-copy">
                  <strong title={item.file.name}>{item.file.name}</strong>
                  <small>{albums.find((album) => album.id === item.albumId)?.title ?? "Album"} · {formatBytes(item.file.size)} · source retained · {statusLabel(item.status)}</small>
                  {item.thumbBytes && item.displayBytes ? (
                    <small>thumb {formatBytes(item.thumbBytes)} · display {formatBytes(item.displayBytes)}</small>
                  ) : null}
                  {item.error ? <p>{item.error}</p> : null}
                  <span className="admin-ingest__progress"><i style={{ width: `${item.progress}%` }} /></span>
                </div>
                {item.status === "queued" || item.status === "failed" ? (
                  <button aria-label={`Remove ${item.file.name}`} disabled={uploading} onClick={() => removeQueueItem(item.id)} type="button">
                    <X aria-hidden />
                  </button>
                ) : item.status === "done" ? <Check aria-label="Saved in Cloudflare" /> : <LoaderCircle className="is-spinning" aria-label={statusLabel(item.status)} />}
              </article>
            );
          })}
          {!queue.length ? <div className="admin-empty-state"><span>Selected JPEGs will appear here.</span></div> : null}
        </div>
      </section>
    </main>
  );
}

function PaneHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className="admin-ingest__heading">
      <p className="admin-kicker">{eyebrow}</p>
      <h1>{title}</h1>
    </header>
  );
}

function photoCount(album: ArchiveAlbum, archive: AdminArchive | undefined) {
  return archive?.albumPhotos.filter((albumPhoto) => albumPhoto.albumId === album.id).length ?? 0;
}

function fileIdentity(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function canUploadItem(item: QueueItem) {
  return (item.status === "queued" || item.status === "failed")
    && item.file.type === "image/jpeg"
    && item.file.size > 0
    && item.file.size <= maxSourceBytes;
}

function statusLabel(status: QueueStatus) {
  return {
    queued: "Queued",
    preparing: "Preparing web JPEGs",
    uploading: "Writing D1 + R2",
    done: "Saved in Cloudflare",
    failed: "Needs attention"
  }[status];
}

function apiErrorMessage(error: unknown) {
  if (error instanceof CloudflareArchiveApiError) return error.message;
  return error instanceof Error ? error.message : "Cloudflare request failed.";
}
