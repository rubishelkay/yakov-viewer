"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState
} from "react";

import { adminArchive } from "@/admin/mock-data";

import type {
  AdminArchive,
  AdminSettings,
  ArchiveAlbum,
  ArchiveAsset,
  ArchivePhoto,
  ArchiveSet,
  ArchiveStatus,
  ArchiveTag,
  PublicDownloadPolicy,
  SetLayoutMode,
  TagScope,
  TrashItem,
  UploadJob
} from "./archive-schema";
import {
  clearPreviewBlobs,
  deletePreviewBlob,
  getPreviewBlob,
  savePreviewBlob
} from "./local-preview-store";

const STORAGE_KEY = "yakov-admin-archive-v2";
const STORAGE_VERSION = 2;
const TEMP_ADMIN_PREVIEW_PREFIX = "/_admin-previews/";
const TEMP_R2_SEED_HOST = "pub-500a8cf5bb2a4e3db51ea0c9789e6e88.r2.dev";

export type LocalArchiveAsset = ArchiveAsset & {
  localPreviewId?: string;
  sourceBytes?: number;
  sourceFileName?: string;
};

export type LocalArchivePhoto = ArchivePhoto & {
  isDirty?: boolean;
  localPreviewId?: string;
  sourceBytes?: number;
  sourceFileName?: string;
};

export type LocalArchiveAlbum = ArchiveAlbum & {
  coverPriority?: "landscape" | "portrait" | "square";
  isDirty?: boolean;
};

export type LocalArchiveSet = ArchiveSet & {
  isDirty?: boolean;
};

export type LocalArchiveTag = ArchiveTag & {
  isDirty?: boolean;
};

export type LocalAdminArchive = Omit<AdminArchive, "sets" | "albums" | "photos" | "assets" | "tags"> & {
  sets: LocalArchiveSet[];
  albums: LocalArchiveAlbum[];
  photos: LocalArchivePhoto[];
  assets: LocalArchiveAsset[];
  tags: LocalArchiveTag[];
};

type CreateAlbumInput = {
  title: string;
  subtitle?: string;
  status?: ArchiveStatus;
  setIds?: string[];
  tagIds?: string[];
  publicDownloadPolicy?: PublicDownloadPolicy;
};

type CreateSetInput = {
  title: string;
  subtitle?: string;
  status?: ArchiveStatus;
  layoutMode?: SetLayoutMode;
};

type CreateTagInput = {
  label: string;
  scope?: TagScope;
};

type AddPhotoPayload = {
  albumId: string;
  assets: LocalArchiveAsset[];
  job: UploadJob;
  photo: LocalArchivePhoto;
};

type AdminAction =
  | { type: "replace"; archive: LocalAdminArchive }
  | { type: "createAlbum"; album: LocalArchiveAlbum }
  | { type: "updateAlbum"; albumId: string; update: Partial<LocalArchiveAlbum> }
  | { type: "reorderAlbum"; albumId: string; direction: "up" | "down" }
  | { type: "trashAlbum"; albumId: string; trashItem: TrashItem; now: string }
  | { type: "addExistingPhotoToAlbum"; photo: LocalArchivePhoto; albumId: string; now: string }
  | { type: "addPhotosToAlbum"; payloads: AddPhotoPayload[]; now: string }
  | { type: "updatePhoto"; photoId: string; update: Partial<LocalArchivePhoto> }
  | { type: "reorderPhoto"; albumId: string; photoId: string; direction: "up" | "down" }
  | { type: "movePhotoToPosition"; albumId: string; photoId: string; position: number }
  | { type: "trashPhoto"; photoId: string; trashItem: TrashItem; now: string }
  | { type: "setAlbumCover"; albumId: string; coverType: "landscape" | "portrait" | "square"; assetId: string }
  | { type: "createSet"; set: LocalArchiveSet }
  | { type: "updateSet"; setId: string; update: Partial<LocalArchiveSet> }
  | { type: "trashSet"; setId: string; trashItem: TrashItem; now: string }
  | { type: "reorderSet"; setId: string; direction: "up" | "down" }
  | { type: "addAlbumToSet"; setId: string; albumId: string; now: string }
  | { type: "removeAlbumFromSet"; setId: string; albumId: string; now: string }
  | { type: "reorderAlbumInSet"; setId: string; albumId: string; direction: "left" | "right" }
  | { type: "createTag"; tag: LocalArchiveTag }
  | { type: "updateTag"; tagId: string; update: Partial<LocalArchiveTag> }
  | { type: "deleteTag"; tagId: string }
  | { type: "attachAlbumTag"; albumId: string; tagId: string; now: string }
  | { type: "detachAlbumTag"; albumId: string; tagId: string; now: string }
  | { type: "updateSettings"; update: Partial<AdminSettings> }
  | { type: "restoreItem"; itemId: string; now: string }
  | { type: "purgeItem"; itemId: string };

type AdminArchiveContextValue = {
  actions: {
    addAlbumToSet: (setId: string, albumId: string) => void;
    addExistingPhotoToAlbum: (photoId: string, albumId: string) => string | undefined;
    addPhotosToAlbum: (albumId: string, files: File[]) => Promise<void>;
    attachAlbumTag: (albumId: string, tagId: string) => void;
    createAlbum: (input: CreateAlbumInput) => string;
    createSet: (input: CreateSetInput) => string;
    createTag: (input: CreateTagInput) => string;
    deleteTag: (tagId: string) => void;
    detachAlbumTag: (albumId: string, tagId: string) => void;
    hidePhoto: (photoId: string) => void;
    movePhotoToPosition: (albumId: string, photoId: string, position: number) => void;
    purgeItem: (itemId: string) => Promise<void>;
    removeAlbumFromSet: (setId: string, albumId: string) => void;
    reorderAlbum: (albumId: string, direction: "up" | "down") => void;
    reorderAlbumInSet: (setId: string, albumId: string, direction: "left" | "right") => void;
    reorderPhoto: (albumId: string, photoId: string, direction: "up" | "down") => void;
    reorderSet: (setId: string, direction: "up" | "down") => void;
    resetLocalArchive: () => Promise<void>;
    restoreItem: (itemId: string) => void;
    setAlbumCover: (albumId: string, coverType: "landscape" | "portrait" | "square", assetId: string) => void;
    showPhoto: (photoId: string) => void;
    trashAlbum: (albumId: string) => void;
    trashPhoto: (photoId: string) => void;
    trashSet: (setId: string) => void;
    updateAlbum: (albumId: string, update: Partial<LocalArchiveAlbum>) => void;
    updatePhoto: (photoId: string, update: Partial<LocalArchivePhoto>) => void;
    updateSet: (setId: string, update: Partial<LocalArchiveSet>) => void;
    updateSettings: (update: Partial<AdminSettings>) => void;
    updateTag: (tagId: string, update: Partial<LocalArchiveTag>) => void;
  };
  archive: LocalAdminArchive;
  hydrated: boolean;
  previewUrls: Record<string, string>;
};

