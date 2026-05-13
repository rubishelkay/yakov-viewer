import { z } from "zod";

export const visibilitySchema = z.enum(["published", "hidden", "draft"]);

export const locationSchema = z.object({
  city: z.string().min(1),
  country: z.string().min(1),
  showExact: z.boolean().default(false)
});

export const rightsSchema = z.object({
  copyright: z.string().min(1),
  downloadAllowed: z.boolean().default(false),
  downloadUrl: z.string().url().optional()
});

export const photoSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  sourceType: z.enum(["film", "digital"]),
  filmId: z.string().optional(),
  frameNumber: z.number().int().positive().optional(),
  title: z.string().min(1),
  description: z.string().default(""),
  alt: z.string().min(12),
  visibility: visibilitySchema,
  featured: z.boolean().default(false),
  archiveOnly: z.boolean().default(false),
  heroCandidate: z.boolean().default(false),
  coverCandidate: z.boolean().default(false),
  dateTaken: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  location: locationSchema,
  camera: z.string().min(1).optional(),
  lens: z.string().min(1).optional(),
  filmStock: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).default([]),
  aspectRatio: z.number().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  dominantColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  r2: z.object({
    originalKey: z.string().min(1),
    assetBaseUrl: z.string().url()
  }),
  rights: rightsSchema
});

export const filmSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  type: z.literal("film"),
  title: z.string().min(1),
  shortTitle: z.string().min(1),
  description: z.string().min(1),
  dateStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  year: z.number().int(),
  location: locationSchema,
  camera: z.string().min(1),
  lens: z.string().min(1).optional(),
  filmStock: z.string().min(1),
  iso: z.number().int().positive().optional(),
  coverImageId: z.string().min(1),
  tags: z.array(z.string().min(1)).default([]),
  visibility: visibilitySchema,
  order: z.number().int(),
  notes: z.string().optional()
});

export const collectionSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  coverImageId: z.string().min(1),
  imageIds: z.array(z.string().min(1)),
  tags: z.array(z.string().min(1)).default([]),
  visibility: visibilitySchema,
  order: z.number().int()
});

export const contentSchema = z.object({
  films: z.array(filmSchema),
  photos: z.array(photoSchema),
  collections: z.array(collectionSchema)
});

export type Film = z.infer<typeof filmSchema>;
export type Photo = z.infer<typeof photoSchema>;
export type Collection = z.infer<typeof collectionSchema>;
export type Content = z.infer<typeof contentSchema>;
