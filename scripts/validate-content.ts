import { collections, films, photos, validateContent } from "../src/content";

validateContent();

const publishedPhotos = photos.filter((photo) => photo.visibility === "published").length;
const downloadablePhotos = photos.filter((photo) => photo.rights.downloadAllowed).length;

console.log(
  [
    "Content validation passed",
    `${films.length} film(s)`,
    `${photos.length} photo(s), ${publishedPhotos} published`,
    `${collections.length} collection(s)`,
    `${downloadablePhotos} downloadable photo(s)`
  ].join("\n")
);