const AdminArchiveContext = createContext<AdminArchiveContextValue | null>(null);

export function AdminArchiveProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [archive, dispatch] = useReducer(adminArchiveReducer, seedArchive());
  const [hydrated, setHydrated] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const previewUrlsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const saved = readStoredArchive();

    if (saved) {
      dispatch({ type: "replace", archive: saved });
    }

    queueMicrotask(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        archive
      })
    );
  }, [archive, hydrated]);

  useEffect(() => {
    let cancelled = false;
    const previewIds = new Set(
      archive.assets
        .map((asset) => asset.localPreviewId)
        .filter((previewId): previewId is string => Boolean(previewId))
    );

    async function loadUrls() {
      const currentUrls = previewUrlsRef.current;
      const nextUrls: Record<string, string> = {};

      for (const previewId of previewIds) {
        if (currentUrls[previewId]) {
          nextUrls[previewId] = currentUrls[previewId];
          continue;
        }

        const blob = await getPreviewBlob(previewId);
        if (blob && !cancelled) {
          nextUrls[previewId] = URL.createObjectURL(blob);
        }
      }

      for (const [previewId, url] of Object.entries(currentUrls)) {
        if (!previewIds.has(previewId)) {
          URL.revokeObjectURL(url);
        }
      }

      if (!cancelled) {
        previewUrlsRef.current = nextUrls;
        setPreviewUrls(nextUrls);
      }
    }

    loadUrls();

    return () => {
      cancelled = true;
    };
  }, [archive.assets]);

  useEffect(() => {
    const urlsRef = previewUrlsRef;

    return () => {
      for (const url of Object.values(urlsRef.current)) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const actions = useMemo<AdminArchiveContextValue["actions"]>(
    () => ({
      addAlbumToSet(setId, albumId) {
        dispatch({ type: "addAlbumToSet", setId, albumId, now: now() });
      },
      addExistingPhotoToAlbum(photoId, albumId) {
        const sourcePhoto = archive.photos.find((photo) => photo.id === photoId);
        const targetAlbum = archive.albums.find((album) => album.id === albumId);
        if (!sourcePhoto || !targetAlbum) return undefined;

        const canonicalPhotoId = getCanonicalPhotoId(sourcePhoto);
        const existingReference = archive.photos.find((photo) =>
          photo.albumId === albumId &&
          photo.status !== "deleted" &&
          photo.status !== "trash" &&
          getCanonicalPhotoId(photo) === canonicalPhotoId
        );
        if (existingReference) return existingReference.id;

        const existingPositions = archive.photos
          .filter((photo) => photo.albumId === albumId)
          .map((photo) => photo.position);
        const position = existingPositions.length ? Math.max(...existingPositions) + 1 : 1;
        const timestamp = now();
        const slug = uniqueSlug(`${sourcePhoto.slug}-${targetAlbum.slug}`, archive.photos.map((photo) => photo.slug));
        const linkedPhoto: LocalArchivePhoto = {
          ...sourcePhoto,
          id: uniqueId(`photo-link-${slug}`),
          albumId,
          originAlbumId: sourcePhoto.originAlbumId ?? sourcePhoto.albumId,
          slug,
          sourcePhotoId: canonicalPhotoId,
          status: archive.settings.defaultPhotoStatus,
          position,
          frameNumber: position,
          createdAt: timestamp,
          updatedAt: timestamp,
          publishedAt: undefined,
          hiddenAt: undefined,
          deletedAt: undefined,
          isDirty: true
        };

        dispatch({ type: "addExistingPhotoToAlbum", albumId, photo: linkedPhoto, now: timestamp });
        return linkedPhoto.id;
      },
      async addPhotosToAlbum(albumId, files) {
        const album = archive.albums.find((item) => item.id === albumId);
        if (!album || !files.length) return;

        const existingPositions = archive.photos
          .filter((photo) => photo.albumId === albumId)
          .map((photo) => photo.position);
        const firstPosition = existingPositions.length ? Math.max(...existingPositions) + 1 : 1;
        const timestamp = now();
        const payloads: AddPhotoPayload[] = [];

        for (const [index, file] of files.entries()) {
          const position = firstPosition + index;
          const baseId = uniqueId(`photo-${album.slug || slugify(album.title)}-${position}`);
          const sourcePreviewId = uniqueId("preview-source");
          const thumbPreviewId = uniqueId("preview-thumb");
          const photoId = baseId;
          const dimensions = await readImageDimensions(file).catch(() => ({ width: 1600, height: 1066 }));
          const thumbBlob = await createAdminThumbnailBlob(file, dimensions).catch(() => file);

          await savePreviewBlob(sourcePreviewId, file);
          await savePreviewBlob(thumbPreviewId, thumbBlob);

          const objectUrl = URL.createObjectURL(file);
          const thumbObjectUrl = URL.createObjectURL(thumbBlob);
          previewUrlsRef.current = {
            ...previewUrlsRef.current,
            [sourcePreviewId]: objectUrl,
            [thumbPreviewId]: thumbObjectUrl
          };
          setPreviewUrls(previewUrlsRef.current);

          const photo: LocalArchivePhoto = {
            id: photoId,
            albumId,
            slug: photoId.replace(/^photo-/, ""),
            title: file.name.replace(/\.[^.]+$/, ""),
            description: "",
            status: archive.settings.defaultPhotoStatus,
            position,
            frameNumber: position,
            tagIds: [],
            assetIds: [
              assetId(photoId, "thumb"),
              assetId(photoId, "display"),
              assetId(photoId, "expanded"),
              assetId(photoId, "downloadJpeg"),
              assetId(photoId, "sourceJpeg")
            ],
            width: dimensions.width,
            height: dimensions.height,
            dominantColor: "#1c1b18",
            createdAt: timestamp,
            updatedAt: timestamp,
            localPreviewId: sourcePreviewId,
            sourceBytes: file.size,
            sourceFileName: file.name,
            isDirty: true
          };

          payloads.push({
            albumId,
            photo,
            assets: makeLocalAssets(photo, file, {
              sourcePreviewId,
              thumbBytes: thumbBlob.size,
              thumbPreviewId
            }, timestamp),
            job: makeLocalUploadJob(albumId, file, index, timestamp)
          });
        }

        dispatch({ type: "addPhotosToAlbum", payloads, now: timestamp });
      },
      attachAlbumTag(albumId, tagId) {
        dispatch({ type: "attachAlbumTag", albumId, tagId, now: now() });
      },
      createAlbum(input) {
        const timestamp = now();
        const title = input.title.trim();
        const slug = uniqueSlug(title, archive.albums.map((album) => album.slug));
        const id = uniqueId(`album-${slug}`);
        const album: LocalArchiveAlbum = {
          id,
          slug,
          title,
          subtitle: input.subtitle?.trim() ?? "",
          description: "",
          status: input.status ?? archive.settings.defaultAlbumStatus,
          setIds: input.setIds ?? [],
          tagIds: input.tagIds ?? [],
          publicDownloadPolicy: input.publicDownloadPolicy ?? archive.settings.publicDownloadMode,
          sortOrder: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
          isDirty: true
        };

        dispatch({ type: "createAlbum", album });

        for (const setId of album.setIds) {
          dispatch({ type: "addAlbumToSet", setId, albumId: id, now: timestamp });
        }

        return id;
      },
      createSet(input) {
        const timestamp = now();
        const title = input.title.trim();
        const slug = uniqueSlug(title, archive.sets.map((set) => set.slug));
        const id = uniqueId(`set-${slug}`);
        const set: LocalArchiveSet = {
          id,
          slug,
          title,
          subtitle: input.subtitle?.trim() ?? "",
          description: input.subtitle?.trim() ?? "",
          status: input.status ?? "draft",
          order: archive.sets.length + 1,
          layoutMode: input.layoutMode ?? "six-grid",
          albumIdsWithOrder: [],
          createdAt: timestamp,
          updatedAt: timestamp,
          isDirty: true
        };

        dispatch({ type: "createSet", set });
        return id;
      },
      createTag(input) {
        const timestamp = now();
        const label = input.label.trim();
        const existingTag = archive.tags.find((tag) =>
          tag.label.toLowerCase() === label.toLowerCase() || tag.slug === slugify(label)
        );

        if (existingTag) return existingTag.id;

        const slug = uniqueSlug(label, archive.tags.map((tag) => tag.slug));
        const id = uniqueId(`tag-${slug}`);
        const tag: LocalArchiveTag = {
          id,
          slug,
          label,
          scope: input.scope ?? "both",
          createdAt: timestamp,
          isDirty: true
        };

        dispatch({ type: "createTag", tag });
        return id;
      },
      deleteTag(tagId) {
        dispatch({ type: "deleteTag", tagId });
      },
      detachAlbumTag(albumId, tagId) {
        dispatch({ type: "detachAlbumTag", albumId, tagId, now: now() });
      },
      hidePhoto(photoId) {
        dispatch({ type: "updatePhoto", photoId, update: { status: "hidden", hiddenAt: now(), isDirty: true } });
      },
      movePhotoToPosition(albumId, photoId, position) {
        dispatch({ type: "movePhotoToPosition", albumId, photoId, position });
      },
      async purgeItem(itemId) {
        const previewIds = previewIdsForTrashItem(archive, itemId);
        await Promise.all(previewIds.map(deletePreviewBlob));
        dispatch({ type: "purgeItem", itemId });
      },
      removeAlbumFromSet(setId, albumId) {
        dispatch({ type: "removeAlbumFromSet", setId, albumId, now: now() });
      },
      reorderAlbum(albumId, direction) {
        dispatch({ type: "reorderAlbum", albumId, direction });
      },
      reorderAlbumInSet(setId, albumId, direction) {
        dispatch({ type: "reorderAlbumInSet", setId, albumId, direction });
      },
      reorderPhoto(albumId, photoId, direction) {
        dispatch({ type: "reorderPhoto", albumId, photoId, direction });
      },
      reorderSet(setId, direction) {
        dispatch({ type: "reorderSet", setId, direction });
      },
      async resetLocalArchive() {
        localStorage.removeItem(STORAGE_KEY);
        await clearPreviewBlobs();
        for (const url of Object.values(previewUrlsRef.current)) {
          URL.revokeObjectURL(url);
        }
        previewUrlsRef.current = {};
        setPreviewUrls({});
        dispatch({ type: "replace", archive: seedArchive() });
      },
      restoreItem(itemId) {
        dispatch({ type: "restoreItem", itemId, now: now() });
      },
      setAlbumCover(albumId, coverType, assetIdValue) {
        dispatch({ type: "setAlbumCover", albumId, coverType, assetId: assetIdValue });
      },
      showPhoto(photoId) {
        dispatch({ type: "updatePhoto", photoId, update: { status: "review", hiddenAt: undefined, isDirty: true } });
      },
      trashAlbum(albumId) {
        const album = archive.albums.find((item) => item.id === albumId);
        if (!album) return;
        dispatch({ type: "trashAlbum", albumId, trashItem: makeTrashItem(archive, "album", albumId, album.title), now: now() });
      },
      trashPhoto(photoId) {
        const photo = archive.photos.find((item) => item.id === photoId);
        if (!photo) return;
        dispatch({ type: "trashPhoto", photoId, trashItem: makeTrashItem(archive, "photo", photoId, photo.title), now: now() });
      },
      trashSet(setId) {
        const set = archive.sets.find((item) => item.id === setId);
        if (!set) return;
        dispatch({ type: "trashSet", setId, trashItem: makeTrashItem(archive, "set", setId, set.title), now: now() });
      },
      updateAlbum(albumId, update) {
        dispatch({ type: "updateAlbum", albumId, update: { ...update, isDirty: true } });
      },
      updatePhoto(photoId, update) {
        dispatch({ type: "updatePhoto", photoId, update: { ...update, isDirty: true } });
      },
      updateSet(setId, update) {
        dispatch({ type: "updateSet", setId, update: { ...update, isDirty: true } });
      },
      updateSettings(update) {
        dispatch({ type: "updateSettings", update });
      },
      updateTag(tagId, update) {
        dispatch({ type: "updateTag", tagId, update: { ...update, isDirty: true } });
      }
    }),
    [archive]
  );

  const value = useMemo(
    () => ({ actions, archive, hydrated, previewUrls }),
    [actions, archive, hydrated, previewUrls]
  );

  return <AdminArchiveContext.Provider value={value}>{children}</AdminArchiveContext.Provider>;
}

export function useAdminArchive() {
  const value = useContext(AdminArchiveContext);

  if (!value) {
    throw new Error("useAdminArchive must be used inside AdminArchiveProvider");
  }

  return value;
}

export function getAlbumCoverUrlFromArchive(
  archive: LocalAdminArchive,
  previewUrls: Record<string, string>,
  album: LocalArchiveAlbum | undefined,
  coverType: "landscape" | "portrait" | "square" = "landscape"
) {
  if (!album) return undefined;
  const assetIdValue =
    coverType === "portrait"
      ? album.coverPortraitAssetId
      : coverType === "square"
        ? album.coverSquareAssetId
        : album.coverLandscapeAssetId;

  return getAssetUrlFromArchive(archive, previewUrls, assetIdValue);
}

export function getPhotoDisplayUrlFromArchive(
  archive: LocalAdminArchive,
  previewUrls: Record<string, string>,
  photo: LocalArchivePhoto | undefined
) {
  const displayAssetId = photo?.assetIds.find((id) => id.endsWith("-display")) ?? photo?.assetIds[0];

  return getAssetUrlFromArchive(archive, previewUrls, displayAssetId);
}

export function getPhotoThumbnailUrlFromArchive(
  archive: LocalAdminArchive,
  previewUrls: Record<string, string>,
  photo: LocalArchivePhoto | undefined
) {
  const thumbAssetId = photo?.assetIds.find((id) => id.endsWith("-thumb"))
    ?? photo?.assetIds.find((id) => id.endsWith("-display"))
    ?? photo?.assetIds[0];

  return getAssetUrlFromArchive(archive, previewUrls, thumbAssetId, { preferTemporaryPreview: true });
}

export function getAlbumCoverPreviewUrlFromArchive(
  archive: LocalAdminArchive,
  previewUrls: Record<string, string>,
  album: LocalArchiveAlbum | undefined,
  coverType?: "landscape" | "portrait" | "square"
) {
  if (!album) return undefined;
  const coverAssetId = coverType === "portrait"
    ? album.coverPortraitAssetId
    : coverType === "square"
      ? album.coverSquareAssetId
      : coverType === "landscape"
        ? album.coverLandscapeAssetId
        : album.coverSquareAssetId ?? album.coverLandscapeAssetId ?? album.coverPortraitAssetId;
  const coverAsset = archive.assets.find((asset) => asset.id === coverAssetId);
  const coverPhotoId = coverAsset?.photoId;
  const thumbAssetId = coverPhotoId
    ? archive.assets.find((asset) => asset.photoId === coverPhotoId && asset.version === "thumb")?.id
    : undefined;

  return getAssetUrlFromArchive(archive, previewUrls, thumbAssetId ?? coverAssetId, { preferTemporaryPreview: true });
}

export function getAssetUrlFromArchive(
  archive: LocalAdminArchive,
  previewUrls: Record<string, string>,
  assetIdValue: string | undefined,
  options: { preferTemporaryPreview?: boolean } = {}
) {
  if (!assetIdValue) return undefined;
  const asset = archive.assets.find((item) => item.id === assetIdValue);

  if (!asset) return undefined;
  if (asset.localPreviewId && previewUrls[asset.localPreviewId]) return previewUrls[asset.localPreviewId];
  if (options.preferTemporaryPreview && asset.version === "thumb") {
    const temporaryUrl = getTemporaryAdminPreviewUrl(asset.publicUrl);

    if (temporaryUrl) return temporaryUrl;
  }

  return asset.publicUrl;
}

export function getOrderedSetsFromArchive(archive: LocalAdminArchive) {
  return [...archive.sets]
    .filter((set) => set.status !== "trash" && set.status !== "deleted")
    .sort((a, b) => a.order - b.order);
}

export function getOrderedAlbumsFromArchive(archive: LocalAdminArchive) {
  return [...archive.albums]
    .filter((album) => album.status !== "trash" && album.status !== "deleted")
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getPhotosForAlbumFromArchive(archive: LocalAdminArchive, albumId: string | undefined) {
  if (!albumId) return [];

  return archive.photos
    .filter((photo) => photo.albumId === albumId && photo.status !== "trash" && photo.status !== "deleted")
    .sort((a, b) => a.position - b.position);
}

export function getEffectivePhotoTagIdsFromArchive(
  archive: LocalAdminArchive,
  photo: LocalArchivePhoto | undefined
) {
  if (!photo) return [];
  const album = archive.albums.find((item) => item.id === photo.albumId);

  return Array.from(new Set([...(album?.tagIds ?? []), ...photo.tagIds]));
}

export function getTagUsageFromArchive(archive: LocalAdminArchive, tagId: string) {
  const albumCount = archive.albums.filter((album) =>
    album.status !== "deleted" && album.tagIds.includes(tagId)
  ).length;
  const directPhotoCount = archive.photos.filter((photo) =>
    photo.status !== "deleted" && photo.tagIds.includes(tagId)
  ).length;
  const inheritedPhotoCount = archive.photos.filter((photo) => {
    if (photo.status === "deleted") return false;
    const album = archive.albums.find((item) => item.id === photo.albumId);

    return Boolean(album?.tagIds.includes(tagId));
  }).length;

  return {
    albumCount,
    directPhotoCount,
    inheritedPhotoCount,
    total: albumCount + directPhotoCount + inheritedPhotoCount
  };
}

export function getStorageSummaryFromArchive(archive: LocalAdminArchive) {
  const publicBytes = archive.assets
    .filter((asset) => asset.access === "public")
    .reduce((sum, asset) => sum + asset.bytes, 0);
  const privateBytes = archive.assets
    .filter((asset) => asset.access === "private")
    .reduce((sum, asset) => sum + asset.bytes, 0);

  return {
    privateBytes,
    publicBytes,
    totalBytes: publicBytes + privateBytes
  };
}

export function getDashboardSnapshotFromArchive(archive: LocalAdminArchive) {
  const activeAlbums = archive.albums.filter((album) => album.status !== "trash" && album.status !== "deleted");
  const activePhotos = archive.photos.filter((photo) => photo.status !== "trash" && photo.status !== "deleted");
  const processingJobs = archive.uploadJobs.filter((job) =>
    ["queued", "uploading", "processing"].includes(job.status)
  );

  return {
    analytics: {
      visitsToday: 0,
      visitsSevenDays: 0,
      note: "Analytics will be wired through Cloudflare after upload is stable."
    },
    draftAlbums: activeAlbums.filter((album) => album.status === "draft").length,
    failedJobs: archive.uploadJobs.filter((job) => job.status === "failed").length,
    popularPhotos: activePhotos.slice(0, 5),
    processingJobs,
    reviewPhotos: activePhotos.filter((photo) => photo.status === "review").length,
    storage: getStorageSummaryFromArchive(archive),
    trashItems: archive.trash
  };
}

function adminArchiveReducer(state: LocalAdminArchive, action: AdminAction): LocalAdminArchive {
  switch (action.type) {
    case "replace":
      return action.archive;
    case "createAlbum":
      return {
        ...state,
        albums: [
          action.album,
          ...state.albums.map((album) => ({ ...album, sortOrder: album.sortOrder + 1 }))
        ]
      };
    case "updateAlbum":
      return {
        ...state,
        albums: state.albums.map((album) =>
          album.id === action.albumId ? { ...album, ...action.update, updatedAt: now() } : album
        )
      };
    case "reorderAlbum":
      return { ...state, albums: reorderAlbums(state.albums, action.albumId, action.direction) };
    case "trashAlbum":
      return {
        ...state,
        albums: state.albums.map((album) =>
          album.id === action.albumId ? { ...album, status: "trash", deletedAt: action.now, updatedAt: action.now, isDirty: true } : album
        ),
        photos: state.photos.map((photo) =>
          photo.albumId === action.albumId ? { ...photo, status: "trash", deletedAt: action.now, updatedAt: action.now, isDirty: true } : photo
        ),
        sets: state.sets.map((set) => ({
          ...set,
          albumIdsWithOrder: normalizeSetAlbumPositions(set.albumIdsWithOrder.filter((ref) => ref.albumId !== action.albumId))
        })),
        trash: [action.trashItem, ...state.trash]
      };
    case "addExistingPhotoToAlbum":
      return {
        ...state,
        albums: state.albums.map((album) => {
          if (album.id !== action.albumId) return album;
          const displayAssetId = action.photo.assetIds.find((id) => id.endsWith("-display"));

          return {
            ...album,
            coverLandscapeAssetId: album.coverLandscapeAssetId ?? displayAssetId,
            coverPortraitAssetId: album.coverPortraitAssetId ?? displayAssetId,
            coverSquareAssetId: album.coverSquareAssetId ?? action.photo.assetIds.find((id) => id.endsWith("-thumb")),
            updatedAt: action.now,
            isDirty: true
          };
        }),
        photos: [...state.photos, action.photo]
      };
    case "addPhotosToAlbum":
      return {
        ...state,
        albums: state.albums.map((album) => {
          if (album.id !== action.payloads[0]?.albumId) return album;
          const firstPayload = action.payloads[0];
          const coverAssetId = firstPayload.photo.assetIds.find((id) => id.endsWith("-display"));

          return {
            ...album,
            coverLandscapeAssetId: album.coverLandscapeAssetId ?? coverAssetId,
            coverPortraitAssetId: album.coverPortraitAssetId ?? coverAssetId,
            coverSquareAssetId: album.coverSquareAssetId ?? firstPayload.photo.assetIds.find((id) => id.endsWith("-thumb")),
            updatedAt: action.now,
            isDirty: true
          };
        }),
        assets: [...action.payloads.flatMap((payload) => payload.assets), ...state.assets],
        photos: [...state.photos, ...action.payloads.map((payload) => payload.photo)],
        uploadJobs: [...action.payloads.map((payload) => payload.job), ...state.uploadJobs]
      };
    case "updatePhoto":
      return {
        ...state,
        photos: state.photos.map((photo) =>
          photo.id === action.photoId ? { ...photo, ...action.update, updatedAt: now() } : photo
        )
      };
    case "reorderPhoto":
      return { ...state, photos: reorderPhotos(state.photos, action.albumId, action.photoId, action.direction) };
    case "movePhotoToPosition":
      return { ...state, photos: movePhotoToPosition(state.photos, action.albumId, action.photoId, action.position) };
    case "trashPhoto":
      return {
        ...state,
        photos: state.photos.map((photo) =>
          photo.id === action.photoId ? { ...photo, status: "trash", deletedAt: action.now, updatedAt: action.now, isDirty: true } : photo
        ),
        trash: [action.trashItem, ...state.trash]
      };
    case "setAlbumCover":
      return {
        ...state,
        albums: state.albums.map((album) => {
          if (album.id !== action.albumId) return album;
          const update =
            action.coverType === "portrait"
              ? { coverPortraitAssetId: action.assetId }
              : action.coverType === "square"
                ? { coverSquareAssetId: action.assetId }
                : { coverLandscapeAssetId: action.assetId };

          return { ...album, ...update, updatedAt: now(), isDirty: true };
        })
      };
    case "createSet":
      return { ...state, sets: [...state.sets, action.set] };
    case "updateSet":
      return {
        ...state,
        sets: state.sets.map((set) =>
          set.id === action.setId ? { ...set, ...action.update, updatedAt: now() } : set
        )
      };
    case "trashSet":
      return {
        ...state,
        sets: state.sets.map((set) =>
          set.id === action.setId ? { ...set, status: "trash", deletedAt: action.now, updatedAt: action.now, isDirty: true } : set
        ),
        trash: [action.trashItem, ...state.trash]
      };
    case "reorderSet":
      return { ...state, sets: reorderSets(state.sets, action.setId, action.direction) };
    case "addAlbumToSet":
      return {
        ...state,
        albums: state.albums.map((album) =>
          album.id === action.albumId && !album.setIds.includes(action.setId)
            ? { ...album, setIds: [...album.setIds, action.setId], updatedAt: action.now, isDirty: true }
            : album
        ),
        sets: state.sets.map((set) => {
          if (set.id !== action.setId || set.albumIdsWithOrder.some((ref) => ref.albumId === action.albumId)) return set;

          return {
            ...set,
            albumIdsWithOrder: [
              ...set.albumIdsWithOrder,
              { albumId: action.albumId, position: set.albumIdsWithOrder.length, featured: set.albumIdsWithOrder.length === 0 }
            ],
            updatedAt: action.now,
            isDirty: true
          };
        })
      };
    case "removeAlbumFromSet":
      return {
        ...state,
        albums: state.albums.map((album) =>
          album.id === action.albumId
            ? { ...album, setIds: album.setIds.filter((setId) => setId !== action.setId), updatedAt: action.now, isDirty: true }
            : album
        ),
        sets: state.sets.map((set) =>
          set.id === action.setId
            ? {
                ...set,
                albumIdsWithOrder: normalizeSetAlbumPositions(set.albumIdsWithOrder.filter((ref) => ref.albumId !== action.albumId)),
                updatedAt: action.now,
                isDirty: true
              }
            : set
        )
      };
    case "reorderAlbumInSet":
      return {
        ...state,
        sets: state.sets.map((set) =>
          set.id === action.setId
            ? { ...set, albumIdsWithOrder: reorderAlbumRefs(set.albumIdsWithOrder, action.albumId, action.direction), updatedAt: now(), isDirty: true }
            : set
        )
      };
    case "createTag":
      return { ...state, tags: [...state.tags, action.tag] };
    case "updateTag":
      return {
        ...state,
        tags: state.tags.map((tag) =>
          tag.id === action.tagId ? { ...tag, ...action.update } : tag
        )
      };
    case "deleteTag":
      if (getTagUsageFromArchive(state, action.tagId).total > 0) return state;

      return {
        ...state,
        tags: state.tags.filter((tag) => tag.id !== action.tagId)
      };
    case "attachAlbumTag":
      return {
        ...state,
        albums: state.albums.map((album) =>
          album.id === action.albumId && !album.tagIds.includes(action.tagId)
            ? { ...album, tagIds: [...album.tagIds, action.tagId], updatedAt: action.now, isDirty: true }
            : album
        )
      };
    case "detachAlbumTag":
      return {
        ...state,
        albums: state.albums.map((album) =>
          album.id === action.albumId
            ? { ...album, tagIds: album.tagIds.filter((tagId) => tagId !== action.tagId), updatedAt: action.now, isDirty: true }
            : album
        )
      };
    case "updateSettings":
      return { ...state, settings: { ...state.settings, ...action.update } };
    case "restoreItem":
      return restoreTrashItem(state, action.itemId, action.now);
    case "purgeItem":
      return purgeTrashItem(state, action.itemId);
    default:
      return state;
  }
}

function seedArchive(): LocalAdminArchive {
  return structuredClone(adminArchive) as LocalAdminArchive;
}

function readStoredArchive(): LocalAdminArchive | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { version?: number; archive?: LocalAdminArchive };

    if (parsed.version !== STORAGE_VERSION || !parsed.archive) return undefined;
    return parsed.archive;
  } catch {
    return undefined;
  }
}

function now() {
  return new Date().toISOString();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function uniqueSlug(value: string, existingSlugs: string[]) {
  const base = slugify(value) || "untitled";
  let candidate = base;
  let index = 2;

  while (existingSlugs.includes(candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }

  return candidate;
}

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getCanonicalPhotoId(photo: Pick<LocalArchivePhoto, "id" | "sourcePhotoId">) {
  return photo.sourcePhotoId ?? photo.id;
}

function assetId(photoId: string, version: ArchiveAsset["version"]) {
  return `asset-${photoId.replace(/^photo-/, "")}-${version}`;
}

function makeLocalAssets(
  photo: LocalArchivePhoto,
  file: File,
  previewIds: { sourcePreviewId: string; thumbBytes: number; thumbPreviewId: string },
  timestamp: string
): LocalArchiveAsset[] {
  const ratio = photo.width / photo.height;

  return [
    makeLocalAsset(photo, "thumb", "public", previewIds.thumbPreviewId, Math.round(520 * ratio), 520, previewIds.thumbBytes, file, timestamp),
    makeLocalAsset(photo, "display", "public", previewIds.sourcePreviewId, Math.round(1600 * ratio), 1600, Math.min(file.size, 980000), file, timestamp),
    makeLocalAsset(photo, "expanded", "public", previewIds.sourcePreviewId, Math.round(2400 * ratio), 2400, Math.min(file.size, 2600000), file, timestamp),
    makeLocalAsset(photo, "downloadJpeg", "public", previewIds.sourcePreviewId, Math.round(3000 * ratio), 3000, Math.min(file.size, 3900000), file, timestamp),
    makeLocalAsset(photo, "sourceJpeg", "private", previewIds.sourcePreviewId, photo.width, photo.height, file.size, file, timestamp)
  ];
}

function makeLocalAsset(
  photo: LocalArchivePhoto,
  version: ArchiveAsset["version"],
  access: ArchiveAsset["access"],
  previewId: string,
  width: number,
  height: number,
  bytes: number,
  file: File,
  timestamp: string
): LocalArchiveAsset {
  return {
    id: assetId(photo.id, version),
    photoId: photo.id,
    version,
    access,
    bucket: access === "public" ? "yakov-public-assets" : "yakov-private-assets",
    key: `local/${version}/${photo.albumId}/${photo.slug}.jpg`,
    width,
    height,
    bytes,
    mimeType: file.type || "image/jpeg",
    colorProfile: version === "sourceJpeg" ? "preserve" : "srgb",
    createdAt: timestamp,
    localPreviewId: previewId,
    sourceBytes: file.size,
    sourceFileName: file.name
  };
}

function makeLocalUploadJob(albumId: string, file: File, index: number, timestamp: string): UploadJob {
  const progress = index === 0 ? 100 : 72;

  return {
    id: uniqueId("upload"),
    albumId,
    fileName: file.name,
    status: index === 0 ? "review" : "processing",
    progress,
    bytes: file.size,
    derivatives: [
      { version: "thumb", status: "done", progress: 100 },
      { version: "display", status: "done", progress: 100 },
      { version: "expanded", status: progress === 100 ? "done" : "processing", progress },
      { version: "downloadJpeg", status: progress === 100 ? "done" : "queued", progress: Math.max(0, progress - 35) }
    ],
    createdAt: timestamp
  };
}

function readImageDimensions(file: File): Promise<{ height: number; width: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      resolve({ height: image.naturalHeight, width: image.naturalWidth });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read image dimensions"));
    };
    image.src = url;
  });
}

