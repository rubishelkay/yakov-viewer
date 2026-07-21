import { assertAdminArchiveRelations } from "../src/admin/archive-invariants";
import { adminArchive } from "../src/admin/mock-data";
import { portfolioManifest } from "../src/content/portfolio-manifest";
import { getPublicAlbumBySlug, getPublicAlbums, getPublicTags } from "../src/lib/portfolio";

assertAdminArchiveRelations(adminArchive);

const sharedPhotoFixture = structuredClone(adminArchive);
const sourceMembership = sharedPhotoFixture.albumPhotos[0];
const targetAlbum = sharedPhotoFixture.albums.find(
  (album) => album.id !== sourceMembership.albumId
);

if (!targetAlbum) throw new Error("Shared photo fixture needs a second album.");
sharedPhotoFixture.albumPhotos.push({
  albumId: targetAlbum.id,
  photoId: sourceMembership.photoId,
  position: sharedPhotoFixture.albumPhotos.filter(
    (membership) => membership.albumId === targetAlbum.id
  ).length + 1,
  createdAt: sourceMembership.createdAt
});
assertAdminArchiveRelations(sharedPhotoFixture);

const publicAlbums = getPublicAlbums();
const publicTags = getPublicTags();
const publicPhotoCount = publicAlbums.reduce((sum, album) => sum + album.photoCount, 0);
const manifestPhotoCount = portfolioManifest.albums.reduce(
  (sum, album) => sum + album.images.length,
  0
);

if (publicAlbums.length !== portfolioManifest.albums.length) {
  throw new Error("Public album view does not match the approved portfolio manifest.");
}

if (publicPhotoCount !== manifestPhotoCount) {
  throw new Error("Public photo count does not match the approved portfolio manifest.");
}

for (const album of publicAlbums) {
  const detail = getPublicAlbumBySlug(album.slug);
  if (!detail || detail.photos.length !== album.photoCount) {
    throw new Error(`Public album detail is incomplete: ${album.slug}`);
  }
}

console.log(
  [
    "Content validation passed",
    `${publicAlbums.length} public portfolio album(s)`,
    `${publicPhotoCount} public portfolio photo(s)`,
    `${publicTags.length} public tag(s)`,
    `${adminArchive.albumPhotos.length} admin album-photo membership(s)`,
    "Multi-album photo fixture passed without duplicating photo or asset records"
  ].join("\n")
);
