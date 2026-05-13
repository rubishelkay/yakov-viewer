import type { Collection, Film, Photo } from "./schema";

const temporaryAssetBaseUrl =
  "https://pub-500a8cf5bb2a4e3db51ea0c9789e6e88.r2.dev";
const filmFolder = "jfilms_mediumqual/jf73_f400_jpg_sm";

const frameNumbers = Array.from({ length: 37 }, (_, index) => index + 4);
const featuredFrames = new Set([1, 4, 9, 14, 22, 31]);
const downloadFrames = new Set([1, 14, 31]);

export const photos: Photo[] = frameNumbers.map((scanNumber, index) => {
  const frameNumber = index + 1;
  const fileName = `0000353000${String(scanNumber).padStart(2, "0")}.jpg`;
  const id = `film-073-${String(frameNumber).padStart(2, "0")}`;

  return {
    id,
    slug: id,
    sourceType: "film",
    filmId: "film-073",
    frameNumber,
    title: `Frame ${String(frameNumber).padStart(2, "0")}`,
    description:
      frameNumber === 1
        ? "A quiet seed frame from the existing R2 archive, used to ground the first public portfolio build."
        : "",
    alt: `Film photograph from Yakov Shmol's Film 073 archive, frame ${frameNumber}.`,
    visibility: "published",
    featured: featuredFrames.has(frameNumber),
    archiveOnly: !featuredFrames.has(frameNumber),
    heroCandidate: frameNumber <= 5,
    coverCandidate: frameNumber === 1,
    dateTaken: "2025-01-15",
    location: {
      city: "Bangkok",
      country: "Thailand",
      showExact: false
    },
    camera: "35mm film camera",
    lens: "35mm",
    filmStock: "Fuji 400",
    tags: ["film", "street", "bangkok", "archive"],
    aspectRatio: 1.5,
    width: 2048,
    height: 1365,
    dominantColor: frameNumber % 3 === 0 ? "#181410" : "#111111",
    r2: {
      originalKey: `${filmFolder}/${fileName}`,
      assetBaseUrl: temporaryAssetBaseUrl
    },
    rights: {
      copyright: "(c) Yakov Shmol",
      downloadAllowed: downloadFrames.has(frameNumber),
      downloadUrl: downloadFrames.has(frameNumber)
        ? `${temporaryAssetBaseUrl}/${filmFolder}/${fileName}`
        : undefined
    }
  };
});

export const films: Film[] = [
  {
    id: "film-073",
    slug: "film-073",
    type: "film",
    title: "Film 073",
    shortTitle: "Film 073",
    description:
      "A working seed roll from the original R2 archive. It is intentionally modest: real enough to test performance, routing, and the visual language before the full archive arrives.",
    dateStart: "2025-01-15",
    dateEnd: "2025-01-15",
    year: 2025,
    location: {
      city: "Bangkok",
      country: "Thailand",
      showExact: false
    },
    camera: "35mm film camera",
    lens: "35mm",
    filmStock: "Fuji 400",
    iso: 400,
    coverImageId: "film-073-01",
    tags: ["film", "bangkok", "seed"],
    visibility: "published",
    order: 73,
    notes: "Imported from the former Logjamming prototype as seed material."
  }
];

export const collections: Collection[] = [
  {
    id: "collection-selected-work",
    slug: "selected-work",
    title: "Selected Work",
    description:
      "A first public selection from the seed archive. This collection will become the front layer above the full archive.",
    coverImageId: "film-073-01",
    imageIds: photos.filter((photo) => photo.featured).map((photo) => photo.id),
    tags: ["selected", "film"],
    visibility: "published",
    order: 1
  }
];