function createAdminThumbnailBlob(file: File, dimensions: { height: number; width: number }): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const maxLongEdge = 960;
    const scale = Math.min(1, maxLongEdge / Math.max(dimensions.width, dimensions.height));
    const canvas = document.createElement("canvas");
    const image = new Image();
    const url = URL.createObjectURL(file);

    canvas.width = Math.max(1, Math.round(dimensions.width * scale));
    canvas.height = Math.max(1, Math.round(dimensions.height * scale));

    image.onload = () => {
      const context = canvas.getContext("2d");

      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error("Unable to create thumbnail canvas"));
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (blob) {
            resolve(blob);
            return;
          }
          reject(new Error("Unable to encode thumbnail"));
        },
        "image/jpeg",
        0.72
      );
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to decode thumbnail image"));
    };
    image.src = url;
  });
}

function getTemporaryAdminPreviewUrl(publicUrl: string | undefined) {
  if (!publicUrl) return undefined;

  try {
    const url = new URL(publicUrl);

    if (url.hostname !== TEMP_R2_SEED_HOST) return undefined;

    return `${TEMP_ADMIN_PREVIEW_PREFIX}${url.pathname.replace(/^\/+/, "")}`;
  } catch {
    return undefined;
  }
}

function reorderAlbums(albums: LocalArchiveAlbum[], albumId: string, direction: "up" | "down") {
  const ordered = [...albums].sort((a, b) => a.sortOrder - b.sortOrder);
  const currentIndex = ordered.findIndex((album) => album.id === albumId);
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= ordered.length) return albums;

  [ordered[currentIndex], ordered[targetIndex]] = [ordered[targetIndex], ordered[currentIndex]];
  const orderById = new Map(ordered.map((album, index) => [album.id, index]));

  return albums.map((album) => ({
    ...album,
    sortOrder: orderById.get(album.id) ?? album.sortOrder,
    updatedAt: now(),
    isDirty: true
  }));
}

