import { z } from "zod";

import rawManifest from "./portfolio-manifest.json";

const portfolioImageSchema = z.object({
  id: z.string().min(1),
  srcKey: z.string().min(1),
  thumbKey: z.string().min(1),
  srcBytes: z.number().int().positive(),
  thumbBytes: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  orientation: z.enum(["landscape", "portrait", "square"]),
  alt: z.string().min(1),
  position: z.number().int().positive()
});

const portfolioAlbumSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string(),
  type: z.enum(["film", "digital"]),
  year: z.string(),
  location: z.string(),
  filmStock: z.string(),
  tags: z.array(z.string().min(1)),
  coverImage: z.string().min(1),
  coverThumb: z.string().min(1),
  order: z.number().int().nonnegative(),
  images: z.array(portfolioImageSchema).min(1)
});

const portfolioManifestSchema = z.object({
  source: z.string().min(1),
  albums: z.array(portfolioAlbumSchema).min(1),
  hero: z.array(
    z.object({
      id: z.string().min(1),
      albumSlug: z.string().min(1),
      albumTitle: z.string().min(1)
    })
  )
});

export const portfolioManifest = portfolioManifestSchema.parse(rawManifest);

export type PortfolioAlbum = z.infer<typeof portfolioAlbumSchema>;
export type PortfolioImage = z.infer<typeof portfolioImageSchema>;

export function getPortfolioAssetUrl(key: string) {
  const defaultBaseUrl = "https://assets.yakov.shmol.cc";
  const baseUrl =
    process.env.NEXT_PUBLIC_ASSET_BASE_URL?.replace(/\/$/, "") ??
    defaultBaseUrl;

  return `${baseUrl}/${key.replace(/^\/+/, "")}`;
}
