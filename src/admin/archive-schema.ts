import { z } from "zod";

export const archiveStatusSchema = z.enum([
  "draft",
  "review",
  "published",
  "hidden",
  "trash",
  "deleted"
]);

export const setLayoutModeSchema = z.enum([
  "fullscreen-carousel",
  "triptych",
  "quad-feature",
  "six-grid",
  "nine-grid",
  "editorial-row",
  "split-feature",
  "panorama-strip",
  "custom"
]);

export const assetVersionSchema = z.enum([
  "thumb",
  "display",
  "expanded",
  "downloadJpeg",
  "sourceJpeg",
  "master"
]);

export const tagScopeSchema = z.enum(["album", "photo", "both"]);
export const assetAccessSchema = z.enum(["public", "private"]);
export const publicDownloadPolicySchema = z.enum(["inherit", "none", "expanded", "downloadJpeg"]);
export const uploadJobStatusSchema = z.enum(["queued", "uploading", "processing", "review", "failed"]);

const timestampSchema = z.string().min(1);

export const setAlbumRefSchema = z.object({
  albumId: z.string().min(1),
  position: z.number().int().nonnegative(),
  featured: z.boolean().default(false)
});

export const archiveSetSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().default(""),
  description: z.string().default(""),
  status: archiveStatusSchema,
  order: z.number().int(),
  layoutMode: setLayoutModeSchema,
  albumIdsWithOrder: z.array(setAlbumRefSchema),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  publishedAt: timestampSchema.optional(),
  deletedAt: timestampSchema.optional()
});

export const archiveAlbumSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().default(""),
  description: z.string().default(""),
  status: archiveStatusSchema,
  setIds: z.array(z.string().min(1)).default([]),
  tagIds: z.array(z.string().min(1)).default([]),
  publicDownloadPolicy: publicDownloadPolicySchema,
  coverLandscapeAssetId: z.string().min(1).optional(),
  coverPortraitAssetId: z.string().min(1).optional(),
  coverSquareAssetId: z.string().min(1).optional(),
  sortOrder: z.number().int().default(0),
  dateStart: z.string().optional(),
  dateEnd: z.string().optional(),
  locationText: z.string().optional(),
  camera: z.string().optional(),
  filmStock: z.string().optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  publishedAt: timestampSchema.optional(),
  deletedAt: timestampSchema.optional()
});

export const archivePhotoSchema = z.object({
  id: z.string().min(1),
  albumId: z.string().min(1),
  originAlbumId: z.string().min(1).optional(),
  slug: z.string().min(1),
  sourcePhotoId: z.string().min(1).optional(),
  title: z.string().min(1),
  description: z.string().default(""),
  status: archiveStatusSchema,
  position: z.number().int().nonnegative(),
  frameNumber: z.number().int().positive().optional(),
  tagIds: z.array(z.string().min(1)).default([]),
  assetIds: z.array(z.string().min(1)).default([]),
  publicDownloadOverride: publicDownloadPolicySchema.optional(),
  dateTaken: z.string().optional(),
  locationText: z.string().optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  dominantColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  publishedAt: timestampSchema.optional(),
  hiddenAt: timestampSchema.optional(),
  deletedAt: timestampSchema.optional()
});

export const archiveAssetSchema = z.object({
  id: z.string().min(1),
  photoId: z.string().min(1).optional(),
  albumId: z.string().min(1).optional(),
  version: assetVersionSchema,
  access: assetAccessSchema,
  bucket: z.string().min(1),
  key: z.string().min(1),
  publicUrl: z.string().url().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  bytes: z.number().int().nonnegative(),
  mimeType: z.string().min(1),
  colorProfile: z.enum(["srgb", "display-p3", "preserve"]).default("srgb"),
  createdAt: timestampSchema
});

export const archiveTagSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  label: z.string().min(1),
  scope: tagScopeSchema,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  createdAt: timestampSchema
});