function reorderPhotos(
  photos: LocalArchivePhoto[],
  albumId: string,
  photoId: string,
  direction: "up" | "down"
) {
  const albumPhotos = photos
    .filter((photo) => photo.albumId === albumId)
    .sort((a, b) => a.position - b.position);
  const currentIndex = albumPhotos.findIndex((photo) => photo.id === photoId);
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= albumPhotos.length) return photos;

  const reordered = [...albumPhotos];
  [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];
  const positionById = new Map(reordered.map((photo, index) => [photo.id, index + 1]));

  return photos.map((photo) =>
    positionById.has(photo.id) ? { ...photo, position: positionById.get(photo.id) ?? photo.position, isDirty: true, updatedAt: now() } : photo
  );
}

function movePhotoToPosition(photos: LocalArchivePhoto[], albumId: string, photoId: string, position: number) {
  const albumPhotos = photos
    .filter((photo) => photo.albumId === albumId)
    .sort((a, b) => a.position - b.position);
  const currentIndex = albumPhotos.findIndex((photo) => photo.id === photoId);

  if (currentIndex < 0) return photos;

  const boundedPosition = Math.max(1, Math.min(position, albumPhotos.length));
  const reordered = [...albumPhotos];
  const [moved] = reordered.splice(currentIndex, 1);
  reordered.splice(boundedPosition - 1, 0, moved);
  const positionById = new Map(reordered.map((photo, index) => [photo.id, index + 1]));

  return photos.map((photo) =>
    positionById.has(photo.id) ? { ...photo, position: positionById.get(photo.id) ?? photo.position, isDirty: true, updatedAt: now() } : photo
  );
}

