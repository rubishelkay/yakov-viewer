"use client";

import { useMemo, useState } from "react";
import { Images, Link2, Search, Tags } from "lucide-react";

import {
  getEffectivePhotoTagIdsFromArchive,
  getOrderedAlbumsFromArchive,
  getPhotoDisplayUrlFromArchive,
  getPhotoThumbnailUrlFromArchive,
  useAdminArchive
} from "@/admin/admin-state";
import { formatBytes } from "@/admin/repository";
import type { ArchiveStatus } from "@/admin/archive-schema";
import type { LocalArchivePhoto } from "@/admin/admin-state";

const statusFilters: Array<ArchiveStatus | "all"> = ["all", "draft", "review", "published", "hidden"];

export function PhotoLibraryWorkspace() {
  const { actions, archive, previewUrls } = useAdminArchive();
  const albums = getOrderedAlbumsFromArchive(archive);
  const activePhotos = archive.photos
    .filter((photo) => photo.status !== "trash" && photo.status !== "deleted")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.position - b.position);
  const [albumFilter, setAlbumFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<ArchiveStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedPhotoIdState, setSelectedPhotoId] = useState(activePhotos[0]?.id ?? "");
  const [targetAlbumId, setTargetAlbumId] = useState("");
  const albumById = useMemo(() => new Map(albums.map((album) => [album.id, album])), [albums]);
  const tagById = useMemo(() => new Map(archive.tags.map((tag) => [tag.id, tag])), [archive.tags]);
  const normalizedQuery = query.trim().toLowerCase();
  const visiblePhotos = activePhotos.filter((photo) => {
    const album = albumById.get(photo.albumId);
    const tagLabels = getEffectivePhotoTagIdsFromArchive(archive, photo)
      .map((tagId) => tagById.get(tagId)?.label.toLowerCase() ?? "")
      .join(" ");
    const haystack = `${photo.title} ${photo.slug} ${album?.title ?? ""} ${album?.subtitle ?? ""} ${tagLabels}`.toLowerCase();

    return (
      (albumFilter === "all" || photo.albumId === albumFilter) &&
      (statusFilter === "all" || photo.status === statusFilter) &&
      (!normalizedQuery || haystack.includes(normalizedQuery))
    );
  });
  const selectedPhoto = visiblePhotos.find((photo) => photo.id === selectedPhotoIdState)
    ?? activePhotos.find((photo) => photo.id === selectedPhotoIdState)
    ?? visiblePhotos[0]
    ?? activePhotos[0];
  const selectedAlbum = albumById.get(selectedPhoto?.albumId ?? "");
  const selectedCanonicalId = selectedPhoto ? getCanonicalPhotoId(selectedPhoto) : "";
  const targetAlbumAlreadyContains = Boolean(
    selectedPhoto &&
    targetAlbumId &&
    activePhotos.some((photo) =>
      photo.albumId === targetAlbumId && getCanonicalPhotoId(photo) === selectedCanonicalId
    )
  );
  const appearances = selectedPhoto
    ? activePhotos.filter((photo) => getCanonicalPhotoId(photo) === selectedCanonicalId)
    : [];

  function addSelectedToAlbum() {
    if (!selectedPhoto || !targetAlbumId || targetAlbumAlreadyContains) return;
    const linkedPhotoId = actions.addExistingPhotoToAlbum(selectedPhoto.id, targetAlbumId);
    if (linkedPhotoId) setSelectedPhotoId(linkedPhotoId);
  }

  return (
    <div className="admin-column-browser admin-column-browser--photos">
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
            Files stay single. A photo can appear in several albums as a linked record that reuses the same assets.
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
          <Snapshot label="Linked" value={`${activePhotos.filter((photo) => photo.sourcePhotoId).length}`} />
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
            const album = albumById.get(photo.albumId);

            return (
              <button
                className="admin-library-photo"
                data-hidden={photo.status === "hidden" ? "true" : undefined}
                data-linked={photo.sourcePhotoId ? "true" : undefined}
                data-selected={photo.id === selectedPhoto?.id ? "true" : undefined}
                key={photo.id}
                onClick={() => setSelectedPhotoId(photo.id)}
                style={{ "--photo-aspect": getPhotoPreviewAspect(photo) } as React.CSSProperties}
                title={`${photo.title} · ${album?.title ?? "Unknown album"}`}
                type="button"
              >
                <LibraryImage archive={archive} photo={photo} previewUrls={previewUrls} />
                <span>{album?.title ?? "No album"} · {photo.position}</span>
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
                <p>{selectedAlbum?.title ?? "Unknown album"} · {appearances.length} album appearance{appearances.length === 1 ? "" : "s"}</p>
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
                {targetAlbumAlreadyContains ? "Already in album" : "Add linked copy"}
              </button>
            </div>

            <div className="admin-subsection">
              <h4>Appearances</h4>
              <div className="admin-linked-list">
                {appearances.map((photo) => (
                  <button key={photo.id} onClick={() => setSelectedPhotoId(photo.id)} type="button">
                    <span>{albumById.get(photo.albumId)?.title ?? "Unknown album"}</span>
                    <small>{photo.sourcePhotoId ? "linked" : "source"} · #{photo.position}</small>
                  </button>
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

function getCanonicalPhotoId(photo: Pick<LocalArchivePhoto, "id" | "sourcePhotoId">) {
  return photo.sourcePhotoId ?? photo.id;
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
