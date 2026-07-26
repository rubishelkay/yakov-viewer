"use client";

import { useState } from "react";
import {
  ArchiveRestore,
  CheckCircle2,
  CircleX,
  Plus,
  RotateCcw,
  Shield,
  SlidersHorizontal
} from "lucide-react";

import {
  formatBytes,
  getTagUsageFromArchive,
  useAdminArchive
} from "@/admin/cloud-admin-state";
import { useAdminConfirmDialog } from "@/components/admin/AdminConfirmDialog";
import type {
  ArchiveStatus,
  PublicDownloadPolicy,
  TagScope
} from "@/admin/archive-schema";

const statuses: ArchiveStatus[] = ["draft", "review", "published", "hidden"];
const downloadPolicies: PublicDownloadPolicy[] = ["none", "expanded"];
const tagScopes: TagScope[] = ["album", "photo", "both"];

export function TagsPanel() {
  const { actions, archive } = useAdminArchive();
  const { confirm, dialog } = useAdminConfirmDialog();
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<TagScope>("both");
  const [search, setSearch] = useState("");
  const filteredTags = archive.tags.filter((tag) => {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;

    return tag.label.toLowerCase().includes(needle) || tag.slug.includes(needle) || tag.scope.includes(needle);
  });

  async function createTag() {
    const trimmed = label.trim();
    if (!trimmed) return;

    await actions.createTag({ label: trimmed, scope });
    setLabel("");
    setScope("both");
  }

  async function deleteTag(tagId: string, tagLabel: string) {
    const confirmed = await confirm({
      confirmLabel: "Delete tag",
      message: `Delete "${tagLabel}" from the shared D1 dictionary? This is allowed only when the tag is unused.`,
      title: "Delete tag",
      tone: "danger"
    });

    if (confirmed) actions.deleteTag(tagId);
  }

  return (
    <div className="admin-page admin-page--flat">
      {dialog}
      <header className="admin-page__header">
        <div>
          <p className="admin-kicker">Controlled dictionary</p>
          <h1>Tags</h1>
          <p>One shared dictionary for album tags and direct photo tags. Album screens use autocomplete from this list.</p>
        </div>
      </header>

      <section className="admin-panel admin-panel--flat">
        <div className="admin-tags-toolbar">
          <div className="admin-create-card admin-create-card--inline admin-create-card--flat">
            <label>
              <span>New tag</span>
              <input
                onChange={(event) => setLabel(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void createTag();
                }}
                placeholder="Bangkok, Film, Kodak..."
                value={label}
              />
            </label>
            <label>
              <span>Scope</span>
              <select value={scope} onChange={(event) => setScope(event.target.value as TagScope)}>
                {tagScopes.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <button className="admin-button" onClick={() => void createTag()} type="button">
              <Plus aria-hidden />
              Add tag
            </button>
          </div>
          <label>
            <span>Search</span>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter tags"
              value={search}
            />
          </label>
        </div>

        <div className="admin-table admin-table--tags">
          {filteredTags.map((tag) => {
            const usage = getTagUsageFromArchive(archive, tag.id);
            const isUsed = usage.total > 0;

            return (
              <div className="admin-table__row" key={tag.id}>
                <span className="admin-tag-dot" />
                <div className="admin-field admin-field--inline">
                  <input
                    aria-label={`Label for ${tag.label}`}
                    value={tag.label}
                    onChange={(event) => actions.updateTag(tag.id, { label: event.target.value })}
                  />
                  <span>{tag.slug}</span>
                </div>
                <select value={tag.scope} onChange={(event) => actions.updateTag(tag.id, { scope: event.target.value as TagScope })}>
                  {tagScopes.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <span>{usage.albumCount} albums · {usage.directPhotoCount + usage.inheritedPhotoCount} photos</span>
                <button
                  className="admin-danger-button"
                  disabled={isUsed}
                  onClick={() => void deleteTag(tag.id, tag.label)}
                  title={isUsed ? "Remove this tag from albums/photos before deleting it." : "Delete unused tag"}
                  type="button"
                >
                  <CircleX aria-hidden />
                  Delete
                </button>
              </div>
            );
          })}
          {!filteredTags.length ? <div className="admin-inline-empty">No tags match this filter.</div> : null}
        </div>
      </section>
    </div>
  );
}

export function SettingsPanel() {
  const { actions, archive } = useAdminArchive();
  const { confirm, dialog } = useAdminConfirmDialog();
  const settings = archive.settings;

  async function refreshArchive() {
    const confirmed = await confirm({
      confirmLabel: "Refresh",
      message: "Reload the latest archive state from Cloudflare D1?",
      title: "Refresh Cloudflare archive"
    });

    if (confirmed) await actions.refreshArchive();
  }

  return (
    <div className="admin-page">
      {dialog}
      <header className="admin-page__header">
        <div>
          <p className="admin-kicker">Global defaults</p>
          <h1>Settings</h1>
          <p>Central defaults for image processing, downloads, statuses, color policy, and Bin retention.</p>
        </div>
        <button className="admin-ghost-button" onClick={() => void refreshArchive()} type="button">
          <RotateCcw aria-hidden />
          Refresh D1
        </button>
      </header>

      <div className="admin-settings-grid">
        <section className="admin-panel">
          <div className="admin-panel__head">
            <div>
              <p className="admin-kicker">Publishing</p>
              <h2>Status defaults</h2>
            </div>
            <CheckCircle2 aria-hidden />
          </div>
          <EditableSelect
            label="Default album status"
            value={settings.defaultAlbumStatus}
            options={statuses}
            onChange={(value) => actions.updateSettings({ defaultAlbumStatus: value as ArchiveStatus })}
          />
          <EditableSelect
            label="Default photo status"
            value={settings.defaultPhotoStatus}
            options={statuses}
            onChange={(value) => actions.updateSettings({ defaultPhotoStatus: value as ArchiveStatus })}
          />
          <EditableNumber
            label="Bin retention"
            suffix="days"
            value={settings.trashRetentionDays}
            onChange={(value) => actions.updateSettings({ trashRetentionDays: value })}
          />
        </section>

        <section className="admin-panel">
          <div className="admin-panel__head">
            <div>
              <p className="admin-kicker">Image pipeline</p>
              <h2>Derivative targets</h2>
            </div>
            <SlidersHorizontal aria-hidden />
          </div>
          <ReadOnlySetting label="Thumbnail" value="up to 300 KB / 640 px" />
          <ReadOnlySetting label="Display" value="about 1 MB / 2000 px" />
          <ReadOnlySetting label="Expanded" value="uploaded JPEG / up to 20 MB" />
          <ReadOnlySetting label="Preview color" value="Browser-normalized sRGB" />
        </section>

        <section className="admin-panel">
          <div className="admin-panel__head">
            <div>
              <p className="admin-kicker">Access</p>
              <h2>Downloads and EXIF</h2>
            </div>
            <Shield aria-hidden />
          </div>
          <EditableSelect
            label="Public download mode"
            value={settings.publicDownloadMode}
            options={downloadPolicies}
            onChange={(value) => actions.updateSettings({ publicDownloadMode: value as PublicDownloadPolicy })}
          />
          <ReadOnlySetting label="Public metadata" value="Strip EXIF/XMP/IPTC; preserve ICC" />
        </section>

        <section className="admin-panel">
          <div className="admin-panel__head">
            <div>
              <p className="admin-kicker">Cloudflare API</p>
              <h2>Storage contract</h2>
            </div>
            <span className="admin-muted">live</span>
          </div>
          <ReadOnlySetting label="Metadata" value="D1 yakov_archive" />
          <ReadOnlySetting label="Media" value="R2 yakov-public-assets" />
          <ReadOnlySetting label="Admin access" value="Cloudflare Access" />
        </section>
      </div>
    </div>
  );
}

export function TrashPanel() {
  const { actions, archive } = useAdminArchive();
  const { confirm, dialog } = useAdminConfirmDialog();

  async function purgeItem(itemId: string, title: string) {
    const confirmed = await confirm({
      confirmLabel: "Purge permanently",
      message: `Permanently purge "${title}" from D1 and delete its unshared R2 objects? This cannot be undone.`,
      title: "Permanent purge",
      tone: "danger"
    });

    if (confirmed) await actions.purgeItem(itemId);
  }

  return (
    <div className="admin-page">
      {dialog}
      <header className="admin-page__header">
        <div>
          <p className="admin-kicker">Recoverable delete</p>
          <h1>Bin</h1>
          <p>Items in the Bin are recoverable. Purge permanently removes D1 records and unshared R2 objects.</p>
        </div>
      </header>

      <section className="admin-panel">
        <div className="admin-table">
          {archive.trash.length ? (
            archive.trash.map((item) => (
              <div className="admin-table__row admin-table__row--trash" key={item.id}>
                <CircleX aria-hidden />
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.entityType} · {item.fileCount} files · {formatBytes(item.bytes)}</span>
                </div>
                <span>purge after {item.purgeAfter.slice(0, 10)}</span>
                <div className="admin-row-actions">
                  <button className="admin-ghost-button" onClick={() => void actions.restoreItem(item.id)} type="button">
                    <ArchiveRestore aria-hidden />
                    Restore
                  </button>
                  <button
                    className="admin-danger-button"
                    onClick={() => void purgeItem(item.id, item.title)}
                    type="button"
                  >
                    Purge
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="admin-inline-empty">Bin is empty. Hidden items stay in albums; deleted items appear here first.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function EditableSelect({
  label,
  onChange,
  options,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <label className="admin-setting-row admin-setting-row--control">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function EditableNumber({
  label,
  onChange,
  step = 1,
  suffix,
  value
}: {
  label: string;
  onChange: (value: number) => void;
  step?: number;
  suffix: string;
  value: number;
}) {
  return (
    <label className="admin-setting-row admin-setting-row--control">
      <span>{label}</span>
      <span className="admin-number-input">
        <input
          min={0}
          onChange={(event) => onChange(Number(event.target.value))}
          step={step}
          type="number"
          value={value}
        />
        <strong>{suffix}</strong>
      </span>
    </label>
  );
}

function ReadOnlySetting({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-setting-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