function reorderSets(sets: LocalArchiveSet[], setId: string, direction: "up" | "down") {
  const ordered = [...sets].sort((a, b) => a.order - b.order);
  const currentIndex = ordered.findIndex((set) => set.id === setId);
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= ordered.length) return sets;

  [ordered[currentIndex], ordered[targetIndex]] = [ordered[targetIndex], ordered[currentIndex]];
  const orderById = new Map(ordered.map((set, index) => [set.id, index + 1]));

  return sets.map((set) => ({ ...set, order: orderById.get(set.id) ?? set.order, updatedAt: now(), isDirty: true }));
}

function reorderAlbumRefs(
  refs: ArchiveSet["albumIdsWithOrder"],
  albumId: string,
  direction: "left" | "right"
) {
  const ordered = [...refs].sort((a, b) => a.position - b.position);
  const currentIndex = ordered.findIndex((ref) => ref.albumId === albumId);
  const targetIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;

  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= ordered.length) return refs;

  [ordered[currentIndex], ordered[targetIndex]] = [ordered[targetIndex], ordered[currentIndex]];
  return normalizeSetAlbumPositions(ordered);
}

function normalizeSetAlbumPositions(refs: ArchiveSet["albumIdsWithOrder"]) {
  return refs.map((ref, position) => ({ ...ref, position, featured: position === 0 }));
}

