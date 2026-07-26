"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { prepareJpegUpload } from "@/admin/browser-image-derivatives";
import {
  createCloudflareAlbum,
  mutateCloudflareArchive,
  readCloudflareArchive,
  uploadCloudflareJpeg
} from "@/admin/cloudflare-api-client";
import type { CloudArchiveMutation } from "@/admin/cloudflare-mutations";
import { defaultAdminSettings } from "@/admin/default-settings";

import type {
  AdminArchive,
  AdminSettings,
  ArchiveAlbum,
  ArchivePhoto,
  ArchiveSet,
  ArchiveStatus,
  ArchiveTag,
  PublicDownloadPolicy,
  SetLayoutMode,
  TagScope
} from "./archive-schema";
import type {
  LocalAdminArchive,
  LocalArchiveAlbum,
  LocalArchivePhoto,
  LocalArchiveSet,
  LocalArchiveTag
} from "./archive-view-model";
import {
  formatBytes,
  getAlbumCoverPreviewUrlFromArchive,
  getAlbumCoverUrlFromArchive,
  getAlbumPhotosForPhotoFromArchive,
  getAssetUrlFromArchive,
  getDashboardSnapshotFromArchive,
  getEffectivePhotoTagIdsFromArchive,
  getOrderedAlbumsFromArchive,
  getOrderedSetsFromArchive,
  getPhotoDisplayUrlFromArchive,
  getPhotosForAlbumFromArchive,
  getPhotoThumbnailUrlFromArchive,
  getStorageSummaryFromArchive,
  getTagUsageFromArchive
} from "./archive-view-model";

export {
  formatBytes,
  getAlbumCoverPreviewUrlFromArchive,
  getAlbumCoverUrlFromArchive,
  getAlbumPhotosForPhotoFromArchive,
  getAssetUrlFromArchive,
  getDashboardSnapshotFromArchive,
  getEffectivePhotoTagIdsFromArchive,
  getOrderedAlbumsFromArchive,
  getOrderedSetsFromArchive,
  getPhotoDisplayUrlFromArchive,
  getPhotosForAlbumFromArchive,
  getPhotoThumbnailUrlFromArchive,
  getStorageSummaryFromArchive,
  getTagUsageFromArchive
};
export type {
  LocalAdminArchive,
  LocalArchiveAlbum,
  LocalArchivePhoto,
  LocalArchivePhotoInAlbum,
  LocalArchiveSet,
  LocalArchiveTag
} from "./archive-view-model";

type CreateAlbumInput = {
  title: string;
  subtitle?: string;
  status?: Exclude<ArchiveStatus, "trash" | "deleted">;
  setIds?: string[];
  tagIds?: string[];
  publicDownloadPolicy?: PublicDownloadPolicy;
};
type CreateSetInput = {
  title: string;
  subtitle?: string;
  status?: Exclude<ArchiveStatus, "trash" | "deleted">;
  layoutMode?: SetLayoutMode;
};
type CreateTagInput = { label: string; scope?: TagScope };
type CoverType = "landscape" | "portrait" | "square";
type SyncState = "loading" | "saved" | "saving" | "error";

type CloudAdminContextValue = {
  actions: {
    addAlbumToSet: (setId: string, albumId: string) => void;
    addExistingPhotoToAlbum: (photoId: string, albumId: string) => Promise<string | undefined>;
    addPhotosToAlbum: (albumId: string, files: File[]) => Promise<void>;
    attachAlbumTag: (albumId: string, tagId: string) => void;
    createAlbum: (input: CreateAlbumInput) => Promise<string>;
    createSet: (input: CreateSetInput) => Promise<string>;
    createTag: (input: CreateTagInput) => Promise<string>;
    deleteTag: (tagId: string) => void;
    detachAlbumTag: (albumId: string, tagId: string) => void;
    hidePhoto: (photoId: string) => void;
    movePhotoToPosition: (albumId: string, photoId: string, position: number) => void;
    moveAlbumToPosition: (albumId: string, position: number) => void;
    purgeItem: (itemId: string) => Promise<void>;
    removePhotoFromAlbum: (albumId: string, photoId: string) => Promise<void>;
    removeAlbumFromSet: (setId: string, albumId: string) => void;
    reorderAlbum: (albumId: string, direction: "up" | "down") => void;
    reorderAlbumInSet: (setId: string, albumId: string, direction: "left" | "right") => void;
    reorderPhoto: (albumId: string, photoId: string, direction: "up" | "down") => void;
    reorderSet: (setId: string, direction: "up" | "down") => void;
    refreshArchive: () => Promise<void>;
    restoreItem: (itemId: string) => Promise<void>;
    setAlbumCover: (albumId: string, coverType: CoverType, assetId: string) => void;
    showPhoto: (photoId: string) => void;
    trashAlbum: (albumId: string) => Promise<void>;
    trashPhoto: (photoId: string) => Promise<void>;
    trashSet: (setId: string) => Promise<void>;
    updateAlbum: (albumId: string, update: Partial<LocalArchiveAlbum>) => void;
    updatePhoto: (photoId: string, update: Partial<LocalArchivePhoto>) => void;
    updateSet: (setId: string, update: Partial<LocalArchiveSet>) => void;
    updateSettings: (update: Partial<AdminSettings>) => void;
    updateTag: (tagId: string, update: Partial<LocalArchiveTag>) => void;
  };
  archive: LocalAdminArchive;
  error?: string;
  hydrated: boolean;
  previewUrls: Record<string, string>;
  syncState: SyncState;
};

