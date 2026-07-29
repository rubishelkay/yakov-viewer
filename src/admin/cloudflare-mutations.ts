import { z } from "zod";

import {
  adminSettingsSchema,
  archiveStatusSchema,
  photoOrderDirectionSchema,
  publicDownloadPolicySchema,
  setLayoutModeSchema,
  tagScopeSchema
} from "./archive-schema";

const idSchema = z.string().trim().min(1).max(200);
const titleSchema = z.string().trim().min(1).max(160);
const subtitleSchema = z.string().trim().max(320);

export const cloudArchiveMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("updateAlbum"),
    albumId: idSchema,
    update: z.object({
      title: titleSchema.optional(),
      subtitle: subtitleSchema.optional(),
      status: archiveStatusSchema.exclude(["trash", "deleted"]).optional(),
      publicDownloadPolicy: publicDownloadPolicySchema.optional(),
      photoOrderDirection: photoOrderDirectionSchema.optional(),
      coverPriority: z.enum(["landscape", "square", "portrait"]).optional()
    }).refine((value) => Object.keys(value).length > 0)
  }),
  z.object({
    action: z.literal("reorderAlbum"),
    albumId: idSchema,
    direction: z.enum(["up", "down"])
  }),
  z.object({
    action: z.literal("moveAlbum"),
    albumId: idSchema,
    position: z.number().int().nonnegative()
  }),
  z.object({
    action: z.literal("trashAlbum"),
    albumId: idSchema
  }),
  z.object({
    action: z.literal("updatePhoto"),
    photoId: idSchema,
    update: z.object({
      title: titleSchema.optional(),
      status: archiveStatusSchema.exclude(["trash", "deleted"]).optional(),
      publicDownloadOverride: publicDownloadPolicySchema.nullable().optional(),
      tagIds: z.array(idSchema).max(100).optional()
    }).refine((value) => Object.keys(value).length > 0)
  }),
  z.object({
    action: z.literal("movePhoto"),
    albumId: idSchema,
    photoId: idSchema,
    position: z.number().int().positive()
  }),
  z.object({
    action: z.literal("trashPhoto"),
    photoId: idSchema
  }),
  z.object({
    action: z.literal("setAlbumCover"),
    albumId: idSchema,
    assetId: idSchema,
    coverType: z.enum(["landscape", "portrait", "square"])
  }),
  z.object({
    action: z.literal("addPhotoToAlbum"),
    albumId: idSchema,
    photoId: idSchema
  }),
  z.object({
    action: z.literal("removePhotoFromAlbum"),
    albumId: idSchema,
    photoId: idSchema
  }),
  z.object({
    action: z.literal("createSet"),
    title: titleSchema,
    subtitle: subtitleSchema.optional(),
    status: archiveStatusSchema.exclude(["trash", "deleted"]).optional(),
    layoutMode: setLayoutModeSchema.exclude(["custom"]).optional()
  }),
  z.object({
    action: z.literal("updateSet"),
    setId: idSchema,
    update: z.object({
      title: titleSchema.optional(),
      subtitle: subtitleSchema.optional(),
      status: archiveStatusSchema.exclude(["trash", "deleted"]).optional(),
      layoutMode: setLayoutModeSchema.exclude(["custom"]).optional()
    }).refine((value) => Object.keys(value).length > 0)
  }),
  z.object({
    action: z.literal("trashSet"),
    setId: idSchema
  }),
  z.object({
    action: z.literal("reorderSet"),
    setId: idSchema,
    direction: z.enum(["up", "down"])
  }),
  z.object({
    action: z.literal("addAlbumToSet"),
    setId: idSchema,
    albumId: idSchema
  }),
  z.object({
    action: z.literal("removeAlbumFromSet"),
    setId: idSchema,
    albumId: idSchema
  }),
  z.object({
    action: z.literal("reorderAlbumInSet"),
    setId: idSchema,
    albumId: idSchema,
    direction: z.enum(["left", "right"])
  }),
  z.object({
    action: z.literal("moveAlbumInSet"),
    setId: idSchema,
    albumId: idSchema,
    position: z.number().int().nonnegative()
  }),
  z.object({
    action: z.literal("setAlbumSets"),
    albumId: idSchema,
    setIds: z.array(idSchema)
      .max(100)
      .refine((ids) => new Set(ids).size === ids.length, "Set IDs must be unique.")
  }),
  z.object({
    action: z.literal("createTag"),
    label: titleSchema,
    scope: tagScopeSchema.optional()
  }),
  z.object({
    action: z.literal("updateTag"),
    tagId: idSchema,
    update: z.object({
      label: titleSchema.optional(),
      scope: tagScopeSchema.optional()
    }).refine((value) => Object.keys(value).length > 0)
  }),
  z.object({
    action: z.literal("deleteTag"),
    tagId: idSchema
  }),
  z.object({
    action: z.literal("attachAlbumTag"),
    albumId: idSchema,
    tagId: idSchema
  }),
  z.object({
    action: z.literal("detachAlbumTag"),
    albumId: idSchema,
    tagId: idSchema
  }),
  z.object({
    action: z.literal("updateSettings"),
    update: adminSettingsSchema.partial().refine((value) => Object.keys(value).length > 0)
  }),
  z.object({
    action: z.literal("restoreItem"),
    itemId: idSchema
  }),
  z.object({
    action: z.literal("purgeItem"),
    itemId: idSchema
  })
]);

export type CloudArchiveMutation = z.infer<typeof cloudArchiveMutationSchema>;
