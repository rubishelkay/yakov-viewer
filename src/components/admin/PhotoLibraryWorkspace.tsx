"use client";

import { useMemo, useState } from "react";
import { CircleX, Images, Link2, Search, Tags } from "lucide-react";

import {
  formatBytes,
  getAlbumPhotosForPhotoFromArchive,
  getEffectivePhotoTagIdsFromArchive,
  getOrderedAlbumsFromArchive,
  getPhotoDisplayUrlFromArchive,
  getPhotoThumbnailUrlFromArchive,
  useAdminArchive
} from "@/admin/cloud-admin-state";
import { AdminDemoBadge } from "@/components/admin/AdminDemoBadge";
import { useAdminConfirmDialog } from "@/components/admin/AdminConfirmDialog";
import type { ArchiveStatus } from "@/admin/archive-schema";
import type { LocalArchivePhoto } from "@/admin/cloud-admin-state";

const statusFilters: Array<ArchiveStatus | "all"> = ["all", "draft", "review", "published", "hidden"];

export function PhotoLibraryWorkspace() {
  const { actions, archive, previewUrls } = useAdminArchive();
  const { confirm, dialog } = useAdminConfirmDialog();
  const albums = getOrderedAlbumsFromArchive(archive);
  const albumOrderById = new Map(albums.map((album, index) => [album.id, index]));
  const photoOrderById = new Map<string, number>();
  for (const membership of archive.albumPhotos) {
    const albumOrder = albumOrderById.get(membership.albumId) ?? Number.MAX_SAFE_INTEGER;
    const currentOrder = photoOrderById.get(membership.photoId) ?? Number.MAX_SAFE_INTEGER;
    photoOrderById.set(membership.photoId, Math.min(currentOrder, albumOrder));
  }
  const activePhotos = archive.photos
    .filter((photo) => photo.status !== "trash" && photo.status !== "deleted")
    .sort((a, b) =>
      (photoOrderById.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (photoOrderById.get(b.id) ?? Number.MAX_SAFE_INTEGER) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.slug.localeCompare(b.slug)
    );
  const [albumFilter, setAlbumFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<ArchiveStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedPhotoIdState, setSelectedPhotoId] = useState(activePhotos[0]?.id ?? "");
  const [targetAlbumId, setTargetAlbumId] = useState("");
  const albumById = useMemo(() => new Map(albums.map((album) => [album.id, album])), [albums]);
  const tagById = useMemo(() => new Map(archive.tags.map((tag) => [tag.id, tag])), [archive.tags]);
  const normalizedQuery = query.trim().toLowerCase();
  const visiblePhotos = activePhotos.filter((photo) => {
    const appearances = getAlbumPhotosForPhotoFromArchive(archive, photo.id);
    const photoAlbums = appearances
      .map((appearance) => albumById.get(appearance.albumId))
      .filter((album): album is NonNullable<typeof album> => Boolean(album));
    const tagLabels = getEffectivePhotoTagIdsFromArchive(archive, photo)
      .map((tagId) => tagById.get(tagId)?.label.toLowerCase() ?? "")
      .join(" ");
    const albumLabels = photoAlbums
      .map((album) => `${album.title} ${album.subtitle}`)
      .join(" ");
    const haystack = `${photo.title} ${photo.slug} ${albumLabels} ${tagLabels}`.toLowerCase();

    return (
      (albumFilter === "all" || appearances.some((appearance) => appearance.albumId === albumFilter)) &&
      (statusFilter === "all" || photo.status === statusFilter) &&
      (!normalizedQuery || haystack.includes(normalizedQuery))
    );
  });
  const selectedPhoto = visiblePhotos.find((photo) => photo.id === selectedPhotoIdState)
    ?? activePhotos.find((photo) => photo.id === selectedPhotoIdState)
    ?? visiblePhotos[0]
    ?? activePhotos[0];
  const appearances = selectedPhoto
    ? getAlbumPhotosForPhotoFromArchive(archive, selectedPhoto.id)
    : [];
  const selectedAlbum = albumById.get(appearances[0]?.albumId ?? "");
  const targetAlbumAlreadyContains = Boolean(
    selectedPhoto &&
    targetAlbumId &&
    appearances.some((appearance) => appearance.albumId === targetAlbumId)
  );

  async function addSelectedToAlbum() {
    if (!selectedPhoto || !targetAlbumId || targetAlbumAlreadyContains) return;
    const linkedPhotoId = await actions.addExistingPhotoToAlbum(selectedPhoto.id, targetAlbumId);
    if (linkedPhotoId) setSelectedPhotoId(linkedPhotoId);
  }

  async function removeAppearance(albumId: string) {
    if (!selectedPhoto || appearances.length <= 1) return;
    const album = albumById.get(albumId);
    const confirmed = await confirm({
      confirmLabel: "Remove from album",
      message: `Remove "${selectedPhoto.title}" from "${album?.title ?? "this album"}"? Its file and other album appearances remain unchanged.`,
      title: "Remove linked photo"
    });
    if (confirmed) await actions.removePhotoFromAlbum(albumId, selectedPhoto.id);
  }

  return (
    <div className="admin-column-browser admin-column-browser--photos">
      {dialog}
      <section className="admin-column admin-column--list" aria-label="Photo filters">
        <div className="admin-column-head">
          <div>
            <p className="admin-kicker">Library</p>
            <h1>Photos</h1>
          </div>
          <span className="admin-count">{activePhotos.length}</span>
        </div>

        <div className="admin-library-note">
          <Images aria-hidden />
          <p>
            Files stay single. Album memberships reuse the same photo and assets.
          </p>
        </div>

        <div className="admin-form-stack">
          <label className="admin-field">
            <span>Search</span>
            <div className="admin-search-field">
              <Search aria-hidden />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, album, tag" />
            </div>
          </label>
          <label className="admin-field">
            <span>Album</span>
            <select value={albumFilter} onChange={(event) => setAlbumFilter(event.target.value)}>
              <option value="all">All albums</option>
              {albums.map((album) => (
                <option key={album.id} value={album.id}>{album.title}</option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ArchiveStatus | "all")}>
              {statusFilters.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
        </div>

        <div className="admin-column-stat-grid admin-column-stat-grid--two">
          <Snapshot label="Visible" value={`${visiblePhotos.length}`} />
          <Snapshot
            label="Multi-album"
            value={`${activePhotos.filter((photo) => getAlbumPhotosForPhotoFromArchive(archive, photo.id).length > 1).length}`}
          />
        </div>
      </section>

      <section className="admin-column admin-column--content admin-column--photo-library" aria-label="All photos">
        <div className="admin-column-head admin-column-head--tight">
          <div>
            <p className="admin-kicker">All photos</p>
            <h2>Contact sheet</h2>
            <p>Filter, select, then add the same image to another album without copying the file.</p>
          </div>
        </div>

        <div className="admin-library-grid">
          {visiblePhotos.map((photo) => {
            const appearances = getAlbumPhotosForPhotoFromArchive(archive, photo.id);
            const primaryAppearance = appearances[0];
            const album = albumById.get(primaryAppearance?.albumId ?? "");
            const isDemo = appearances.some((appearance) => albumById.get(appearance.albumId)?.isDemo);

            return (
              <button
                className="admin-library-photo"
                data-hidden={photo.status === "hidden" ? "true" : undefined}
                data-linked={appearances.length > 1 ? "true" : undefined}
                data-selected={photo.id === selectedPhoto?.id ? "true" : undefined}
                key={photo.id}
                onClick={() => setSelectedPhotoId(photo.id)}
                style={{ "--photo-aspect": getPhotoPreviewAspect(photo) } as React.CSSProperties}
                title={`${photo.title} · ${album?.title ?? "Unknown album"}`}
                type="button"
              >
                <LibraryImage archive={archive} photo={photo} previewUrls={previewUrls} />
                <span className="admin-library-photo__meta">
                  <span>{album?.title ?? "No album"}{primaryAppearance ? ` · ${primaryAppearance.position}` : ""}</span>
                  {appearances.length > 1 ? <span className="admin-linked-badge">{appearances.length} albums</span> : null}
                  {isDemo ? <AdminDemoBadge /> : null}
                </span>
              </button>
            );
          })}
          {!visiblePhotos.length ? <div className="admin-inline-empty admin-inline-empty--wide">No photos match this filter.</div> : null}
        </div>
      </section>

      <section className="admin-column admin-column--inspector admin-photo-inspector" aria-label="Photo inspector">
        {selectedPhoto ? (
          <>
            <div className="admin-column-head admin-column-head--tight">
              <div>
                <p className="admin-kicker">Selected photo</p>
                <h2>{selectedPhoto.title}</h2>
                <p>
                  {selectedAlbum?.title ?? "Unknown album"} · {appearances.length} album appearance{appearances.length === 1 ? "" : "s"}
                  {selectedAlbum?.isDemo ? " · demo" : ""}
                </p>
              </div>
              <Tags aria-hidden className="admin-section-icon" />
            </div>

            <div className="admin-photo-inspector__preview">
              <LibraryImage archive={archive} mode="display" photo={selectedPhoto} previewUrls={previewUrls} />
            </div>

            <div className="admin-form-stack">
              <label className="admin-field">
                <span>Add to album</span>
                <select value={targetAlbumId} onChange={(event) => setTargetAlbumId(event.target.value)}>
                  <option value="">Choose target album</option>
                  {albums.map((album) => (
                    <option key={album.id} value={album.id}>{album.title}</option>
                  ))}
                </select>
              </label>
              <button
                className="admin-button admin-button--full"
                disabled={!targetAlbumId || targetAlbumAlreadyContains}
                onClick={addSelectedToAlbum}
                title={targetAlbumAlreadyContains ? "This photo is already in the selected album." : undefined}
                type="button"
              >
                <Link2 aria-hidden />
                {targetAlbumAlreadyContains ? "Already in album" : "Add to album"}
              </button>
            </div>

            <div className="admin-subsection">
              <h4>Appearances</h4>
              <div className="admin-linked-list">
                {appearances.map((appearance) => (
                  <div className="admin-linked-list__row" key={`${appearance.albumId}:${appearance.photoId}`}>
                    <span>
                      <strong>{albumById.get(appearance.albumId)?.title ?? "Unknown album"}</strong>
                      <small>membership · #{appearance.position}</small>
                    </span>
                    <button
                      aria-label={`Remove from ${albumById.get(appearance.albumId)?.title ?? "album"}`}
                      disabled={appearances.length <= 1}
                      onClick={() => void removeAppearance(appearance.albumId)}
                      title={appearances.length <= 1 ? "A photo must remain in at least one album." : "Remove this album membership"}
                      type="button"
                    >
                      <CircleX aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-subsection">
              <h4>Effective tags</h4>
              <div className="admin-tag-row admin-tag-row--flat">
                {getEffectivePhotoTagIdsFromArchive(archive, selectedPhoto).map((tagId) => (
                  <span key={tagId}>{tagById.get(tagId)?.label ?? tagId}</span>
                ))}
              </div>
            </div>

            <div className="admin-subsection">
              <h4>File</h4>
              <div className="admin-technical-list">
                <span>{selectedPhoto.sourceFileName ?? `${selectedPhoto.slug}.jpg`}</span>
                <span>{selectedPhoto.width}x{selectedPhoto.height}</span>
                <span>{formatBytes(selectedPhoto.sourceBytes ?? assetBytes(selectedPhoto, archive.assets))}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="admin-empty-state">Select a photo to inspect or link it.</div>
        )}
      </section>
    </div>
  );
}

function Snapshot({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getPhotoPreviewAspect(photo: LocalArchivePhoto) {
  return photo.height > photo.width ? "2 / 3" : "3 / 2";
}

function LibraryImage({
  archive,
  mode = "thumb",
  photo,
  previewUrls
}: {
  archive: ReturnType<typeof useAdminArchive>["archive"];
  mode?: "display" | "thumb";
  photo: LocalArchivePhoto;
  previewUrls: Record<string, string>;
}) {
  const imageUrl = mode === "display"
    ? getPhotoDisplayUrlFromArchive(archive, previewUrls, photo)
    : getPhotoThumbnailUrlFromArchive(archive, previewUrls, photo);

  return imageUrl ? <img alt="" src={imageUrl} /> : <span className="admin-image-placeholder" aria-hidden />;
}

function assetBytes(photo: LocalArchivePhoto, assets: ReturnType<typeof useAdminArchive>["archive"]["assets"]) {
  return assets
    .filter((asset) => photo.assetIds.includes(asset.id))
    .reduce((sum, asset) => sum + asset.bytes, 0);
}