function makeTrashItem(
  archive: LocalAdminArchive,
  entityType: TrashItem["entityType"],
  entityId: string,
  title: string
): TrashItem {
  const deletedAt = now();
  const purgeAfterDate = new Date(deletedAt);
  purgeAfterDate.setDate(purgeAfterDate.getDate() + archive.settings.trashRetentionDays);
  const restoreStatus =
    entityType === "set"
      ? archive.sets.find((set) => set.id === entityId)?.status
      : entityType === "album"
        ? archive.albums.find((album) => album.id === entityId)?.status
        : entityType === "photo"
          ? archive.photos.find((photo) => photo.id === entityId)?.status
          : undefined;
  const photoIds =
    entityType === "album"
      ? archive.photos.filter((photo) => photo.albumId === entityId).map((photo) => photo.id)
      : entityType === "photo"
        ? [entityId]
        : [];
  const restorePhotoStatuses =
    entityType === "album"
      ? archive.photos
          .filter((photo) => photo.albumId === entityId)
          .map((photo) => ({ hiddenAt: photo.hiddenAt, photoId: photo.id, status: photo.status }))
      : entityType === "photo"
        ? archive.photos
            .filter((photo) => photo.id === entityId)
            .map((photo) => ({ hiddenAt: photo.hiddenAt, photoId: photo.id, status: photo.status }))
        : undefined;
  const restoreSetRefs =
    entityType === "album"
      ? archive.sets.flatMap((set) =>
          set.albumIdsWithOrder
            .filter((albumRef) => albumRef.albumId === entityId)
            .map((albumRef) => ({ albumRef, setId: set.id }))
        )
      : undefined;
  const bytes = archive.assets
    .filter((asset) => asset.photoId && photoIds.includes(asset.photoId))
    .reduce((sum, asset) => sum + asset.bytes, 0);

  return {
    id: uniqueId("trash"),
    entityType,
    entityId,
    title,
    deletedAt,
    purgeAfter: purgeAfterDate.toISOString(),
    fileCount: archive.assets.filter((asset) => asset.photoId && photoIds.includes(asset.photoId)).length,
    bytes,
    restorePhotoStatuses,
    restoreSetRefs,
    restoreStatus
  };
}

