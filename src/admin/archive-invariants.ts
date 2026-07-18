import type { AdminArchive } from "./archive-schema";

export function validateAdminArchiveRelations(archive: AdminArchive) {
  const errors: string[] = [];
  const albumIds = new Set(archive.albums.map((album) => album.id));
  const assetIds = new Set(archive.assets.map((asset) => asset.id));
  const photoIds = new Set(archive.photos.map((photo) => photo.id));
  const setIds = new Set(archive.sets.map((set) => set.id));

  reportDuplicateIds("album", archive.albums.map((album) => album.id), errors);
  reportDuplicateIds("asset", archive.assets.map((asset) => asset.id), errors);
  reportDuplicateIds("photo", archive.photos.map((photo) => photo.id), errors);
  reportDuplicateIds("set", archive.sets.map((set) => set.id), errors);

  const membershipKeys = new Set<string>();
  const membershipsByAlbum = new Map<string, typeof archive.albumPhotos>();

  for (const membership of archive.albumPhotos) {
    const key = `${membership.albumId}:${membership.photoId}`;
    if (membershipKeys.has(key)) errors.push(`Duplicate album-photo membership: ${key}`);
    membershipKeys.add(key);
    if (!albumIds.has(membership.albumId)) errors.push(`Membership references missing album: ${key}`);
    if (!photoIds.has(membership.photoId)) errors.push(`Membership references missing photo: ${key}`);
    const group = membershipsByAlbum.get(membership.albumId) ?? [];
    group.push(membership);
    membershipsByAlbum.set(membership.albumId, group);
  }

  for (const [albumId, memberships] of membershipsByAlbum) {
    const positions = memberships.map((membership) => membership.position).sort((a, b) => a - b);
    positions.forEach((position, index) => {
      if (position !== index + 1) errors.push(`Album ${albumId} has non-contiguous photo positions.`);
    });
  }

  for (const photo of archive.photos) {
    for (const assetId of photo.assetIds) {
      if (!assetIds.has(assetId)) errors.push(`Photo ${photo.id} references missing asset ${assetId}.`);
    }
  }

  for (const asset of archive.assets) {
    if (asset.photoId && !photoIds.has(asset.photoId)) {
      errors.push(`Asset ${asset.id} references missing photo ${asset.photoId}.`);
    }
  }

  for (const set of archive.sets) {
    for (const reference of set.albumIdsWithOrder) {
      if (!albumIds.has(reference.albumId)) {
        errors.push(`Set ${set.id} references missing album ${reference.albumId}.`);
      }
    }
  }

  for (const album of archive.albums) {
    for (const setId of album.setIds) {
      if (!setIds.has(setId)) errors.push(`Album ${album.id} references missing set ${setId}.`);
    }
  }

  for (const collection of archive.collections) {
    for (const reference of collection.photoIdsWithOrder) {
      if (!photoIds.has(reference.photoId)) {
        errors.push(`Collection ${collection.id} references missing photo ${reference.photoId}.`);
      }
    }
  }

  return errors;
}

export function assertAdminArchiveRelations(archive: AdminArchive) {
  const errors = validateAdminArchiveRelations(archive);
  if (errors.length) throw new Error(`Archive relation validation failed:\n${errors.join("\n")}`);
}

function reportDuplicateIds(label: string, ids: string[], errors: string[]) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) errors.push(`Duplicate ${label} id: ${id}`);
    seen.add(id);
  }
}
