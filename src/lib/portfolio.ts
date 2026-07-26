import { getPortfolioAssetUrl, portfolioManifest } from "@/content/portfolio-manifest";

export type PublicTag = {
  label: string;
  slug: string;
};

export type PublicAlbumSummary = {
  coverUrl: string;
  filterTags: PublicTag[];
  id: string;
  kind: "film" | "digital";
  photoCount: number;
  slug: string;
  subtitle: string;
  subtitleTags: Array<{ label: string; slug?: string }>;
  tagSlugs: string[];
  title: string;
};

export type PublicPhoto = {
  displayUrl: string;
  downloadUrl?: string;
  expandedUrl: string;
  height: number;
  id: string;
  thumbUrl: string;
  title: string;
  width: number;
};

export type PublicAlbumDetail = PublicAlbumSummary & {
  photos: PublicPhoto[];
};

const orderedManifestAlbums = [...portfolioManifest.albums].sort((a, b) => a.order - b.order);

const albumSummaries = orderedManifestAlbums.map<PublicAlbumSummary>((album) => {
  const tagLabels = getAlbumTagLabels(album);
  const tagSlugs = tagLabels.map(slugify);
  const coverImage =
    album.images.find((image) => image.srcKey === stripLeadingSlash(album.coverImage)) ??
    album.images[0];

  return {
    coverUrl: getPortfolioAssetUrl(coverImage.thumbKey),
    filterTags: tagLabels.map((label) => ({ label, slug: slugify(label) })),
    id: album.id,
    kind: album.type,
    photoCount: album.images.length,
    slug: album.slug,
    subtitle: album.subtitle,
    subtitleTags: album.subtitle
      .split(",")
      .map((label) => label.trim())
      .filter(Boolean)
      .map((label) => {
        const slug = slugify(label);
        return tagSlugs.includes(slug) ? { label, slug } : { label };
      }),
    tagSlugs,
    title: album.title
  };
});

const summaryBySlug = new Map(albumSummaries.map((album) => [album.slug, album]));

export function getPublicAlbums(): PublicAlbumSummary[] {
  return albumSummaries;
}

export function getHomepageAlbums(): PublicAlbumSummary[] {
  return albumSummaries;
}

export function getHeroAlbums(): PublicAlbumSummary[] {
  return albumSummaries.slice(0, 5);
}

export function getPublicAlbumBySlug(slug: string): PublicAlbumDetail | undefined {
  const manifestAlbum = orderedManifestAlbums.find((album) => album.slug === slug);
  const summary = summaryBySlug.get(slug);

  if (!manifestAlbum || !summary) return undefined;

  return {
    ...summary,
    photos: [...manifestAlbum.images]
      .sort((a, b) => a.position - b.position)
      .map((image) => ({
        displayUrl: getPortfolioAssetUrl(image.srcKey),
        expandedUrl: getPortfolioAssetUrl(image.srcKey),
        height: image.height,
        id: image.id,
        thumbUrl: getPortfolioAssetUrl(image.thumbKey),
        title: image.alt,
        width: image.width
      }))
  };
}

export function getPublicTags(): PublicTag[] {
  const labelsBySlug = new Map<string, string>();

  for (const album of orderedManifestAlbums) {
    for (const label of getAlbumTagLabels(album)) {
      labelsBySlug.set(slugify(label), label);
    }
  }

  return Array.from(labelsBySlug, ([slug, label]) => ({ label, slug }));
}

export function getPublicTagBySlug(slug: string): PublicTag | undefined {
  return getPublicTags().find((tag) => tag.slug === slug);
}

export function getPublicAlbumsForTag(slug: string): PublicAlbumSummary[] {
  return albumSummaries.filter((album) => album.tagSlugs.includes(slug));
}

export function isFilmAlbum(album: PublicAlbumSummary) {
  return album.kind === "film";
}

function getAlbumTagLabels(album: (typeof portfolioManifest.albums)[number]) {
  return Array.from(
    new Set(
      [album.type, album.year, album.location, album.filmStock, ...album.tags]
        .map((label) => label.trim())
        .filter(Boolean)
    )
  );
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