function restoreTrashItem(state: LocalAdminArchive, itemId: string, timestamp: string) {
  const item = state.trash.find((trashItem) => trashItem.id === itemId);
  if (!item) return state;

  const nextTrash = state.trash.filter((trashItem) => trashItem.id !== itemId);
  const restoredAlbumStatus: ArchiveStatus = item.restoreStatus ?? "draft";
  const photoRestoreById = new Map(
    item.restorePhotoStatuses?.map((photoStatus) => [photoStatus.photoId, photoStatus]) ?? []
  );

  if (item.entityType === "album") {
    return {
      ...state,
      albums: state.albums.map((album) =>
        album.id === item.entityId ? { ...album, status: restoredAlbumStatus, deletedAt: undefined, updatedAt: timestamp, isDirty: true } : album
      ),
      photos: state.photos.map((photo) =>
        photo.albumId === item.entityId
          ? {
              ...photo,
              hiddenAt: photoRestoreById.get(photo.id)?.hiddenAt,
              status: photoRestoreById.get(photo.id)?.status ?? "review",
              deletedAt: undefined,
              updatedAt: timestamp,
              isDirty: true
            }
          : photo
      ),
      sets: state.sets.map((set) => {
        const restoreRef = item.restoreSetRefs?.find((ref) => ref.setId === set.id);

        if (!restoreRef || set.albumIdsWithOrder.some((albumRef) => albumRef.albumId === item.entityId)) return set;

        return {
          ...set,
          albumIdsWithOrder: normalizeSetAlbumPositions([...set.albumIdsWithOrder, restoreRef.albumRef]),
          updatedAt: timestamp,
          isDirty: true
        };
      }),
      trash: nextTrash
    };
  }

  if (item.entityType === "set") {
    return {
      ...state,
      sets: state.sets.map((set) =>
        set.id === item.entityId
          ? { ...set, status: item.restoreStatus ?? "draft", deletedAt: undefined, updatedAt: timestamp, isDirty: true }
          : set
      ),
      trash: nextTrash
    };
  }

  if (item.entityType === "photo") {
    return {
      ...state,
      photos: state.photos.map((photo) =>
        photo.id === item.entityId
          ? {
              ...photo,
              hiddenAt: photoRestoreById.get(photo.id)?.hiddenAt,
              status: photoRestoreById.get(photo.id)?.status ?? "review",
              deletedAt: undefined,
              updatedAt: timestamp,
              isDirty: true
            }
          : photo
      ),
      trash: nextTrash
    };
  }

  return { ...state, trash: nextTrash };
}

