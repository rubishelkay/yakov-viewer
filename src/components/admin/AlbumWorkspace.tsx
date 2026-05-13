"use client";

import { useId, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CircleX,
  Eye,
  EyeOff,
  FolderPlus,
  GripVertical,
  ImagePlus,
  Square,
  Tags,
  UploadCloud
} from "lucide-react";

import {
  getAlbumCoverPreviewUrlFromArchive,
  getEffectivePhotoTagIdsFromArchive,
  getOrderedAlbumsFromArchive,
  getOrderedSetsFromArchive,
  getPhotoDisplayUrlFromArchive,
  getPhotoThumbnailUrlFromArchive,
  getPhotosForAlbumFromArchive,
  useAdminArchive
} from "@/admin/admin-state";
import { formatBytes } from "@/admin/repository";
import { useAdminConfirmDialog } from "@/components/admin/AdminConfirmDialog";
import type {
  ArchiveStatus,
  PublicDownloadPolicy
} from "@/admin/archive-schema";
import type { LocalArchiveAlbum, LocalArchivePhoto, LocalArchiveTag } from "@/admin/admin-state";

const editableStatuses: ArchiveStatus[] = ["draft", "review", "published", "hidden"];
const downloadPolicies: PublicDownloadPolicy[] = ["inherit", "none", "expanded", "downloadJpeg"];