export const archiveCollectionSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(""),
  status: archiveStatusSchema,
  coverAssetId: z.string().min(1).optional(),
  photoIdsWithOrder: z.array(
    z.object({
      photoId: z.string().min(1),
      position: z.number().int().nonnegative()
    })
  ),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  publishedAt: timestampSchema.optional()
});

export const adminSettingsSchema = z.object({
  defaultAlbumStatus: archiveStatusSchema,
  defaultPhotoStatus: archiveStatusSchema,
  expandedTargetMb: z.number().positive(),
  publicDownloadMode: publicDownloadPolicySchema,
  downloadJpegTargetMb: z.number().positive(),
  sourceJpegPublicAllowed: z.boolean(),
  trashRetentionDays: z.number().int().positive(),
  derivativeColorProfile: z.enum(["srgb", "display-p3", "preserve"]),
  sourceJpegPolicy: z.enum(["preserve", "normalize"]),
  publicExifPolicy: z.enum(["strip-sensitive", "strip-all", "preserve"])
});

export const trashItemSchema = z.object({
  id: z.string().min(1),
  entityType: z.enum(["set", "album", "photo", "asset", "collection"]),
  entityId: z.string().min(1),
  title: z.string().min(1),
  deletedAt: timestampSchema,
  purgeAfter: timestampSchema,
  fileCount: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
  restoreStatus: archiveStatusSchema.optional(),
  restorePhotoStatuses: z.array(
    z.object({
      hiddenAt: timestampSchema.optional(),
      photoId: z.string().min(1),
      status: archiveStatusSchema
    })
  ).optional(),
  restoreSetRefs: z.array(
    z.object({
      setId: z.string().min(1),
      albumRef: setAlbumRefSchema
    })
  ).optional()
});

export const uploadDerivativeSchema = z.object({
  version: assetVersionSchema,
  status: z.enum(["queued", "processing", "done", "failed"]),
  progress: z.number().min(0).max(100)
});

export const uploadJobSchema = z.object({
  id: z.string().min(1),
  albumId: z.string().min(1),
  fileName: z.string().min(1),
  status: uploadJobStatusSchema,
  progress: z.number().min(0).max(100),
  bytes: z.number().int().nonnegative(),
  derivatives: z.array(uploadDerivativeSchema),
  createdAt: timestampSchema
});

export const adminArchiveSchema = z.object({
  sets: z.array(archiveSetSchema),
  albums: z.array(archiveAlbumSchema),
  photos: z.array(archivePhotoSchema),
  assets: z.array(archiveAssetSchema),
  tags: z.array(archiveTagSchema),
  collections: z.array(archiveCollectionSchema),
  settings: adminSettingsSchema,
  trash: z.array(trashItemSchema),
  uploadJobs: z.array(uploadJobSchema)
});

export type ArchiveStatus = z.infer<typeof archiveStatusSchema>;
export type SetLayoutMode = z.infer<typeof setLayoutModeSchema>;
export type AssetVersion = z.infer<typeof assetVersionSchema>;
export type TagScope = z.infer<typeof tagScopeSchema>;
export type PublicDownloadPolicy = z.infer<typeof publicDownloadPolicySchema>;
export type ArchiveSet = z.infer<typeof archiveSetSchema>;
export type ArchiveAlbum = z.infer<typeof archiveAlbumSchema>;
export type ArchivePhoto = z.infer<typeof archivePhotoSchema>;
export type ArchiveAsset = z.infer<typeof archiveAssetSchema>;
export type ArchiveTag = z.infer<typeof archiveTagSchema>;
export type ArchiveCollection = z.infer<typeof archiveCollectionSchema>;
export type AdminSettings = z.infer<typeof adminSettingsSchema>;
export type TrashItem = z.infer<typeof trashItemSchema>;
export type UploadJob = z.infer<typeof uploadJobSchema>;
export type AdminArchive = z.infer<typeof adminArchiveSchema>;
