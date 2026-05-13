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

import { adminApiRoutes, publicApiRoutes } from "@/admin/api-contract";
import { getTagUsageFromArchive, useAdminArchive } from "@/admin/admin-state";
import { formatBytes } from "@/admin/repository";
import { useAdminConfirmDialog } from "@/components/admin/AdminConfirmDialog";
import type {
  ArchiveStatus,
  PublicDownloadPolicy,
  TagScope
} from "@/admin/archive-schema";

const statuses: ArchiveStatus[] = ["draft", "review", "published", "hidden"];
const downloadPolicies: PublicDownloadPolicy[] = ["inherit", "none", "expanded", "downloadJpeg"];
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

  function createTag() {
    const trimmed = label.trim();
    if (!trimmed) return;

    actions.createTag({ label: trimmed, scope });
    setLabel("");
    setScope("both");
  }

  async function deleteTag(tagId: string, tagLabel: string) {
    const confirmed = await confirm({
      confirmLabel: "Delete tag",
      message: `Delete "${tagLabel}" from the local dictionary? This is allowed only when the tag is unused.`,
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
                  if (event.key === "Enter") createTag();
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
            <button className="admin-button" onClick={createTag} type="button">
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
    <div className="admin-page">
      {dialog}
      <header className="admin-page__header">
        <div>
          <p className="admin-kicker">Global defaults</p>
          <h1>Settings</h1>
          <p>Central defaults for image processing, downloads, statuses, color policy, and Bin retention.</p>
        </div>
        <button className="admin-ghost-button" onClick={() => void resetLocalArchive()} type="button">
          <RotateCcw aria-hidden />
          Reset local archive
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
          <EditableNumber
            label="Expanded target"
            suffix="MB"
            step={0.1}
            value={settings.expandedTargetMb}
            onChange={(value) => actions.updateSettings({ expandedTargetMb: value })}
          />
          <EditableNumber
            label="Download JPEG target"
            suffix="MB"
            step={0.1}
            value={settings.downloadJpegTargetMb}
            onChange={(value) => actions.updateSettings({ downloadJpegTargetMb: value })}
          />
          <EditableSelect
            label="Color profile"
            value={settings.derivativeColorProfile}
            options={["srgb", "display-p3", "preserve"]}
            onChange={(value) => actions.updateSettings({ derivativeColorProfile: value as typeof settings.derivativeColorProfile })}
          />
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
          <label className="admin-setting-row admin-setting-row--control">
            <span>Source JPEG public</span>
            <input
              checked={settings.sourceJpegPublicAllowed}
              onChange={(event) => actions.updateSettings({ sourceJpegPublicAllowed: event.target.checked })}
              type="checkbox"
            />
          </label>
          <EditableSelect
            label="Public EXIF policy"
            value={settings.publicExifPolicy}
            options={["strip-sensitive", "strip-all", "preserve"]}
            onChange={(value) => actions.updateSettings({ publicExifPolicy: value as typeof settings.publicExifPolicy })}
          />
        </section>

        <section className="admin-panel admin-panel--api">
          <div className="admin-panel__head">
            <div>
              <p className="admin-kicker">Cloudflare API</p>
              <h2>Readiness</h2>
            </div>
            <span className="admin-muted">local-first</span>
          </div>
          <ApiRouteList title="Admin" routes={adminApiRoutes} />
          <ApiRouteList title="Public" routes={publicApiRoutes} />
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
      message: `Permanently purge "${title}" from the local archive? This simulates future R2 deletion.`,
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
          <p>Items in the Bin are recoverable. Permanent delete is a separate confirmed action that later removes R2 objects.</p>
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
                  <button className="admin-ghost-button" onClick={() => actions.restoreItem(item.id)} type="button">
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

function ApiRouteList({ title, routes }: { title: string; routes: Record<string, string> }) {
  return (
    <div className="admin-api-routes">
      <strong>{title}</strong>
      {Object.entries(routes).map(([name, route]) => (
        <code key={route}>
          <span>{name}</span>
          {route}
        </code>
      ))}
    </div>
  );
}