const CloudAdminContext = createContext<CloudAdminContextValue | null>(null);
const previewUrls: Record<string, string> = {};

export function CloudAdminArchiveProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [archive, setArchive] = useState<LocalAdminArchive>(emptyArchive);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string>();
  const [pendingWrites, setPendingWrites] = useState(0);
  const archiveRef = useRef(archive);
  const mutationChainRef = useRef<Promise<void>>(Promise.resolve());
  const debounceTimersRef = useRef(new Map<string, number>());

  useEffect(() => {
    archiveRef.current = archive;
  }, [archive]);

  const replaceArchive = useCallback((next: AdminArchive) => {
    const normalized = next as LocalAdminArchive;
    archiveRef.current = normalized;
    setArchive(normalized);
  }, []);

  const loadArchive = useCallback(async () => {
    try {
      replaceArchive(await readCloudflareArchive());
      setError(undefined);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setHydrated(true);
    }
  }, [replaceArchive]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => void loadArchive(), 0);
    const timers = debounceTimersRef.current;
    return () => {
      window.clearTimeout(loadTimer);
      for (const timer of timers.values()) window.clearTimeout(timer);
      timers.clear();
    };
  }, [loadArchive]);

  const runMutation = useCallback(async (
    mutation: CloudArchiveMutation,
    refresh = false
  ) => {
    setPendingWrites((count) => count + 1);
    try {
      const result = await mutateCloudflareArchive(mutation);
      setError(undefined);
      if (refresh) await loadArchive();
      return result;
    } catch (mutationError) {
      setError(errorMessage(mutationError));
      await loadArchive();
      return undefined;
    } finally {
      setPendingWrites((count) => Math.max(0, count - 1));
    }
  }, [loadArchive]);

  const enqueueMutation = useCallback((mutation: CloudArchiveMutation, refresh = false) => {
    let result: { id?: string } | undefined;
    const task = mutationChainRef.current.then(async () => {
      result = await runMutation(mutation, refresh);
    });
    mutationChainRef.current = task.catch(() => undefined);
    return task.then(() => result);
  }, [runMutation]);

  const debounceMutation = useCallback((key: string, mutation: CloudArchiveMutation) => {
    const timers = debounceTimersRef.current;
    const current = timers.get(key);
    if (current) window.clearTimeout(current);
    timers.set(key, window.setTimeout(() => {
      timers.delete(key);
      void enqueueMutation(mutation);
    }, 450));
  }, [enqueueMutation]);

  const optimistic = useCallback((update: (current: LocalAdminArchive) => LocalAdminArchive) => {
    setArchive((current) => {
      const next = update(current);
      archiveRef.current = next;
      return next;
    });
  }, []);

  const actions = useMemo<CloudAdminContextValue["actions"]>(() => ({
    addAlbumToSet(setId, albumId) {
      void enqueueMutation({ action: "addAlbumToSet", setId, albumId }, true);
    },
    async addExistingPhotoToAlbum(photoId, albumId) {
      const result = await enqueueMutation({ action: "addPhotoToAlbum", albumId, photoId }, true);
      return result?.id;
    },
    async addPhotosToAlbum(albumId, files) {
      const failures: string[] = [];
      const uploads = files.flatMap((file) => {
        try {
          assertUploadFile(file);
          return [{
            clientUploadId: crypto.randomUUID(),
            file,
            jobId: `runtime-${crypto.randomUUID()}`
          }];
        } catch (error) {
          failures.push(`${file.name}: ${errorMessage(error)}`);
          return [];
        }
      });
      if (!uploads.length) {
        setError(uploadFailureMessage(failures));
        return;
      }
      optimistic((current) => ({
        ...current,
        uploadJobs: [
          ...uploads.map(({ file, jobId }) => ({
            id: jobId,
            albumId,
            fileName: file.name,
            status: "queued" as const,
            progress: 0,
            bytes: file.size,
            derivatives: (["thumb", "display", "expanded"] as const).map((version) => ({
              version,
              status: "queued" as const,
              progress: 0
            })),
            createdAt: timestamp()
          })),
          ...current.uploadJobs
        ]
      }));
      setPendingWrites((count) => count + 1);
      try {
        for (const { clientUploadId, file, jobId } of uploads) {
          try {
            updateRuntimeUpload(optimistic, jobId, "processing", 25);
            const prepared = await prepareJpegUpload(file);
            updateRuntimeUpload(optimistic, jobId, "uploading", 60);
            await uploadCloudflareJpeg(albumId, {
              clientUploadId,
              display: prepared.display,
              expanded: prepared.expanded,
              file,
              height: prepared.height,
              thumb: prepared.thumb,
              width: prepared.width
            });
            updateRuntimeUpload(optimistic, jobId, "review", 100);
          } catch (uploadError) {
            failures.push(`${file.name}: ${errorMessage(uploadError)}`);
            updateRuntimeUpload(optimistic, jobId, "failed", 100);
          }
        }
        await loadArchive();
        if (failures.length) setError(uploadFailureMessage(failures));
      } finally {
        setPendingWrites((count) => Math.max(0, count - 1));
      }
    },
    attachAlbumTag(albumId, tagId) {
      optimistic((current) => ({
        ...current,
        albums: current.albums.map((album) =>
          album.id === albumId && !album.tagIds.includes(tagId)
            ? { ...album, tagIds: [...album.tagIds, tagId] }
            : album
        )
      }));
      void enqueueMutation({ action: "attachAlbumTag", albumId, tagId });
    },
    async createAlbum(input) {
      setPendingWrites((count) => count + 1);
      try {
        const album = await createCloudflareAlbum({
          title: input.title,
          subtitle: input.subtitle,
          status: input.status,
          publicDownloadPolicy: input.publicDownloadPolicy
        });
        for (const setId of input.setIds ?? []) {
          await mutateCloudflareArchive({ action: "addAlbumToSet", setId, albumId: album.id });
        }
        for (const tagId of input.tagIds ?? []) {
          await mutateCloudflareArchive({ action: "attachAlbumTag", albumId: album.id, tagId });
        }
        await loadArchive();
        return album.id;
      } catch (createError) {
        setError(errorMessage(createError));
        return "";
      } finally {
        setPendingWrites((count) => Math.max(0, count - 1));
      }
    },
    async createSet(input) {
      const result = await enqueueMutation({
        action: "createSet",
        title: input.title,
        subtitle: input.subtitle,
        status: input.status,
        layoutMode: input.layoutMode === "custom" ? undefined : input.layoutMode
      }, true);
      return result?.id ?? "";
    },
    async createTag(input) {
      const existing = archiveRef.current.tags.find((tag) =>
        tag.label.toLowerCase() === input.label.trim().toLowerCase()
      );
      if (existing) return existing.id;
      const result = await enqueueMutation({
        action: "createTag",
        label: input.label,
        scope: input.scope
      }, true);
      return result?.id ?? "";
    },
    deleteTag(tagId) {
      void enqueueMutation({ action: "deleteTag", tagId }, true);
    },
    detachAlbumTag(albumId, tagId) {
      optimistic((current) => ({
        ...current,
        albums: current.albums.map((album) =>
          album.id === albumId
            ? { ...album, tagIds: album.tagIds.filter((id) => id !== tagId) }
            : album
        )
      }));
      void enqueueMutation({ action: "detachAlbumTag", albumId, tagId });
    },
    hidePhoto(photoId) {
      updatePhotoOptimistically(optimistic, photoId, { status: "hidden", hiddenAt: timestamp() });
      void enqueueMutation({ action: "updatePhoto", photoId, update: { status: "hidden" } });
    },
    movePhotoToPosition(albumId, photoId, position) {
      void enqueueMutation({ action: "movePhoto", albumId, photoId, position }, true);
    },
    moveAlbumToPosition(albumId, position) {
      void enqueueMutation({ action: "moveAlbum", albumId, position }, true);
    },
    async purgeItem(itemId) {
      await enqueueMutation({ action: "purgeItem", itemId }, true);
    },
    async removePhotoFromAlbum(albumId, photoId) {
      await enqueueMutation({ action: "removePhotoFromAlbum", albumId, photoId }, true);
    },
    removeAlbumFromSet(setId, albumId) {
      void enqueueMutation({ action: "removeAlbumFromSet", setId, albumId }, true);
    },
    reorderAlbum(albumId, direction) {
      void enqueueMutation({ action: "reorderAlbum", albumId, direction }, true);
    },
    reorderAlbumInSet(setId, albumId, direction) {
      void enqueueMutation({ action: "reorderAlbumInSet", setId, albumId, direction }, true);
    },
    reorderPhoto(albumId, photoId, direction) {
      const photos = getPhotosForAlbumFromArchive(archiveRef.current, albumId);
      const index = photos.findIndex((photo) => photo.id === photoId);
      const target = photos[direction === "up" ? index - 1 : index + 1];
      if (index < 0 || !target) return;
      void enqueueMutation({
        action: "movePhoto",
        albumId,
        photoId,
        position: target.position
      }, true);
    },
    reorderSet(setId, direction) {
      void enqueueMutation({ action: "reorderSet", setId, direction }, true);
    },
    async refreshArchive() {
      await loadArchive();
    },
    async restoreItem(itemId) {
      await enqueueMutation({ action: "restoreItem", itemId }, true);
    },
    setAlbumCover(albumId, coverType, assetId) {
      optimistic((current) => ({
        ...current,
        albums: current.albums.map((album) => album.id === albumId
          ? {
              ...album,
              ...(coverType === "landscape"
                ? { coverLandscapeAssetId: assetId }
                : coverType === "portrait"
                  ? { coverPortraitAssetId: assetId }
                  : { coverSquareAssetId: assetId })
            }
          : album)
      }));
      void enqueueMutation({ action: "setAlbumCover", albumId, coverType, assetId });
    },
    showPhoto(photoId) {
      updatePhotoOptimistically(optimistic, photoId, { status: "review", hiddenAt: undefined });
      void enqueueMutation({ action: "updatePhoto", photoId, update: { status: "review" } });
    },
    async trashAlbum(albumId) {
      await enqueueMutation({ action: "trashAlbum", albumId }, true);
    },
    async trashPhoto(photoId) {
      await enqueueMutation({ action: "trashPhoto", photoId }, true);
    },
    async trashSet(setId) {
      await enqueueMutation({ action: "trashSet", setId }, true);
    },
    updateAlbum(albumId, update) {
      optimistic((current) => ({
        ...current,
        albums: current.albums.map((album) => album.id === albumId ? { ...album, ...update } : album)
      }));
      for (const [field, value] of Object.entries(pickAlbumUpdate(update))) {
        debounceMutation(`album:${albumId}:${field}`, {
          action: "updateAlbum",
          albumId,
          update: { [field]: value }
        } as CloudArchiveMutation);
      }
    },
    updatePhoto(photoId, update) {
      updatePhotoOptimistically(optimistic, photoId, update);
      for (const [field, value] of Object.entries(pickPhotoUpdate(update))) {
        debounceMutation(`photo:${photoId}:${field}`, {
          action: "updatePhoto",
          photoId,
          update: { [field]: value }
        } as CloudArchiveMutation);
      }
    },
    updateSet(setId, update) {
      optimistic((current) => ({
        ...current,
        sets: current.sets.map((set) => set.id === setId ? { ...set, ...update } : set)
      }));
      for (const [field, value] of Object.entries(pickSetUpdate(update))) {
        debounceMutation(`set:${setId}:${field}`, {
          action: "updateSet",
          setId,
          update: { [field]: value }
        } as CloudArchiveMutation);
      }
    },
    updateSettings(update) {
      optimistic((current) => ({ ...current, settings: { ...current.settings, ...update } }));
      for (const [field, value] of Object.entries(update)) {
        debounceMutation(`settings:${field}`, {
          action: "updateSettings",
          update: { [field]: value }
        } as CloudArchiveMutation);
      }
    },
    updateTag(tagId, update) {
      optimistic((current) => ({
        ...current,
        tags: current.tags.map((tag) => tag.id === tagId ? { ...tag, ...update } : tag)
      }));
      for (const [field, value] of Object.entries(pickTagUpdate(update))) {
        debounceMutation(`tag:${tagId}:${field}`, {
          action: "updateTag",
          tagId,
          update: { [field]: value }
        } as CloudArchiveMutation);
      }
    }
  }), [debounceMutation, enqueueMutation, loadArchive, optimistic]);

  const value = useMemo<CloudAdminContextValue>(() => ({
    actions,
    archive,
    error,
    hydrated,
    previewUrls,
    syncState: !hydrated ? "loading" : error ? "error" : pendingWrites ? "saving" : "saved"
  }), [actions, archive, error, hydrated, pendingWrites]);

  return <CloudAdminContext.Provider value={value}>{children}</CloudAdminContext.Provider>;
}

