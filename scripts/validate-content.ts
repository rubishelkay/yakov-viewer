import { collections, films, photos, validateContent } from "../src/content";
import { assertAdminArchiveRelations } from "../src/admin/archive-invariants";
import { adminArchive } from "../src/admin/mock-data";
import { portfolioManifest } from "../src/content/portfolio-manifest";

validateContent();
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

const publishedPhotos = photos.filter((photo) => photo.visibility === "published").length;
const downloadablePhotos = photos.filter((photo) => photo.rights.downloadAllowed).length;
const portfolioPhotoCount = portfolioManifest.albums.reduce(
  (sum, album) => sum + album.images.length,
  0
);

console.log(
  [
    "Content validation passed",
    `${films.length} film(s)`,
    `${photos.length} photo(s), ${publishedPhotos} published`,
    `${collections.length} collection(s)`,
    `${downloadablePhotos} downloadable photo(s)`,
    `${portfolioManifest.albums.length} imported portfolio album(s)`,
    `${portfolioPhotoCount} imported portfolio photo(s)`,
    `${adminArchive.albumPhotos.length} canonical album-photo membership(s)`,
    "Multi-album photo fixture passed without duplicating photo or asset records"
  ].join("\n")
);