function purgeTrashItem(state: LocalAdminArchive, itemId: string) {
  const item = state.trash.find((trashItem) => trashItem.id === itemId);
  if (!item) return state;

  if (item.entityType === "set") {
    return {
      ...state,
      albums: state.albums.map((album) => ({
        ...album,
        setIds: album.setIds.filter((setId) => setId !== item.entityId)
      })),
      sets: state.sets.filter((set) => set.id !== item.entityId),
      trash: state.trash.filter((trashItem) => trashItem.id !== itemId)
    };
  }

  if (item.entityType === "album") {
    const photoIds = state.photos.filter((photo) => photo.albumId === item.entityId).map((photo) => photo.id);
    const purgedAssetIds = new Set(
      state.photos
        .filter((photo) => photoIds.includes(photo.id))
        .flatMap((photo) => photo.assetIds)
    );
    const remainingPhotos = state.photos.filter((photo) => !photoIds.includes(photo.id));

    return {
      ...state,
      albums: state.albums.filter((album) => album.id !== item.entityId),
      assets: state.assets.filter((asset) =>
        !purgedAssetIds.has(asset.id) || remainingPhotos.some((photo) => photo.assetIds.includes(asset.id))
      ),
      photos: state.photos.filter((photo) => photo.albumId !== item.entityId),
      sets: state.sets.map((set) => ({
        ...set,
        albumIdsWithOrder: normalizeSetAlbumPositions(set.albumIdsWithOrder.filter((ref) => ref.albumId !== item.entityId))
      })),
      trash: state.trash.filter((trashItem) => trashItem.id !== itemId),
      uploadJobs: state.uploadJobs.filter((job) => job.albumId !== item.entityId)
    };
  }

  if (item.entityType === "photo") {
    const purgedPhoto = state.photos.find((photo) => photo.id === item.entityId);
    const purgedAssetIds = new Set(purgedPhoto?.assetIds ?? []);
    const remainingPhotos = state.photos.filter((photo) => photo.id !== item.entityId);

    return {
      ...state,
      assets: state.assets.filter((asset) =>
        !purgedAssetIds.has(asset.id) || remainingPhotos.some((photo) => photo.assetIds.includes(asset.id))
      ),
      photos: state.photos.filter((photo) => photo.id !== item.entityId),
      trash: state.trash.filter((trashItem) => trashItem.id !== itemId)
    };
  }

  return { ...state, trash: state.trash.filter((trashItem) => trashItem.id !== itemId) };
}

function previewIdsForTrashItem(archive: LocalAdminArchive, itemId: string) {
  const item = archive.trash.find((trashItem) => trashItem.id === itemId);
  if (!item) return [];

  const photoIds =
    item.entityType === "album"
      ? archive.photos.filter((photo) => photo.albumId === item.entityId).map((photo) => photo.id)
      : item.entityType === "photo"
        ? [item.entityId]
        : [];
  const removedAssetIds = new Set(
    archive.photos
      .filter((photo) => photoIds.includes(photo.id))
      .flatMap((photo) => photo.assetIds)
  );
  const remainingPhotos = archive.photos.filter((photo) => !photoIds.includes(photo.id));

  return Array.from(
    new Set(
      archive.assets
        .filter((asset) =>
          removedAssetIds.has(asset.id) && !remainingPhotos.some((photo) => photo.assetIds.includes(asset.id))
        )
        .map((asset) => asset.localPreviewId)
        .filter((previewId): previewId is string => Boolean(previewId))
    )
  );
}
