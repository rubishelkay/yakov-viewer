import type {
  AdminArchive,
  ArchiveAlbum,
  ArchiveAlbumPhoto,
  ArchiveAsset,
  ArchivePhoto,
  ArchiveSet,
  ArchiveTag
} from "./archive-schema";

export type LocalArchiveAsset = ArchiveAsset & {
  sourceBytes?: number;
  sourceFileName?: string;
};

export type LocalArchivePhoto = ArchivePhoto & {
  sourceBytes?: number;
  sourceFileName?: string;
};

export type LocalArchivePhotoInAlbum = LocalArchivePhoto & {
  albumId: string;
  position: number;
};

export type LocalArchiveAlbum = ArchiveAlbum;
export type LocalArchiveSet = ArchiveSet;
export type LocalArchiveTag = ArchiveTag;
export type LocalArchiveAlbumPhoto = ArchiveAlbumPhoto;

export type LocalAdminArchive = Omit<
  AdminArchive,
  "sets" | "albums" | "albumPhotos" | "photos" | "assets" | "tags"
> & {
  sets: LocalArchiveSet[];
  albums: LocalArchiveAlbum[];
  albumPhotos: LocalArchiveAlbumPhoto[];
  photos: LocalArchivePhoto[];
  assets: LocalArchiveAsset[];
  tags: LocalArchiveTag[];
};

export function getAlbumCoverUrlFromArchive(
  archive: LocalAdminArchive,
  previewUrls: Record<string, string>,
  album: LocalArchiveAlbum | undefined,
  coverType: "landscape" | "portrait" | "square" = "landscape"
) {
  if (!album) return undefined;
  const assetId = coverType === "portrait"
    ? album.coverPortraitAssetId
    : coverType === "square"
      ? album.coverSquareAssetId
      : album.coverLandscapeAssetId;

  return getAssetUrlFromArchive(archive, previewUrls, assetId);
}

export function getPhotoDisplayUrlFromArchive(
  archive: LocalAdminArchive,
  previewUrls: Record<string, string>,
  photo: LocalArchivePhoto | undefined
) {
  const assetId = findPhotoAssetId(archive, photo, ["display", "thumb", "expanded"]);
  return getAssetUrlFromArchive(archive, previewUrls, assetId);
}

export function getPhotoThumbnailUrlFromArchive(
  archive: LocalAdminArchive,
  previewUrls: Record<string, string>,
  photo: LocalArchivePhoto | undefined
) {
  const assetId = findPhotoAssetId(archive, photo, ["thumb", "display", "expanded"]);
  return getAssetUrlFromArchive(archive, previewUrls, assetId);
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
  const previewAsset = coverAsset?.photoId
    ? archive.assets.find((asset) => asset.photoId === coverAsset.photoId && asset.version === "thumb")
    : undefined;

  return getAssetUrlFromArchive(archive, previewUrls, previewAsset?.id ?? coverAssetId);
}

export function getAssetUrlFromArchive(
  archive: LocalAdminArchive,
  previewUrls: Record<string, string>,
  assetId: string | undefined
) {
  if (!assetId) return undefined;
  const asset = archive.assets.find((item) => item.id === assetId);
  if (!asset) return undefined;
  return previewUrls[asset.id] ?? asset.publicUrl;
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

export function getPhotosForAlbumFromArchive(
  archive: LocalAdminArchive,
  albumId: string | undefined
) {
  if (!albumId) return [];
  const photoById = new Map(archive.photos.map((photo) => [photo.id, photo]));
  const direction = archive.albums.find((album) => album.id === albumId)?.photoOrderDirection ?? "forward";
  const memberships = archive.albumPhotos
    .filter((membership) => membership.albumId === albumId)
    .sort((a, b) => a.position - b.position);
  if (direction === "reverse") memberships.reverse();

  return memberships
    .map((membership) => {
      const photo = photoById.get(membership.photoId);
      return photo ? { ...photo, albumId, position: membership.position } : undefined;
    })
    .filter(
      (photo): photo is LocalArchivePhotoInAlbum =>
        Boolean(photo && photo.status !== "trash" && photo.status !== "deleted")
    );
}

export function getAlbumPhotosForPhotoFromArchive(archive: LocalAdminArchive, photoId: string) {
  return archive.albumPhotos
    .filter((membership) => membership.photoId === photoId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.position - b.position);
}

export function getEffectivePhotoTagIdsFromArchive(
  archive: LocalAdminArchive,
  photo: LocalArchivePhoto | undefined
) {
  if (!photo) return [];
  const activeAlbums = new Set(
    archive.albums
      .filter((album) => !["trash", "deleted"].includes(album.status))
      .map((album) => album.id)
  );
  const inheritedTagIds = archive.albumPhotos
    .filter((membership) => membership.photoId === photo.id && activeAlbums.has(membership.albumId))
    .flatMap((membership) => archive.albums.find((album) => album.id === membership.albumId)?.tagIds ?? []);
  return Array.from(new Set([...inheritedTagIds, ...photo.tagIds]));
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
    return archive.albumPhotos.some((membership) => {
      if (membership.photoId !== photo.id) return false;
      const album = archive.albums.find((item) => item.id === membership.albumId);
      return Boolean(album && album.status !== "deleted" && album.tagIds.includes(tagId));
    });
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
  return { privateBytes, publicBytes, totalBytes: publicBytes + privateBytes };
}

export function getDashboardSnapshotFromArchive(archive: LocalAdminArchive) {
  const activeAlbums = archive.albums.filter((album) => !["trash", "deleted"].includes(album.status));
  const activePhotos = archive.photos.filter((photo) => !["trash", "deleted"].includes(photo.status));
  return {
    activeAlbums: activeAlbums.length,
    activePhotos: activePhotos.length,
    draftAlbums: activeAlbums.filter((album) => album.status === "draft").length,
    failedJobs: archive.uploadJobs.filter((job) => job.status === "failed").length,
    processingJobs: archive.uploadJobs.filter((job) =>
      ["queued", "uploading", "processing"].includes(job.status)
    ),
    reviewPhotos: activePhotos.filter((photo) => photo.status === "review").length,
    storage: getStorageSummaryFromArchive(archive),
    trashItems: archive.trash
  };
}

export function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function findPhotoAssetId(
  archive: LocalAdminArchive,
  photo: LocalArchivePhoto | undefined,
  versions: ArchiveAsset["version"][]
) {
  if (!photo) return undefined;
  for (const version of versions) {
    const asset = archive.assets.find((item) =>
      item.photoId === photo.id && item.version === version
    );
    if (asset) return asset.id;
  }
  return photo.assetIds[0];
}
