import { photos as publicSeedPhotos } from "@/content/seed";

import {
  adminArchiveSchema,
  type AdminArchive,
  type ArchiveAlbum,
  type ArchiveAsset,
  type ArchivePhoto,
  type ArchiveSet,
  type ArchiveTag,
  type SetLayoutMode
} from "./archive-schema";

const now = "2026-05-12T10:00:00+07:00";
const later = "2026-05-19T10:00:00+07:00";

const tags: ArchiveTag[] = [
  makeTag("tag-film", "film", "Film", "both"),
  makeTag("tag-digital", "digital", "Digital", "both"),
  makeTag("tag-bangkok", "bangkok", "Bangkok", "both"),
  makeTag("tag-chiang-mai", "chiang-mai", "Chiang Mai", "both"),
  makeTag("tag-mountains", "mountains", "Mountains", "both"),
  makeTag("tag-night", "night", "Night", "both"),
  makeTag("tag-architecture", "architecture", "Architecture", "both"),
  makeTag("tag-milky-way", "milky-way", "Milky Way", "both"),
  makeTag("tag-street", "street", "Street", "both"),
  makeTag("tag-fuji-400", "fuji-400", "Fuji 400", "album"),
  makeTag("tag-kodak-pro-image-100", "kodak-pro-image-100", "Kodak Pro Image 100", "album"),
  makeTag("tag-selected", "selected", "Selected", "photo"),
  makeTag("tag-review", "review", "Review", "photo"),
  makeTag("tag-2025", "2025", "2025", "both")
];

type AlbumSeed = {
  id: string;
  title: string;
  subtitle: string;
  status: ArchiveAlbum["status"];
  setIds: string[];
  tagIds: string[];
  locationText: string;
  camera: string;
  filmStock?: string;
};

