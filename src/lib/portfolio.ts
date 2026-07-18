import {
  getAlbumCoverUrlFromArchive,
  getPhotoDisplayUrlFromArchive,
  getPhotoThumbnailUrlFromArchive,
  getPhotosForAlbumFromArchive,
  type LocalAdminArchive,
  type LocalArchiveAlbum,
  type LocalArchivePhoto,
  type LocalArchiveTag
} from "@/admin/admin-state";

export type PreviewUrls = Record<string, string>;

export function getPublicAlbums(archive: LocalAdminArchive) {
  const publishedAlbums = archive.albums.filter(isPublicAlbum);
  const albumById = new Map(publishedAlbums.map((album) => [album.id, album]));
  const orderedIds = archive.sets
    .filter((set) => set.status === "published")
    .sort((a, b) => a.order - b.order)
    .flatMap((set) =>
      [...set.albumIdsWithOrder]
        .sort((a, b) => a.position - b.position)
        .map((reference) => reference.albumId)
    );
  const seen = new Set<string>();
  const ordered = orderedIds
    .map((albumId) => albumById.get(albumId))
    .filter((album): album is LocalArchiveAlbum => Boolean(album))
    .filter((album) => {
      if (seen.has(album.id)) return false;
      seen.add(album.id);
      return true;
    });
  const ungrouped = publishedAlbums
    .filter((album) => !seen.has(album.id))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return [...ordered, ...ungrouped];
}

export function getHomepageAlbums(archive: LocalAdminArchive) {
  const publishedAlbums = new Map(
    archive.albums
      .filter(isPublicAlbum)
      .map((album) => [album.id, album])
  );
  const seen = new Set<string>();

  return archive.sets
    .filter((set) => set.status === "published")
    .sort((a, b) => a.order - b.order)
    .flatMap((set) =>
      [...set.albumIdsWithOrder]
        .sort((a, b) => a.position - b.position)
        .map((reference) => publishedAlbums.get(reference.albumId))
    )
    .filter((album): album is LocalArchiveAlbum => Boolean(album))
    .filter((album) => {
      if (seen.has(album.id)) return false;
      seen.add(album.id);
      return true;
    });
}

export function getHeroAlbums(archive: LocalAdminArchive) {
  const albumById = new Map(archive.albums.filter(isPublicAlbum).map((album) => [album.id, album]));
  const heroSet = archive.sets
    .filter((set) => set.status === "published")
    .sort((a, b) => a.order - b.order)[0];

  if (!heroSet) return getPublicAlbums(archive).slice(0, 5);

  return [...heroSet.albumIdsWithOrder]
    .sort((a, b) => a.position - b.position)
    .map((reference) => albumById.get(reference.albumId))
    .filter((album): album is LocalArchiveAlbum => Boolean(album))
    .slice(0, 5);
}

export function getPublicAlbumBySlug(archive: LocalAdminArchive, slug: string) {
  return archive.albums.find(
    (album) => album.slug === slug && isPublicAlbum(album)
  );
}

export function getPublicPhotosForAlbum(archive: LocalAdminArchive, albumId: string) {
  return getPhotosForAlbumFromArchive(archive, albumId).filter(
    (photo) => photo.status === "published"
  );
}

export function getPublicTagBySlug(archive: LocalAdminArchive, slug: string) {
  return archive.tags.find((tag) => tag.slug === slug);
}

export function getPublicPhotosForTag(archive: LocalAdminArchive, tagId: string) {
  const seen = new Set<string>();

  return getPublicAlbums(archive).flatMap((album) => {
    const albumHasTag = album.tagIds.includes(tagId);

    return getPublicPhotosForAlbum(archive, album.id)
      .map((photo, index) => ({ album, index, photo }))
      .filter(({ photo }) => albumHasTag || photo.tagIds.includes(tagId))
      .filter(({ photo }) => {
        if (seen.has(photo.id)) return false;
        seen.add(photo.id);
        return true;
      });
  });
}

export function getAlbumSubtitleTags(archive: LocalAdminArchive, album: LocalArchiveAlbum) {
  const tags = album.tagIds
    .map((tagId) => archive.tags.find((tag) => tag.id === tagId))
    .filter((tag): tag is LocalArchiveTag => Boolean(tag));

  return album.subtitle
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean)
    .map((label) => ({
      label,
      tag: tags.find((tag) => normalizeTagLabel(tag.label) === normalizeTagLabel(label))
    }));
}

export function getAlbumCover(
  archive: LocalAdminArchive,
  previewUrls: PreviewUrls,
  album: LocalArchiveAlbum
) {
  return getAlbumCoverUrlFromArchive(archive, previewUrls, album, "landscape");
}

export function getPortfolioPhotoSources(
  archive: LocalAdminArchive,
  previewUrls: PreviewUrls,
  photo: LocalArchivePhoto
) {
  return {
    display: getPhotoDisplayUrlFromArchive(archive, previewUrls, photo),
    thumb: getPhotoThumbnailUrlFromArchive(archive, previewUrls, photo)
  };
}

export function isFilmAlbum(album: LocalArchiveAlbum) {
  return album.tagIds.includes("tag-film") || album.tagIds.includes("tag-film-photography");
}

function isPublicAlbum(album: LocalArchiveAlbum) {
  return album.status === "published" && !album.isDemo;
}

function normalizeTagLabel(value: string) {
  return value.trim().toLocaleLowerCase("en");
}
