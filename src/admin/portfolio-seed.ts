import { getPortfolioAssetUrl, portfolioManifest } from "@/content/portfolio-manifest";

import type {
  ArchiveAlbum,
  ArchiveAlbumPhoto,
  ArchiveAsset,
  ArchivePhoto,
  ArchiveSet,
  ArchiveTag
} from "./archive-schema";

const importedAt = "2026-07-17T00:00:00.000Z";
const portfolioSetId = "set-portfolio-index";

export const portfolioTags: ArchiveTag[] = Array.from(
  new Map(
    portfolioManifest.albums
      .flatMap((album) => [album.type, album.year, album.location, album.filmStock, ...album.tags])
      .filter(Boolean)
      .map((label) => {
        const slug = slugify(label);
        return [
          `tag-${slug}`,
          {
            id: `tag-${slug}`,
            slug,
            label,
            scope: "both" as const,
            createdAt: importedAt
          }
        ] as const;
      })
  ).values()
);

export const portfolioAlbums: ArchiveAlbum[] = portfolioManifest.albums.map((album) => {
  const coverImage =
    album.images.find((image) => image.srcKey === stripLeadingSlash(album.coverImage)) ??
    album.images[0];

  return {
    id: portfolioAlbumId(album.id),
    slug: album.slug,
    title: album.title,
    subtitle: album.subtitle,
    description: "",
    status: "published",
    isDemo: false,
    setIds: [portfolioSetId],
    tagIds: albumTagIds(album),
      publicDownloadPolicy: "none",
      coverPriority: "landscape",
    coverLandscapeAssetId: portfolioAssetId(coverImage.id, "display"),
    coverPortraitAssetId: portfolioAssetId(coverImage.id, "display"),
    coverSquareAssetId: portfolioAssetId(coverImage.id, "thumb"),
    sortOrder: album.order,
    photoOrderDirection: "forward",
    dateStart: album.year ? `${album.year}-01-01` : undefined,
    dateEnd: album.year ? `${album.year}-12-31` : undefined,
    locationText: album.location || undefined,
    filmStock: album.filmStock || undefined,
    createdAt: importedAt,
    updatedAt: importedAt,
    publishedAt: importedAt
  };
});

export const portfolioPhotos: ArchivePhoto[] = portfolioManifest.albums.flatMap((album) =>
  album.images.map((image) => ({
    id: portfolioPhotoId(image.id),
    slug: image.id,
    title: image.alt,
    description: "",
    status: "published" as const,
    frameNumber: image.position,
    tagIds: [],
    assetIds: [
      portfolioAssetId(image.id, "thumb"),
      portfolioAssetId(image.id, "display"),
      portfolioAssetId(image.id, "expanded"),
      portfolioAssetId(image.id, "downloadJpeg"),
      portfolioAssetId(image.id, "sourceJpeg")
    ],
    width: image.width,
    height: image.height,
    dominantColor: "#111111",
    createdAt: importedAt,
    updatedAt: importedAt,
    publishedAt: importedAt
  }))
);

export const portfolioAlbumPhotos: ArchiveAlbumPhoto[] = portfolioManifest.albums.flatMap((album) =>
  album.images.map((image) => ({
    albumId: portfolioAlbumId(album.id),
    photoId: portfolioPhotoId(image.id),
    position: image.position,
    createdAt: importedAt
  }))
);

export const portfolioAssets: ArchiveAsset[] = portfolioManifest.albums.flatMap((album) =>
  album.images.flatMap((image) => {
    const photoId = portfolioPhotoId(image.id);

    return [
      makeAsset(photoId, image.id, "thumb", "public", image.thumbKey, image.width, image.height, image.thumbBytes),
      makeAsset(photoId, image.id, "display", "public", image.srcKey, image.width, image.height, image.srcBytes),
      makeAsset(photoId, image.id, "expanded", "public", image.srcKey, image.width, image.height, 0),
      makeAsset(photoId, image.id, "downloadJpeg", "private", image.srcKey, image.width, image.height, 0),
      makeAsset(photoId, image.id, "sourceJpeg", "private", image.srcKey, image.width, image.height, 0)
    ];
  })
);

export const portfolioSet: ArchiveSet = {
  id: portfolioSetId,
  slug: "portfolio-index",
  title: "Yakov Shmol",
  subtitle: "Film and digital archive",
  description: "The first public set imported from the approved Fable frontend.",
  status: "published",
  order: 0,
  layoutMode: "fullscreen-carousel",
  albumIdsWithOrder: portfolioAlbums.map((album, position) => ({
    albumId: album.id,
    position,
    featured: position === 0
  })),
  createdAt: importedAt,
  updatedAt: importedAt,
  publishedAt: importedAt
};

function makeAsset(
  photoId: string,
  sourceId: string,
  version: ArchiveAsset["version"],
  access: ArchiveAsset["access"],
  key: string,
  width: number,
  height: number,
  bytes: number
): ArchiveAsset {
  return {
    id: portfolioAssetId(sourceId, version),
    photoId,
    version,
    access,
    bucket: access === "public" ? "yakov-public-assets" : "yakov-private-assets",
    key,
    publicUrl: access === "public" ? getPortfolioAssetUrl(key) : undefined,
    width,
    height,
    bytes,
    mimeType: "image/jpeg",
    colorProfile: version === "sourceJpeg" ? "preserve" : "srgb",
    createdAt: importedAt
  };
}

function albumTagIds(album: (typeof portfolioManifest.albums)[number]) {
  return Array.from(
    new Set(
      [album.type, album.year, album.location, album.filmStock, ...album.tags]
        .filter(Boolean)
        .map((label) => `tag-${slugify(label)}`)
    )
  );
}

function portfolioAlbumId(id: string) {
  return `album-${id}`;
}

function portfolioPhotoId(id: string) {
  return `photo-${id}`;
}

function portfolioAssetId(id: string, version: ArchiveAsset["version"]) {
  return `asset-${id}-${version}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function stripLeadingSlash(value: string) {
  return value.replace(/^\/+/, "");
}