export function AlbumWorkspace() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const draggingAlbumIdRef = useRef("");
  const draggingPhotoIdRef = useRef("");
  const { actions, archive, previewUrls } = useAdminArchive();
  const { confirm, dialog } = useAdminConfirmDialog();
  const albums = getOrderedAlbumsFromArchive(archive);
  const sets = getOrderedSetsFromArchive(archive);
  const [selectedAlbumIdState, setSelectedAlbumId] = useState(albums[0]?.id ?? "");
  const [selectedPhotoId, setSelectedPhotoId] = useState("");
  const [newAlbumTitle, setNewAlbumTitle] = useState("");
  const [albumTagInput, setAlbumTagInput] = useState("");
  const [photoTagInput, setPhotoTagInput] = useState("");
  const [draggingAlbumId, setDraggingAlbumId] = useState("");
  const [dropTargetAlbumId, setDropTargetAlbumId] = useState("");
  const [draggingPhotoId, setDraggingPhotoId] = useState("");
  const [dropTargetPhotoId, setDropTargetPhotoId] = useState("");
  const [isSetPickerOpen, setIsSetPickerOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const selectedAlbumId = albums.some((album) => album.id === selectedAlbumIdState)
    ? selectedAlbumIdState
    : (albums[0]?.id ?? "");
  const selectedAlbum = albums.find((album) => album.id === selectedAlbumId) ?? albums[0];
  const selectedPhotos = getPhotosForAlbumFromArchive(archive, selectedAlbum?.id);
  const selectedPhoto = selectedPhotos.find((photo) => photo.id === selectedPhotoId) ?? selectedPhotos[0];
  const selectedPhotoIndex = selectedPhoto
    ? selectedPhotos.findIndex((photo) => photo.id === selectedPhoto.id)
    : -1;
  const selectedJobs = archive.uploadJobs.filter((job) => job.albumId === selectedAlbum?.id);
  const selectedTags = selectedAlbum
    ? selectedAlbum.tagIds
        .map((tagId) => archive.tags.find((tag) => tag.id === tagId))
        .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag))
    : [];
  const selectedAlbumSetIds = new Set(
    selectedAlbum
      ? sets
          .filter((set) => set.albumIdsWithOrder.some((ref) => ref.albumId === selectedAlbum.id))
          .map((set) => set.id)
      : []
  );
  const selectedAlbumSets = sets.filter((set) => selectedAlbumSetIds.has(set.id));

  function selectAlbum(albumId: string) {
    setSelectedAlbumId(albumId);
    setSelectedPhotoId("");
    setIsSetPickerOpen(false);
  }

  function createAlbum() {
    const trimmedTitle = newAlbumTitle.trim();
    if (!trimmedTitle) return;

    const albumId = actions.createAlbum({ title: trimmedTitle });
    selectAlbum(albumId);
    setNewAlbumTitle("");
  }

  async function queueFiles(fileList: FileList | File[]) {
    if (!selectedAlbum) return;
    const files = Array.from(fileList).filter((file) =>
      file.type === "image/jpeg" || file.name.toLowerCase().endsWith(".jpg") || file.name.toLowerCase().endsWith(".jpeg")
    );
    if (!files.length) return;

    setIsUploading(true);
    await actions.addPhotosToAlbum(selectedAlbum.id, files);
    setIsUploading(false);
  }

  async function resolveTagId(label: string) {
    const normalizedLabel = label.trim();
    if (!normalizedLabel) return "";

    const existingTag = archive.tags.find((tag) =>
      tag.label.toLowerCase() === normalizedLabel.toLowerCase() ||
      tag.slug === normalizedLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
    );
    if (existingTag) return existingTag.id;

    const shouldCreate = await confirm({
      confirmLabel: "Create tag",
      message: `"${normalizedLabel}" is not in the shared dictionary yet. Create it now?`,
      title: "Create new tag"
    });

    return shouldCreate ? actions.createTag({ label: normalizedLabel, scope: "both" }) : "";
  }

  async function attachPhotoTagFromInput(label = photoTagInput) {
    if (!selectedPhoto) return;
    const tagId = await resolveTagId(label);

    if (tagId && !selectedPhoto.tagIds.includes(tagId)) {
      actions.updatePhoto(selectedPhoto.id, { tagIds: [...selectedPhoto.tagIds, tagId] });
      setPhotoTagInput("");
    }
  }

  async function trashAlbum(album: LocalArchiveAlbum) {
    const confirmed = await confirm({
      confirmLabel: "Delete album",
      message: `Move "${album.title}" and its photos to the Bin? You can restore it before purge.`,
      title: "Delete album",
      tone: "danger"
    });

    if (confirmed) actions.trashAlbum(album.id);
  }

  async function trashPhoto(photo: LocalArchivePhoto) {
    const confirmed = await confirm({
      confirmLabel: "Delete image",
      message: `Move "${photo.title}" to the Bin? It will disappear from this album until restored.`,
      title: "Delete image",
      tone: "danger"
    });

    if (confirmed) actions.trashPhoto(photo.id);
  }

  function moveAlbumToDropTarget(albumId: string, targetAlbumId: string) {
    const currentIndex = albums.findIndex((album) => album.id === albumId);
    const targetIndex = albums.findIndex((album) => album.id === targetAlbumId);

    if (currentIndex < 0 || targetIndex < 0 || currentIndex === targetIndex) return;

    const direction = currentIndex < targetIndex ? "down" : "up";
    for (let step = 0; step < Math.abs(targetIndex - currentIndex); step += 1) {
      actions.reorderAlbum(albumId, direction);
    }
  }

  return (
    <div className="admin-column-browser admin-column-browser--albums">
      {dialog}
      <section className="admin-column admin-column--list" aria-label="Albums">
        <div className="admin-column-head">
          <div>
            <p className="admin-kicker">Archive folders</p>
            <h1>Albums</h1>
          </div>
          <span className="admin-count">{albums.length}</span>
        </div>

        <div className="admin-create-card admin-create-card--compact">
          <label>
            <span>New album</span>
            <input
              aria-label="New album title"
              onChange={(event) => setNewAlbumTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") createAlbum();
              }}
              placeholder="Album title"
              value={newAlbumTitle}
            />
          </label>
          <button className="admin-button" onClick={createAlbum} type="button">
            <FolderPlus aria-hidden />
            Create
          </button>
        </div>

        <div className="admin-list admin-list--table">
          {albums.map((album) => (
            <div
              className="admin-list-row"
              data-active={album.id === selectedAlbum?.id ? "true" : undefined}
              data-drag-target={dropTargetAlbumId === album.id && draggingAlbumId !== album.id ? "true" : undefined}
              data-dragging={draggingAlbumId === album.id ? "true" : undefined}
              key={album.id}
              onDragEnd={() => {
                draggingAlbumIdRef.current = "";
                setDraggingAlbumId("");
                setDropTargetAlbumId("");
              }}
              onDragEnter={(event) => {
                event.preventDefault();
                if (draggingAlbumId && draggingAlbumId !== album.id) setDropTargetAlbumId(album.id);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const movedAlbumId = draggingAlbumIdRef.current || event.dataTransfer.getData("text/plain");
                if (movedAlbumId) {
                  moveAlbumToDropTarget(movedAlbumId, album.id);
                  selectAlbum(movedAlbumId);
                }
                draggingAlbumIdRef.current = "";
                setDraggingAlbumId("");
                setDropTargetAlbumId("");
              }}
            >
              <button
                className="admin-list-row__main admin-list-row__main--album"
                onClick={() => selectAlbum(album.id)}
                type="button"
              >
                <CoverImage url={getAlbumCoverPreviewUrlFromArchive(archive, previewUrls, album)} />
                <span className="admin-list-item__body">
                  <strong>{album.title}</strong>
                  <small>{photoCount(album.id, archive.photos)} photos · {setCount(album.id, archive.sets)} sets</small>
                </span>
                <span className="admin-status" data-status={album.status}>{album.status}</span>
              </button>
              <button
                aria-label={`Drag ${album.title} to reorder`}
                className="admin-drag-handle"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", album.id);
                  draggingAlbumIdRef.current = album.id;
                  setDraggingAlbumId(album.id);
                  setDropTargetAlbumId("");
                }}
                type="button"
              >
                <GripVertical aria-hidden />
              </button>
            </div>
          ))}
        </div>
      </section>

      {selectedAlbum ? (
        <>
          <section className="admin-column admin-column--settings" aria-label="Album settings">
            <div className="admin-column-head admin-column-head--tight">
              <div>
                <p className="admin-kicker">Album settings</p>
                <h2>{selectedAlbum.title}</h2>
                <p>{selectedAlbum.subtitle || "Upload, review, publish."}</p>
              </div>
              <span className="admin-status" data-status={selectedAlbum.status}>{selectedAlbum.status}</span>
            </div>

            <div className="admin-column-stat-grid">
              <Snapshot label="Photos" value={`${selectedPhotos.length}`} />
              <Snapshot label="Sets" value={`${setCount(selectedAlbum.id, archive.sets)}`} />
              <Snapshot label="Download" value={selectedAlbum.publicDownloadPolicy} />
            </div>

            <div className="admin-form-stack">
              <Field label="Title">
                <input value={selectedAlbum.title} onChange={(event) => actions.updateAlbum(selectedAlbum.id, { title: event.target.value })} />
              </Field>
              <Field label="Subtitle">
                <input value={selectedAlbum.subtitle ?? ""} onChange={(event) => actions.updateAlbum(selectedAlbum.id, { subtitle: event.target.value })} />
              </Field>
              <Field label="Status">
                <select
                  value={selectedAlbum.status}
                  onChange={(event) => actions.updateAlbum(selectedAlbum.id, { status: event.target.value as ArchiveStatus })}
                >
                  {editableStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </Field>
              <Field label="Download">
                <select
                  value={selectedAlbum.publicDownloadPolicy}
                  onChange={(event) => actions.updateAlbum(selectedAlbum.id, { publicDownloadPolicy: event.target.value as PublicDownloadPolicy })}
                >
                  {downloadPolicies.map((policy) => <option key={policy} value={policy}>{policy}</option>)}
                </select>
              </Field>
            </div>

            <CoverPriorityPicker album={selectedAlbum} />

            <div className="admin-subsection admin-subsection--relative">
              <div className="admin-subsection-title-row">
                <h4>Sets</h4>
                <button className="admin-ghost-button" onClick={() => setIsSetPickerOpen((isOpen) => !isOpen)} type="button">
                  Add to set
                </button>
              </div>
              <div className="admin-set-chip-row">
                {selectedAlbumSets.map((set) => (
                  <button
                    aria-label={`Remove ${selectedAlbum.title} from ${set.title}`}
                    key={set.id}
                    onClick={() => actions.removeAlbumFromSet(set.id, selectedAlbum.id)}
                    type="button"
                  >
                    <span>{set.title}</span>
                    <CircleX aria-hidden />
                  </button>
                ))}
                {!selectedAlbumSets.length ? <span>No sets yet</span> : null}
              </div>

              {isSetPickerOpen ? (
                <div className="admin-set-picker" role="menu">
                  {sets.map((set) => {
                    const checked = selectedAlbumSetIds.has(set.id);

                    return (
                      <label data-checked={checked ? "true" : undefined} key={set.id}>
                        <input
                          checked={checked}
                          onChange={(event) => {
                            if (event.target.checked) actions.addAlbumToSet(set.id, selectedAlbum.id);
                            else actions.removeAlbumFromSet(set.id, selectedAlbum.id);
                          }}
                          type="checkbox"
                        />
                        <span aria-hidden />
                        <strong>{set.title}</strong>
                        <small>{set.albumIdsWithOrder.length} albums</small>
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <div className="admin-subsection">
              <h4>Album tags</h4>
              <TagSearchInput
                excludedTagIds={selectedAlbum.tagIds}
                onChange={setAlbumTagInput}
                onSubmit={(label) => void resolveTagId(label).then((tagId) => {
                  if (!tagId) return;
                  actions.attachAlbumTag(selectedAlbum.id, tagId);
                  setAlbumTagInput("");
                })}
                placeholder="Search or create tag"
                tags={archive.tags}
                value={albumTagInput}
              />
              <div className="admin-tag-row admin-tag-row--flat">
                {selectedTags.map((tag) => (
                  <button key={tag.id} onClick={() => actions.detachAlbumTag(selectedAlbum.id, tag.id)} type="button">
                    {tag.label}
                  </button>
                ))}
                {!selectedTags.length ? <span>No tags yet</span> : null}
              </div>
            </div>

            <button className="admin-danger-button admin-danger-button--full" onClick={() => void trashAlbum(selectedAlbum)} type="button">
              <CircleX aria-hidden />
              Delete album
            </button>
          </section>

          <section className="admin-column admin-column--content" aria-label="Album photos">
            <div className="admin-column-head admin-column-head--tight">
              <div>
                <p className="admin-kicker">Album content</p>
                <h2>Photos</h2>
                <p>Clean 3:2 / 2:3 contact sheet; edit the selected frame in the inspector.</p>
              </div>
              <button className="admin-button" onClick={() => inputRef.current?.click()} type="button">
                <UploadCloud aria-hidden />
                Select JPEGs
              </button>
            </div>

            <div
              className="admin-dropzone admin-dropzone--compact"
              data-uploading={isUploading ? "true" : undefined}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void queueFiles(event.dataTransfer.files);
              }}
            >
              <ImagePlus aria-hidden />
              <div>
                <strong>{isUploading ? "Preparing local previews" : "Drop JPEG files here"}</strong>
                <p>The browser file order becomes the first album order.</p>
              </div>
              <input
                accept="image/jpeg"
                multiple
                onChange={(event) => {
                  if (event.target.files) void queueFiles(event.target.files);
                  event.target.value = "";
                }}
                ref={inputRef}
                type="file"
              />
            </div>

            <div className="admin-upload-list admin-upload-list--compact">
              {selectedJobs.length ? (
                selectedJobs.map((job) => (
                  <div className="admin-upload-row admin-upload-row--compact" key={job.id}>
                    <div
                      className="admin-progress-ring"
                      style={{ "--progress-angle": `${job.progress * 3.6}deg` } as React.CSSProperties}
                    >
                      <span>{job.progress}</span>
                    </div>
                    <div>
                      <strong>{job.fileName}</strong>
                      <p>{job.status} · {formatBytes(job.bytes)}</p>
                    </div>
                    <div className="admin-derivatives">
                      {job.derivatives.map((derivative) => (
                        <span data-state={derivative.status} key={`${job.id}-${derivative.version}`}>
                          {derivative.version}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="admin-inline-empty">Upload jobs appear here after selecting JPEGs.</div>
              )}
            </div>

            <div className="admin-photo-review-grid admin-photo-review-grid--column">
              {selectedPhotos.map((photo) => (
                <PhotoReviewCard
                  isDragTarget={photo.id === dropTargetPhotoId && photo.id !== draggingPhotoId}
                  isDragging={photo.id === draggingPhotoId}
                  isSelected={photo.id === selectedPhoto?.id}
                  key={photo.id}
                  onDragEnd={() => {
                    draggingPhotoIdRef.current = "";
                    setDraggingPhotoId("");
                    setDropTargetPhotoId("");
                  }}
                  onDragEnter={() => {
                    if (draggingPhotoId && draggingPhotoId !== photo.id) setDropTargetPhotoId(photo.id);
                  }}
                  onDragStart={() => {
                    draggingPhotoIdRef.current = photo.id;
                    setDraggingPhotoId(photo.id);
                    setDropTargetPhotoId("");
                  }}
                  onDrop={(droppedPhotoId) => {
                    const movedPhotoId = draggingPhotoIdRef.current || droppedPhotoId || draggingPhotoId;
                    if (!selectedAlbum || !movedPhotoId || movedPhotoId === photo.id) return;
                    actions.movePhotoToPosition(selectedAlbum.id, movedPhotoId, photo.position);
                    setSelectedPhotoId(movedPhotoId);
                    draggingPhotoIdRef.current = "";
                    setDraggingPhotoId("");
                    setDropTargetPhotoId("");
                  }}
                  onSelect={() => setSelectedPhotoId(photo.id)}
                  photo={photo}
                />
              ))}
              {!selectedPhotos.length ? <div className="admin-inline-empty admin-inline-empty--wide">No photos in this album yet.</div> : null}
            </div>
          </section>

          <PhotoInspector
            album={selectedAlbum}
            onTrashPhoto={trashPhoto}
            onAttachPhotoTag={attachPhotoTagFromInput}
            photo={selectedPhoto}
            photoIndex={selectedPhotoIndex}
            photoTagInput={photoTagInput}
            photosCount={selectedPhotos.length}
            setPhotoTagInput={setPhotoTagInput}
          />
        </>
      ) : (
        <section className="admin-column admin-column--empty">
          <div className="admin-empty-state">Create an album to upload photos.</div>
        </section>
      )}
    </div>
  );
}

function PhotoInspector({
  album,
  onTrashPhoto,
  onAttachPhotoTag,
  photo,
  photoIndex,
  photoTagInput,
  photosCount,
  setPhotoTagInput
}: {
  album: LocalArchiveAlbum;
  onTrashPhoto: (photo: LocalArchivePhoto) => Promise<void>;
  onAttachPhotoTag: (label?: string) => Promise<void>;
  photo: LocalArchivePhoto | undefined;
  photoIndex: number;
  photoTagInput: string;
  photosCount: number;
  setPhotoTagInput: (value: string) => void;
}) {
  const { actions, archive, previewUrls } = useAdminArchive();

  if (!photo) {
    return (
      <section className="admin-column admin-column--inspector" aria-label="Selected photo">
        <div className="admin-empty-state">Select or upload a photo to edit its metadata.</div>
      </section>
    );
  }

  const displayAssetId = photo.assetIds.find((assetId) => assetId.endsWith("-display")) ?? photo.assetIds[0];
  const thumbAssetId = photo.assetIds.find((assetId) => assetId.endsWith("-thumb")) ?? displayAssetId;
  const imageUrl = getPhotoDisplayUrlFromArchive(archive, previewUrls, photo);
  const isHidden = photo.status === "hidden";
  const fileSize = formatBytes(photo.sourceBytes ?? assetBytes(photo.id, archive.assets));
  const inheritedTags = album.tagIds
    .map((tagId) => archive.tags.find((tag) => tag.id === tagId))
    .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag));
  const directTags = photo.tagIds
    .map((tagId) => archive.tags.find((tag) => tag.id === tagId))
    .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag));
  const effectiveTags = getEffectivePhotoTagIdsFromArchive(archive, photo)
    .map((tagId) => archive.tags.find((tag) => tag.id === tagId))
    .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag));

  return (
    <section className="admin-column admin-column--inspector admin-photo-inspector" aria-label="Selected photo">
      <div className="admin-column-head admin-column-head--tight">
        <div>
          <p className="admin-kicker">Selected photo</p>
          <h2>{photo.title}</h2>
          <p>All photo controls live here; the grid stays clean for fast review.</p>
        </div>
        <Tags aria-hidden className="admin-section-icon" />
      </div>

      <div className="admin-photo-inspector__preview">
        {imageUrl ? <img alt="" src={imageUrl} /> : <span className="admin-image-placeholder" aria-hidden />}
      </div>

      <div className="admin-form-stack">
        <Field label="Title">
          <input value={photo.title} onChange={(event) => actions.updatePhoto(photo.id, { title: event.target.value })} />
        </Field>
        <Field label="Status">
          <select
            value={photo.status}
            onChange={(event) => actions.updatePhoto(photo.id, { status: event.target.value as ArchiveStatus })}
          >
            {editableStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </Field>
        <Field label="Download override">
          <select
            value={photo.publicDownloadOverride ?? "inherit"}
            onChange={(event) => {
              const value = event.target.value as PublicDownloadPolicy;
              actions.updatePhoto(photo.id, { publicDownloadOverride: value === "inherit" ? undefined : value });
            }}
          >
            {downloadPolicies.map((policy) => <option key={policy} value={policy}>{policy}</option>)}
          </select>
        </Field>
        <Field label="File">
          <input readOnly value={`${photo.sourceFileName ?? photo.slug}.jpg · ${photo.width}x${photo.height} · ${fileSize}`} />
        </Field>
      </div>

      <div className="admin-subsection">
        <h4>Photo actions</h4>
        <div className="admin-photo-action-grid">
          <button disabled={photoIndex <= 0} onClick={() => actions.reorderPhoto(album.id, photo.id, "up")} type="button">
            <ArrowUp aria-hidden />
            Move up
          </button>
          <label>
            <span>Position</span>
            <input
              aria-label={`Position for ${photo.title}`}
              max={photosCount}
              min={1}
              onChange={(event) => actions.movePhotoToPosition(album.id, photo.id, Number(event.target.value))}
              type="number"
              value={photo.position}
            />
          </label>
          <button disabled={photoIndex < 0 || photoIndex >= photosCount - 1} onClick={() => actions.reorderPhoto(album.id, photo.id, "down")} type="button">
            <ArrowDown aria-hidden />
            Move down
          </button>
          <button onClick={() => (isHidden ? actions.showPhoto(photo.id) : actions.hidePhoto(photo.id))} type="button">
            {isHidden ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
            {isHidden ? "Show photo" : "Hide photo"}
          </button>
          <button className="admin-danger-button" onClick={() => void onTrashPhoto(photo)} type="button">
            <CircleX aria-hidden />
            Delete image
          </button>
        </div>
      </div>

      <div className="admin-subsection">
        <h4>Cover shortcuts</h4>
        <div className="admin-row-actions">
          <button className="admin-ghost-button" data-active={album.coverLandscapeAssetId === displayAssetId ? "true" : undefined} onClick={() => actions.setAlbumCover(album.id, "landscape", displayAssetId)} type="button">
            <Square aria-hidden />
            Landscape
          </button>
          <button className="admin-ghost-button" data-active={album.coverPortraitAssetId === displayAssetId ? "true" : undefined} onClick={() => actions.setAlbumCover(album.id, "portrait", displayAssetId)} type="button">
            <Square aria-hidden />
            Portrait
          </button>
          <button className="admin-ghost-button" data-active={album.coverSquareAssetId === thumbAssetId ? "true" : undefined} onClick={() => actions.setAlbumCover(album.id, "square", thumbAssetId)} type="button">
            <Square aria-hidden />
            Square
          </button>
        </div>
      </div>

      <div className="admin-subsection">
        <h4>Inherited album tags</h4>
        <div className="admin-tag-row admin-tag-row--flat">
          {inheritedTags.map((tag) => <span key={tag.id}>{tag.label}</span>)}
          {!inheritedTags.length ? <span>No inherited tags</span> : null}
        </div>
      </div>

      <div className="admin-subsection">
        <h4>Direct photo tags</h4>
        <TagSearchInput
          excludedTagIds={photo.tagIds}
          onChange={setPhotoTagInput}
          onSubmit={(label) => void onAttachPhotoTag(label)}
          placeholder="Search direct photo tag"
          tags={archive.tags}
          value={photoTagInput}
        />
        <div className="admin-tag-row admin-tag-row--flat">
          {directTags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => actions.updatePhoto(photo.id, { tagIds: photo.tagIds.filter((tagId) => tagId !== tag.id) })}
              type="button"
            >
              {tag.label}
            </button>
          ))}
          {!directTags.length ? <span>No direct tags</span> : null}
        </div>
      </div>

      <div className="admin-subsection">
        <h4>Effective public filters</h4>
        <div className="admin-tag-row admin-tag-row--flat">
          {effectiveTags.map((tag) => <span key={tag.id}>{tag.label}</span>)}
        </div>
      </div>
    </section>
  );
}

function TagSearchInput({
  excludedTagIds = [],
  onChange,
  onSubmit,
  placeholder,
  tags,
  value
}: {
  excludedTagIds?: string[];
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder: string;
  tags: LocalArchiveTag[];
  value: string;
}) {
  const menuId = useId();
  const [isFocused, setIsFocused] = useState(false);
  const query = value.trim().toLowerCase();
  const excluded = new Set(excludedTagIds);
  const suggestions = query
    ? tags
        .filter((tag) => !excluded.has(tag.id))
        .filter((tag) => tag.label.toLowerCase().includes(query) || tag.slug.toLowerCase().includes(query))
        .slice(0, 8)
    : [];
  const hasExactSuggestion = suggestions.some((tag) => tag.label.toLowerCase() === query || tag.slug.toLowerCase() === query);
  const showMenu = isFocused && Boolean(query);

  function submit(nextValue = value) {
    const trimmed = nextValue.trim();

    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <div className="admin-tag-search">
      <div className="admin-token-editor admin-token-editor--search">
        <input
          aria-autocomplete="list"
          aria-controls={menuId}
          aria-expanded={showMenu}
          onBlur={() => window.setTimeout(() => setIsFocused(false), 120)}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit(suggestions[0]?.label ?? value);
            }
          }}
          placeholder={placeholder}
          role="combobox"
          value={value}
        />
        <button className="admin-ghost-button" onClick={() => submit()} type="button">Add</button>
      </div>

      {showMenu ? (
        <div className="admin-tag-search__menu" id={menuId} role="listbox">
          {suggestions.map((tag) => (
            <button
              aria-selected="false"
              key={tag.id}
              onMouseDown={(event) => {
                event.preventDefault();
                onSubmit(tag.label);
              }}
              role="option"
              type="button"
            >
              <span>{tag.label}</span>
              <small>{tag.scope}</small>
            </button>
          ))}
          {!suggestions.length || !hasExactSuggestion ? (
            <button
              aria-selected="false"
              className="admin-tag-search__create"
              onMouseDown={(event) => {
                event.preventDefault();
                submit();
              }}
              role="option"
              type="button"
            >
              Create <span>{value.trim()}</span>
            </button>
          ) : null}
        </div>
      ) : null}
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