export function useAdminArchive() {
  const value = useContext(CloudAdminContext);
  if (!value) throw new Error("useAdminArchive must be used inside CloudAdminArchiveProvider");
  return value;
}

function emptyArchive(): LocalAdminArchive {
  return {
    sets: [],
    albums: [],
    albumPhotos: [],
    photos: [],
    assets: [],
    tags: [],
    collections: [],
    settings: defaultAdminSettings,
    trash: [],
    uploadJobs: []
  };
}

function updatePhotoOptimistically(
  updateArchive: (update: (current: LocalAdminArchive) => LocalAdminArchive) => void,
  photoId: string,
  update: Partial<LocalArchivePhoto>
) {
  updateArchive((current) => ({
    ...current,
    photos: current.photos.map((photo) => photo.id === photoId ? { ...photo, ...update } : photo)
  }));
}

function updateRuntimeUpload(
  updateArchive: (update: (current: LocalAdminArchive) => LocalAdminArchive) => void,
  jobId: string,
  status: "processing" | "uploading" | "review" | "failed",
  progress: number
) {
  updateArchive((current) => ({
    ...current,
    uploadJobs: current.uploadJobs.map((job) => job.id === jobId
      ? {
          ...job,
          status,
          progress,
          derivatives: job.derivatives.map((derivative) => ({
            ...derivative,
            status: status === "failed"
              ? "failed"
              : progress === 100
              ? "done"
              : status === "processing"
                ? "processing"
                : derivative.status,
            progress
          }))
        }
      : job)
  }));
}