const albumSeeds: AlbumSeed[] = [
  {
    id: "album-bangkok-neon",
    title: "Bangkok neon walk",
    subtitle: "Film roll, night streets",
    status: "published",
    setIds: ["set-bangkok", "set-night"],
    tagIds: ["tag-film", "tag-bangkok", "tag-night", "tag-street", "tag-fuji-400", "tag-2025"],
    locationText: "Bangkok, Thailand",
    camera: "35mm film camera",
    filmStock: "Fuji 400"
  },
  {
    id: "album-film-073",
    title: "Film 073",
    subtitle: "Seed roll from the current archive",
    status: "published",
    setIds: ["set-bangkok", "set-film-index"],
    tagIds: ["tag-film", "tag-bangkok", "tag-fuji-400", "tag-2025"],
    locationText: "Bangkok, Thailand",
    camera: "35mm film camera",
    filmStock: "Fuji 400"
  },
  {
    id: "album-chiang-mai-rain",
    title: "Chiang Mai after rain",
    subtitle: "Digital walk, soft daylight",
    status: "review",
    setIds: ["set-north"],
    tagIds: ["tag-digital", "tag-chiang-mai", "tag-street", "tag-2025"],
    locationText: "Chiang Mai, Thailand",
    camera: "Mirrorless camera"
  },
  {
    id: "album-chegem-gorge",
    title: "Chegem gorge",
    subtitle: "Mountain archive draft",
    status: "draft",
    setIds: ["set-mountains"],
    tagIds: ["tag-film", "tag-mountains", "tag-kodak-pro-image-100"],
    locationText: "Chegem Gorge",
    camera: "35mm film camera",
    filmStock: "Kodak Pro Image 100"
  },
  {
    id: "album-bangkok-architecture",
    title: "Concrete shade",
    subtitle: "Architecture fragments",
    status: "published",
    setIds: ["set-bangkok", "set-architecture"],
    tagIds: ["tag-digital", "tag-bangkok", "tag-architecture", "tag-2025"],
    locationText: "Bangkok, Thailand",
    camera: "Mirrorless camera"
  },
  {
    id: "album-milky-way-test",
    title: "Milky Way test",
    subtitle: "Timelapse source set",
    status: "review",
    setIds: ["set-milky-way"],
    tagIds: ["tag-digital", "tag-night", "tag-milky-way"],
    locationText: "Thailand",
    camera: "Mirrorless camera"
  },
  {
    id: "album-thailand-mountains",
    title: "Thailand mountains",
    subtitle: "Haze and long ridges",
    status: "draft",
    setIds: ["set-mountains", "set-north"],
    tagIds: ["tag-digital", "tag-mountains", "tag-chiang-mai"],
    locationText: "Northern Thailand",
    camera: "Mirrorless camera"
  },
  {
    id: "album-night-market",
    title: "Night market contact",
    subtitle: "Fast color notes",
    status: "published",
    setIds: ["set-bangkok", "set-night"],
    tagIds: ["tag-film", "tag-bangkok", "tag-night", "tag-street"],
    locationText: "Bangkok, Thailand",
    camera: "35mm film camera",
    filmStock: "Fuji 400"
  },
  {
    id: "album-china-mountains",
    title: "China mountains",
    subtitle: "Unpublished scan batch",
    status: "draft",
    setIds: ["set-mountains"],
    tagIds: ["tag-film", "tag-mountains", "tag-review"],
    locationText: "China",
    camera: "35mm film camera"
  },
  {
    id: "album-glass-towers",
    title: "Glass towers",
    subtitle: "Urban architecture",
    status: "hidden",
    setIds: ["set-architecture"],
    tagIds: ["tag-digital", "tag-architecture", "tag-bangkok"],
    locationText: "Bangkok, Thailand",
    camera: "Mirrorless camera"
  },
  {
    id: "album-selected-frames",
    title: "Selected frames 2025",
    subtitle: "Portfolio candidates",
    status: "review",
    setIds: [],
    tagIds: ["tag-selected", "tag-review", "tag-2025"],
    locationText: "Mixed locations",
    camera: "Mixed cameras"
  },
  {
    id: "album-drive-import-test",
    title: "Drive import test",
    subtitle: "Waiting for Google Drive connector",
    status: "draft",
    setIds: [],
    tagIds: ["tag-review"],
    locationText: "Unassigned",
    camera: "Unknown"
  }
];

const albums: ArchiveAlbum[] = albumSeeds.map((album, index) => {
  const firstPhotoId = photoIdFor(album.id, 1);

  return {
    ...album,
    slug: album.id.replace(/^album-/, ""),
    description: `${album.subtitle}. This is mock archive content for the first admin shell.`,
    publicDownloadPolicy: "inherit",
    coverLandscapeAssetId: assetId(firstPhotoId, "display"),
    coverPortraitAssetId: assetId(firstPhotoId, "display"),
    coverSquareAssetId: assetId(firstPhotoId, "thumb"),
    sortOrder: index,
    dateStart: "2025-01-15",
    dateEnd: "2025-01-15",
    createdAt: now,
    updatedAt: now,
    publishedAt: album.status === "published" ? now : undefined
  };
});

const photos: ArchivePhoto[] = albumSeeds.flatMap((album, albumIndex) =>
  photoPositionsForAlbum(album).map((position) => {
    const sourceIndex = album.id === "album-film-073" ? position - 1 : albumIndex * 3 + position - 1;
    const source = publicSeedPhotos[sourceIndex % publicSeedPhotos.length];
    const photoId = photoIdFor(album.id, position);
    const directTagIds = position === 1 ? ["tag-selected"] : position === 2 ? ["tag-review"] : [];

    return {
      id: photoId,
      albumId: album.id,
      slug: photoId.replace(/^photo-/, ""),
      title: `${album.title} ${String(position).padStart(2, "0")}`,
      description: "Mock frame for admin upload, tagging, cover, and review flows.",
      status: album.status === "published" ? "published" : album.status === "hidden" ? "hidden" : "review",
      position,
      frameNumber: position,
      tagIds: directTagIds,
      assetIds: [
        assetId(photoId, "thumb"),
        assetId(photoId, "display"),
        assetId(photoId, "expanded"),
        assetId(photoId, "downloadJpeg"),
        assetId(photoId, "sourceJpeg")
      ],
      dateTaken: "2025-01-15",
      locationText: album.locationText,
      width: source.width,
      height: source.height,
      dominantColor: source.dominantColor,
      createdAt: now,
      updatedAt: now,
      publishedAt: album.status === "published" ? now : undefined,
      hiddenAt: album.status === "hidden" ? now : undefined
    };
  })
);

