import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";
import {
  readPublicAlbums,
  readPublicTags
} from "@/server/cloudflare/public-portfolio-d1";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url.replace(/\/$/, "");
  const staticRoutes = ["", "/albums", "/about"];
  const [albums, tags] = await Promise.all([readPublicAlbums(), readPublicTags()]);
  const albumRoutes = albums.map((album) => `/albums/${album.slug}`);
  const tagRoutes = tags.map((tag) => `/tags/${tag.slug}`);

  return [...staticRoutes, ...albumRoutes, ...tagRoutes].map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date()
  }));
}
