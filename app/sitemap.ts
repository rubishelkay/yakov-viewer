import type { MetadataRoute } from "next";

import { getPublicAlbums, getPublicTags } from "@/lib/portfolio";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url.replace(/\/$/, "");
  const staticRoutes = ["", "/albums", "/about"];
  const albumRoutes = getPublicAlbums().map((album) => `/albums/${album.slug}`);
  const tagRoutes = getPublicTags().map((tag) => `/tags/${tag.slug}`);

  return [...staticRoutes, ...albumRoutes, ...tagRoutes].map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date()
  }));
}