const assets: ArchiveAsset[] = photos.flatMap((photo, index) => {
  const source = publicSeedPhotos[index % publicSeedPhotos.length];
  const publicUrl = `${source.r2.assetBaseUrl}/${source.r2.originalKey}`;

  return [
    makeAsset(photo, "thumb", "public", publicUrl, 480, 320, 84000),
    makeAsset(photo, "display", "public", publicUrl, 1600, 1066, 980000),
    makeAsset(photo, "expanded", "public", publicUrl, 2400, 1600, 2400000),
    makeAsset(photo, "downloadJpeg", "public", publicUrl, 3000, 2000, 3900000),
    makeAsset(photo, "sourceJpeg", "private", undefined, source.width, source.height, 12800000)
  ];
});

const sets: ArchiveSet[] = [
  makeSet("set-bangkok", "bangkok", "Bangkok nights", "Film and digital albums from Bangkok.", "published", 1, "fullscreen-carousel", [
    "album-bangkok-neon",
    "album-film-073",
    "album-night-market",
    "album-bangkok-architecture"
  ]),
  makeSet("set-mountains", "mountains", "Mountains", "Mountain albums from different trips.", "draft", 2, "six-grid", [
    "album-chegem-gorge",
    "album-thailand-mountains",
    "album-china-mountains"
  ]),
  makeSet("set-night", "night", "Night work", "Dark frames, markets, sky tests, long exposure candidates.", "published", 3, "split-feature", [
    "album-night-market",
    "album-bangkok-neon",
    "album-milky-way-test"
  ]),
  makeSet("set-architecture", "architecture", "Architecture", "Concrete, glass, shade, and city structure.", "review", 4, "editorial-row", [
    "album-bangkok-architecture",
    "album-glass-towers"
  ]),
  makeSet("set-milky-way", "milky-way", "Milky Way timelapse", "A future hero set for timelapse work.", "draft", 5, "fullscreen-carousel", [
    "album-milky-way-test"
  ]),
  makeSet("set-north", "north", "Northern Thailand", "Chiang Mai, mountain roads, and quiet daylight.", "draft", 6, "nine-grid", [
    "album-chiang-mai-rain",
    "album-thailand-mountains"
  ]),
  makeSet("set-film-index", "film-index", "Film index", "A dense index of rolls prepared for the public archive.", "published", 7, "nine-grid", [
    "album-film-073",
    "album-bangkok-neon",
    "album-night-market"
  ])
];