function CoverPriorityPicker({ album }: { album: LocalArchiveAlbum }) {
  const { actions, archive, previewUrls } = useAdminArchive();
  const coverPriority = album.coverPriority ?? "landscape";
  const options: Array<{ label: string; type: "landscape" | "square" | "portrait" }> = [
    { label: "Landscape", type: "landscape" },
    { label: "Square", type: "square" },
    { label: "Portrait", type: "portrait" }
  ];

  return (
    <div className="admin-subsection admin-cover-priority">
      <div className="admin-subsection-title-row">
        <h4>Covers</h4>
        <span>Priority: {coverPriority}</span>
      </div>
      <div className="admin-cover-priority__grid">
        {options.map((option) => (
          <button
            data-active={coverPriority === option.type ? "true" : undefined}
            data-cover-type={option.type}
            key={option.type}
            onClick={() => actions.updateAlbum(album.id, { coverPriority: option.type })}
            title={`Use ${option.label.toLowerCase()} cover first when the layout allows it`}
            type="button"
          >
            <CoverImage url={getAlbumCoverPreviewUrlFromArchive(archive, previewUrls, album, option.type)} />
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function CoverImage({ url }: { url: string | undefined }) {
  return url ? <img alt="" src={url} /> : <span className="admin-image-placeholder" aria-hidden />;
}

function PhotoReviewCard({
  isDragTarget,
  isDragging,
  isSelected,
  onDragEnd,
  onDragEnter,
  onDragStart,
  onDrop,
  onSelect,
  photo
}: {
  isDragTarget: boolean;
  isDragging: boolean;
  isSelected: boolean;
  onDragEnd: () => void;
  onDragEnter: () => void;
  onDragStart: () => void;
  onDrop: (photoId: string) => void;
  onSelect: () => void;
  photo: LocalArchivePhoto;
}) {
  const { archive, previewUrls } = useAdminArchive();
  const imageUrl = getPhotoThumbnailUrlFromArchive(archive, previewUrls, photo);
  const isHidden = photo.status === "hidden";

  return (
    <article
      className="admin-photo-review-card"
      draggable
      data-drag-target={isDragTarget ? "true" : undefined}
      data-dragging={isDragging ? "true" : undefined}
      data-hidden={isHidden ? "true" : undefined}
      data-selected={isSelected ? "true" : undefined}
      onDragEnd={onDragEnd}
      onDragEnter={(event) => {
        event.preventDefault();
        onDragEnter();
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", photo.id);
        onDragStart();
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(event.dataTransfer.getData("text/plain"));
      }}
      style={{ "--photo-aspect": getPhotoPreviewAspect(photo) } as React.CSSProperties}
    >
      <button
        aria-label={`Select ${photo.title}`}
        className="admin-photo-review-card__preview"
        onClick={onSelect}
        title={photo.title}
        type="button"
      >
        {imageUrl ? <img alt="" src={imageUrl} /> : <span className="admin-image-placeholder" aria-hidden />}
        <span>{photo.position}</span>
      </button>
    </article>
  );
}

function getPhotoPreviewAspect(photo: LocalArchivePhoto) {
  return photo.height > photo.width ? "2 / 3" : "3 / 2";
}

function photoCount(albumId: string, photos: LocalArchivePhoto[]) {
  return photos.filter((photo) => photo.albumId === albumId && photo.status !== "trash" && photo.status !== "deleted").length;
}

function setCount(albumId: string, sets: ReturnType<typeof getOrderedSetsFromArchive>) {
  return sets.filter((set) => set.albumIdsWithOrder.some((albumRef) => albumRef.albumId === albumId)).length;
}

function assetBytes(photoId: string, assets: ReturnType<typeof useAdminArchive>["archive"]["assets"]) {
  return assets
    .filter((asset) => asset.photoId === photoId)
    .reduce((sum, asset) => sum + asset.bytes, 0);
}
