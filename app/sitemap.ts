import type { MetadataRoute } from "next";

import { adminArchive } from "@/admin/mock-data";
import { getPublishedFilms, getPublishedPhotos } from "@/content";
import { portfolioManifest } from "@/content/portfolio-manifest";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url.replace(/\/$/, "");
  const staticRoutes = ["", "/albums", "/films", "/archive", "/about", "/digital", "/collections"];
  const albumRoutes = portfolioManifest.albums.map((album) => `/albums/${album.slug}`);
  const publicTagIds = new Set(
    adminArchive.albums
      .filter((album) => album.status === "published" && !album.isDemo)
      .flatMap((album) => album.tagIds)
  );
  const tagRoutes = adminArchive.tags
    .filter((tag) => publicTagIds.has(tag.id))
    .map((tag) => `/tags/${tag.slug}`);
  const filmRoutes = getPublishedFilms().map((film) => `/films/${film.slug}`);
  const photoRoutes = getPublishedPhotos().map((photo) => `/photos/${photo.slug}`);

  return [...staticRoutes, ...albumRoutes, ...tagRoutes, ...filmRoutes, ...photoRoutes].map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date()
  }));
}