function pickAlbumUpdate(update: Partial<ArchiveAlbum>) {
  const {
    title,
    subtitle,
    status,
    publicDownloadPolicy,
    photoOrderDirection,
    coverPriority
  } = update;
  return compact({ title, subtitle, status, publicDownloadPolicy, photoOrderDirection, coverPriority });
}

function pickPhotoUpdate(update: Partial<ArchivePhoto>) {
  const { title, status, publicDownloadOverride, tagIds } = update;
  return compact({
    title,
    status,
    publicDownloadOverride: publicDownloadOverride ?? (Object.hasOwn(update, "publicDownloadOverride") ? null : undefined),
    tagIds
  });
}

function pickSetUpdate(update: Partial<ArchiveSet>) {
  const { title, subtitle, status, layoutMode } = update;
  return compact({ title, subtitle, status, layoutMode });
}

function pickTagUpdate(update: Partial<ArchiveTag>) {
  const { label, scope } = update;
  return compact({ label, scope });
}

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function assertUploadFile(file: File) {
  if (file.type !== "image/jpeg" && !/\.jpe?g$/i.test(file.name)) {
    throw new Error(`${file.name} is not a JPEG file.`);
  }
  if (!file.size || file.size > 20 * 1024 * 1024) {
    throw new Error(`${file.name} must be between 1 byte and 20 MiB.`);
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Cloudflare archive request failed.";
}

function uploadFailureMessage(failures: string[]) {
  const details = failures.slice(0, 3).join(" ");
  const remaining = failures.length > 3 ? ` ${failures.length - 3} more failed.` : "";
  return `${failures.length} JPEG${failures.length === 1 ? "" : "s"} failed. ${details}${remaining}`;
}

function timestamp() {
  return new Date().toISOString();
}
