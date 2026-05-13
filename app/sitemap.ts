import type { MetadataRoute } from "next";

import { getPublishedFilms, getPublishedPhotos } from "@/content";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url.replace(/\/$/, "");
  const staticRoutes = ["", "/films", "/archive", "/about", "/digital", "/collections"];
  const filmRoutes = getPublishedFilms().map((film) => `/films/${film.slug}`);
  const photoRoutes = getPublishedPhotos().map((photo) => `/photos/${photo.slug}`);

  return [...staticRoutes, ...filmRoutes, ...photoRoutes].map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date()
  }));
}