export const adminArchive: AdminArchive = adminArchiveSchema.parse({
  sets,
  albums,
  photos,
  assets,
  tags,
  collections: [
    {
      id: "collection-selected-work",
      slug: "selected-work",
      title: "Selected Work",
      description: "Future cross-album selection for the public site.",
      status: "review",
      coverAssetId: assetId(photoIdFor("album-bangkok-neon", 1), "display"),
      photoIdsWithOrder: photos.slice(0, 8).map((photo, position) => ({ photoId: photo.id, position })),
      createdAt: now,
      updatedAt: now
    }
  ],
  settings: {
    defaultAlbumStatus: "draft",
    defaultPhotoStatus: "review",
    expandedTargetMb: 2.5,
    publicDownloadMode: "downloadJpeg",
    downloadJpegTargetMb: 3.8,
    sourceJpegPublicAllowed: false,
    trashRetentionDays: 7,
    derivativeColorProfile: "srgb",
    sourceJpegPolicy: "preserve",
    publicExifPolicy: "strip-sensitive"
  },
  trash: [
    {
      id: "trash-old-import-01",
      entityType: "album",
      entityId: "album-old-import",
      title: "Old import attempt",
      deletedAt: "2026-05-10T12:00:00+07:00",
      purgeAfter: later,
      fileCount: 18,
      bytes: 640000000
    },
    {
      id: "trash-hidden-frame-01",
      entityType: "photo",
      entityId: "photo-private-test",
      title: "Private test frame",
      deletedAt: "2026-05-11T09:00:00+07:00",
      purgeAfter: later,
      fileCount: 5,
      bytes: 42000000
    }
  ],
  uploadJobs: [
    makeUploadJob("upload-001", "album-drive-import-test", "000035300041.jpg", "processing", 68, 12600000),
    makeUploadJob("upload-002", "album-drive-import-test", "000035300042.jpg", "review", 100, 11800000),
    makeUploadJob("upload-003", "album-selected-frames", "YS_2025_0312.jpg", "uploading", 34, 22400000)
  ]
});

function makeTag(id: string, slug: string, label: string, scope: ArchiveTag["scope"]): ArchiveTag {
  return {
    id,
    slug,
    label,
    scope,
    createdAt: now
  };
}

function makeSet(
  id: string,
  slug: string,
  title: string,
  subtitle: string,
  status: ArchiveSet["status"],
  order: number,
  layoutMode: SetLayoutMode,
  albumIds: string[]
): ArchiveSet {
  return {
    id,
    slug,
    title,
    subtitle,
    description: subtitle,
    status,
    order,
    layoutMode,
    albumIdsWithOrder: albumIds.map((albumId, position) => ({
      albumId,
      position,
      featured: position === 0
    })),
    createdAt: now,
    updatedAt: now,
    publishedAt: status === "published" ? now : undefined
  };
}

function makeAsset(
  photo: ArchivePhoto,
  version: ArchiveAsset["version"],
  access: ArchiveAsset["access"],
  publicUrl: string | undefined,
  width: number,
  height: number,
  bytes: number
): ArchiveAsset {
  return {
    id: assetId(photo.id, version),
    photoId: photo.id,
    version,
    access,
    bucket: access === "public" ? "yakov-public-assets" : "yakov-private-assets",
    key: `${version}/${photo.albumId}/${photo.slug}.jpg`,
    publicUrl,
    width,
    height,
    bytes,
    mimeType: "image/jpeg",
    colorProfile: version === "sourceJpeg" ? "preserve" : "srgb",
    createdAt: now
  };
}

function makeUploadJob(
  id: string,
  albumId: string,
  fileName: string,
  status: AdminArchive["uploadJobs"][number]["status"],
  progress: number,
  bytes: number
) {
  return {
    id,
    albumId,
    fileName,
    status,
    progress,
    bytes,
    derivatives: [
      { version: "thumb", status: progress > 30 ? "done" : "processing", progress: Math.min(100, progress + 35) },
      { version: "display", status: progress > 55 ? "done" : "processing", progress: Math.min(100, progress + 15) },
      { version: "expanded", status: progress > 75 ? "done" : "queued", progress: Math.max(0, progress - 10) },
      { version: "downloadJpeg", status: progress === 100 ? "done" : "queued", progress: Math.max(0, progress - 35) }
    ],
    createdAt: now
  };
}

function photoPositionsForAlbum(album: AlbumSeed) {
  return Array.from(
    { length: album.id === "album-film-073" ? publicSeedPhotos.length : 3 },
    (_, index) => index + 1
  );
}

function photoIdFor(albumId: string, position: number) {
  return `photo-${albumId.replace(/^album-/, "")}-${String(position).padStart(2, "0")}`;
}

function assetId(photoId: string, version: ArchiveAsset["version"]) {
  return `asset-${photoId.replace(/^photo-/, "")}-${version}`;
}
