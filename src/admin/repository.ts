import { adminArchive } from "./mock-data";
import type {
  AdminArchive,
  ArchiveAlbum,
  ArchiveAsset,
  ArchivePhoto,
  ArchiveSet,
  ArchiveStatus,
  ArchiveTag
} from "./archive-schema";

export function getAdminArchive(): AdminArchive {
  return adminArchive;
}

export function getOrderedSets(): ArchiveSet[] {
  return [...adminArchive.sets].sort((a, b) => a.order - b.order);
}

export function getOrderedAlbums(): ArchiveAlbum[] {
  return [...adminArchive.albums].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getAlbumsForSet(set: ArchiveSet): ArchiveAlbum[] {
  const albumById = new Map(adminArchive.albums.map((album) => [album.id, album]));

  return [...set.albumIdsWithOrder]
    .sort((a, b) => a.position - b.position)
    .map((ref) => albumById.get(ref.albumId))
    .filter((album): album is ArchiveAlbum => Boolean(album));
}

export function getPhotosForAlbum(albumId: string): ArchivePhoto[] {
  return adminArchive.photos
    .filter((photo) => photo.albumId === albumId)
    .sort((a, b) => a.position - b.position);
}

export function getAssetById(assetId: string | undefined): ArchiveAsset | undefined {
  if (!assetId) return undefined;
  return adminArchive.assets.find((asset) => asset.id === assetId);
}

export function getAlbumCoverUrl(album: ArchiveAlbum): string | undefined {
  return getAssetById(album.coverLandscapeAssetId)?.publicUrl;
}

export function getTagById(tagId: string): ArchiveTag | undefined {
  return adminArchive.tags.find((tag) => tag.id === tagId);
}

export function getTagsForAlbum(album: ArchiveAlbum): ArchiveTag[] {
  return album.tagIds.map(getTagById).filter((tag): tag is ArchiveTag => Boolean(tag));
}

export function getPhotoCountForAlbum(albumId: string): number {
  return adminArchive.photos.filter((photo) => photo.albumId === albumId).length;
}

export function getSetCountForAlbum(albumId: string): number {
  return adminArchive.sets.filter((set) =>
    set.albumIdsWithOrder.some((albumRef) => albumRef.albumId === albumId)
  ).length;
}

export function getStatusCounts(items: Array<{ status: ArchiveStatus }>): Record<ArchiveStatus, number> {
  const counts: Record<ArchiveStatus, number> = {
    draft: 0,
    review: 0,
    published: 0,
    hidden: 0,
    trash: 0,
    deleted: 0
  };

  for (const item of items) {
    counts[item.status] += 1;
  }

  return counts;
}

export function getStorageSummary() {
  const publicBytes = adminArchive.assets
    .filter((asset) => asset.access === "public")
    .reduce((sum, asset) => sum + asset.bytes, 0);
  const privateBytes = adminArchive.assets
    .filter((asset) => asset.access === "private")
    .reduce((sum, asset) => sum + asset.bytes, 0);

  return {
    publicBytes,
    privateBytes,
    totalBytes: publicBytes + privateBytes
  };
}

export function getDashboardSnapshot() {
  const albumCounts = getStatusCounts(adminArchive.albums);
  const photoCounts = getStatusCounts(adminArchive.photos);
  const storage = getStorageSummary();
  const processingJobs = adminArchive.uploadJobs.filter((job) =>
    ["queued", "uploading", "processing"].includes(job.status)
  );

  return {
    analytics: {
      visitsToday: 0,
      visitsSevenDays: 0,
      note: "Analytics will be wired through Cloudflare after upload is stable."
    },
    popularPhotos: adminArchive.photos.slice(0, 5),
    draftAlbums: albumCounts.draft,
    reviewPhotos: photoCounts.review,
    processingJobs,
    failedJobs: adminArchive.uploadJobs.filter((job) => job.status === "failed").length,
    storage,
    trashItems: adminArchive.trash
  };
}

export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

