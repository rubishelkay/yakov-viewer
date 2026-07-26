"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CircleX,
  Maximize2,
  Plus,
  Sparkles,
  X
} from "lucide-react";

import {
  getAlbumCoverPreviewUrlFromArchive,
  getOrderedAlbumsFromArchive,
  getOrderedSetsFromArchive,
  getPhotosForAlbumFromArchive,
  useAdminArchive
} from "@/admin/cloud-admin-state";
import type {
  ArchiveStatus
} from "@/admin/archive-schema";
import { AdminDemoBadge } from "@/components/admin/AdminDemoBadge";
import { useAdminConfirmDialog } from "@/components/admin/AdminConfirmDialog";
import type { LocalArchiveAlbum } from "@/admin/cloud-admin-state";

const editableStatuses: ArchiveStatus[] = ["draft", "review", "published", "hidden"];

export function SetWorkspace() {
  const { actions, archive, previewUrls } = useAdminArchive();
  const { confirm, dialog } = useAdminConfirmDialog();
  const sets = getOrderedSetsFromArchive(archive);
  const albums = getOrderedAlbumsFromArchive(archive);
  const [selectedSetIdState, setSelectedSetId] = useState(sets[0]?.id ?? "");
  const [newSetTitle, setNewSetTitle] = useState("");
  const [albumToAdd, setAlbumToAdd] = useState("");
  const selectedSetId = sets.some((set) => set.id === selectedSetIdState)
    ? selectedSetIdState
    : (sets[0]?.id ?? "");
  const selectedSet = sets.find((set) => set.id === selectedSetId) ?? sets[0];

  const selectedAlbums = (() => {
    if (!selectedSet) return [];
    const albumById = new Map(albums.map((album) => [album.id, album]));

    return [...selectedSet.albumIdsWithOrder]
      .sort((a, b) => a.position - b.position)
      .map((ref) => albumById.get(ref.albumId))
      .filter((album): album is LocalArchiveAlbum => Boolean(album));
  })();

  const availableAlbums = selectedSet
    ? albums.filter((album) => !selectedSet.albumIdsWithOrder.some((ref) => ref.albumId === album.id))
    : albums;

  async function createSet() {
    const title = newSetTitle.trim();
    if (!title) return;

    const setId = await actions.createSet({ title });
    if (setId) setSelectedSetId(setId);
    setNewSetTitle("");
  }

  function addAlbum() {
    if (!selectedSet || !albumToAdd) return;
    actions.addAlbumToSet(selectedSet.id, albumToAdd);
    setAlbumToAdd("");
  }

  async function trashSet() {
    if (!selectedSet) return;
    const confirmed = await confirm({
      confirmLabel: "Delete set",
      message: `Move "${selectedSet.title}" to the Bin? Albums stay in the archive and can be added to another set.`,
      title: "Delete set",
      tone: "danger"
    });

    if (confirmed) await actions.trashSet(selectedSet.id);
  }

  return (
    <div className="admin-column-browser admin-column-browser--sets">
      {dialog}
      <section className="admin-column admin-column--list" aria-label="Sets">
        <div className="admin-column-head">
          <div>
            <p className="admin-kicker">Homepage order</p>
            <h1>Sets</h1>
          </div>
          <span className="admin-count">{sets.length}</span>
        </div>

        <div className="admin-create-card admin-create-card--compact">
          <label>
            <span>New set</span>
            <input
              aria-label="New set title"
              onChange={(event) => setNewSetTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void createSet();
              }}
              placeholder="Set title"
              value={newSetTitle}
            />
          </label>
          <button className="admin-button" onClick={() => void createSet()} type="button">
            <Plus aria-hidden />
            Create
          </button>
        </div>

        <div className="admin-list admin-list--table">
          {sets.map((set, index) => (
            <div className="admin-list-row" data-active={set.id === selectedSet?.id ? "true" : undefined} key={set.id}>
              <button
                className="admin-list-row__main"
                onClick={() => setSelectedSetId(set.id)}
                type="button"
              >
                <span className="admin-list-item__order">{set.order}</span>
                <span className="admin-list-item__body">
                  <strong>{set.title}</strong>
                  <small>{set.albumIdsWithOrder.length} albums</small>
                </span>
                <span className="admin-status" data-status={set.status}>{set.status}</span>
              </button>
              <div className="admin-order-buttons">
                <button disabled={index === 0} onClick={() => actions.reorderSet(set.id, "up")} type="button" aria-label="Move set up"><ArrowUp aria-hidden /></button>
                <button disabled={index === sets.length - 1} onClick={() => actions.reorderSet(set.id, "down")} type="button" aria-label="Move set down"><ArrowDown aria-hidden /></button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {selectedSet ? (
        <>
          <section className="admin-column admin-column--settings" aria-label="Set settings">
            <div className="admin-column-head admin-column-head--tight">
              <div>
                <p className="admin-kicker">Set settings</p>
                <h2>{selectedSet.title}</h2>
                <p>{selectedSet.subtitle || "Compose a homepage section from albums."}</p>
              </div>
              <span className="admin-status" data-status={selectedSet.status}>{selectedSet.status}</span>
            </div>

            <div className="admin-column-stat-grid">
              <Snapshot label="Albums" value={`${selectedAlbums.length}`} />
              <Snapshot label="Published" value={`${selectedAlbums.filter((album) => album.status === "published").length}`} />
              <Snapshot label="Photos" value={`${selectedAlbums.reduce((sum, album) => sum + getPhotosForAlbumFromArchive(archive, album.id).length, 0)}`} />
            </div>

            <div className="admin-form-stack">
              <Field label="Title">
                <input value={selectedSet.title} onChange={(event) => actions.updateSet(selectedSet.id, { title: event.target.value })} />
              </Field>
              <Field label="Subtitle">
                <input value={selectedSet.subtitle ?? ""} onChange={(event) => actions.updateSet(selectedSet.id, { subtitle: event.target.value, description: event.target.value })} />
              </Field>
              <Field label="Status">
                <select
                  value={selectedSet.status}
                  onChange={(event) => actions.updateSet(selectedSet.id, { status: event.target.value as ArchiveStatus })}
                >
                  {editableStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </Field>
            </div>

            <button className="admin-danger-button admin-danger-button--full" onClick={() => void trashSet()} type="button">
              <CircleX aria-hidden />
              Delete set
            </button>
          </section>

          <section className="admin-column admin-column--content" aria-label="Set albums">
            <div className="admin-column-head admin-column-head--tight">
              <div>
                <p className="admin-kicker">Set albums</p>
                <h2>Album order</h2>
                <p>Albums appear on the homepage in this order.</p>
              </div>
            </div>

            <div className="admin-inline-control admin-inline-control--add">
              <select value={albumToAdd} onChange={(event) => setAlbumToAdd(event.target.value)}>
                <option value="">Choose album</option>
                {availableAlbums.map((album) => <option key={album.id} value={album.id}>{album.title}</option>)}
              </select>
              <button className="admin-button" onClick={addAlbum} type="button">Add</button>
            </div>

            <div className="admin-album-grid admin-album-grid--editable">
              {selectedAlbums.map((album, index) => (
                <article className="admin-album-tile admin-album-tile--square" key={album.id}>
                  <CoverImage url={getAlbumCoverPreviewUrlFromArchive(archive, previewUrls, album)} />
                  <div>
                    <span className="admin-tile-title-row">
                      <strong>{album.title}</strong>
                      {album.isDemo ? <AdminDemoBadge /> : null}
                    </span>
                    <small>{album.subtitle || "No subtitle"}</small>
                    <div className="admin-order-buttons admin-order-buttons--inline">
                      <button disabled={index === 0} onClick={() => actions.reorderAlbumInSet(selectedSet.id, album.id, "left")} type="button" aria-label="Move album left"><ArrowLeft aria-hidden /></button>
                      <button disabled={index === selectedAlbums.length - 1} onClick={() => actions.reorderAlbumInSet(selectedSet.id, album.id, "right")} type="button" aria-label="Move album right"><ArrowRight aria-hidden /></button>
                      <button onClick={() => actions.removeAlbumFromSet(selectedSet.id, album.id)} type="button" aria-label="Remove album from set"><X aria-hidden /></button>
                    </div>
                  </div>
                </article>
              ))}
              {!selectedAlbums.length ? <div className="admin-inline-empty admin-inline-empty--wide">Add albums to build this homepage set.</div> : null}
            </div>
          </section>

          <section className="admin-column admin-column--preview" aria-label="Set homepage preview">
            <SetPreview albums={selectedAlbums} setTitle={selectedSet.title} />
          </section>
        </>
      ) : (
        <section className="admin-column admin-column--empty">
          <div className="admin-empty-state">Create a set to start composing the homepage.</div>
        </section>
      )}
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

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function SetPreview({
  albums,
  setTitle
}: {
  albums: LocalArchiveAlbum[];
  setTitle: string;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDensity, setPreviewDensity] = useState<"compact" | "spacious">("compact");

  return (
    <div className="admin-preview admin-preview--column">
      <div className="admin-column-head admin-column-head--tight">
        <div>
          <p className="admin-kicker">Homepage preview</p>
          <h2>Album rail</h2>
          <p>{albums.length} albums · all shown</p>
        </div>
        <Sparkles aria-hidden className="admin-section-icon" />
      </div>
      <SetPreviewCanvas albums={albums} />
      <div className="admin-preview__note">
        <Sparkles aria-hidden />
        Layout continues horizontally when the set has more albums than one screen.
      </div>
      <div className="admin-preview__actions">
        <button className="admin-button" onClick={() => setPreviewOpen(true)} type="button">
          <Maximize2 aria-hidden />
          Preview
        </button>
      </div>
      {previewOpen ? (
        <div className="admin-modal-backdrop admin-modal-backdrop--preview" role="presentation">
          <div
            aria-label={`${setTitle} preview`}
            aria-modal="true"
            className="admin-preview-dialog"
            role="dialog"
          >
            <div className="admin-preview-dialog__head">
              <div>
                <p className="admin-kicker">Set preview</p>
                <h2>{setTitle}</h2>
                <p>{albums.length} albums</p>
              </div>
              <div className="admin-preview-dialog__controls">
                <div className="admin-density-toggle" aria-label="Preview density">
                  <button
                    data-active={previewDensity === "compact" ? "true" : undefined}
                    onClick={() => setPreviewDensity("compact")}
                    type="button"
                  >
                    Compact
                  </button>
                  <button
                    data-active={previewDensity === "spacious" ? "true" : undefined}
                    onClick={() => setPreviewDensity("spacious")}
                    type="button"
                  >
                    Spacious
                  </button>
                </div>
                <button className="admin-ghost-button" onClick={() => setPreviewOpen(false)} type="button">
                  <X aria-hidden />
                  Close
                </button>
              </div>
            </div>
            <div className="admin-preview-dialog__stage">
              <SetPreviewCanvas
                albums={albums}
                density={previewDensity}
                variant="modal"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SetPreviewCanvas({
  albums,
  density = "compact",
  variant = "column"
}: {
  albums: LocalArchiveAlbum[];
  density?: "compact" | "spacious";
  variant?: "column" | "modal";
}) {
  const { archive, previewUrls } = useAdminArchive();

  return (
    <div
      className="admin-set-preview"
      data-density={density}
      data-layout="six-grid"
      data-variant={variant}
    >
      {albums.map((album, index) => (
        <figure data-active={index === 0 ? "true" : undefined} key={album.id}>
          <CoverImage url={getAlbumCoverPreviewUrlFromArchive(archive, previewUrls, album)} />
          <figcaption>
            <strong>{album.title}</strong>
            <small>{album.subtitle || " "}</small>
          </figcaption>
        </figure>
      ))}
      {!albums.length ? <div className="admin-inline-empty admin-inline-empty--wide">Preview appears after adding albums.</div> : null}
    </div>
  );
}

function CoverImage({ url }: { url: string | undefined }) {
  return url ? <img alt="" src={url} /> : <span className="admin-image-placeholder" aria-hidden />;
}
