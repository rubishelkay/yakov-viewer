import type { Photo } from "@/content/schema";

export const IMAGE_WIDTHS = {
  thumb: [320, 480, 640],
  grid: [480, 800, 1200],
  detail: [1200, 1600, 2400],
  hero: [1200, 1600, 2400, 3200]
} as const;

export type ImagePreset = keyof typeof IMAGE_WIDTHS;

type TransformOptions = {
  width: number;
  quality?: number;
  format?: "auto" | "avif" | "webp" | "jpeg";
};

export function getSourceImageUrl(photo: Photo): string {
  return `${photo.r2.assetBaseUrl.replace(/\/$/, "")}/${photo.r2.originalKey}`;
}

export function buildCloudflareImageUrl(sourceUrl: string, options: TransformOptions): string {
  const transformBase =
    process.env.NEXT_PUBLIC_IMAGE_TRANSFORM_BASE_URL?.replace(/\/$/, "") ??
    "https://yakov.shmol.cc";
  const params = [
    `width=${options.width}`,
    `quality=${options.quality ?? 85}`,
    `format=${options.format ?? "auto"}`
  ].join(",");

  return `${transformBase}/cdn-cgi/image/${params}/${encodeURI(sourceUrl)}`;
}

export function shouldUseTransforms(): boolean {
  if (process.env.NEXT_PUBLIC_FORCE_IMAGE_TRANSFORMS === "true") {
    return true;
  }

  return process.env.NODE_ENV === "production";
}

export function getImageUrl(photo: Photo, width: number, quality = 85): string {
  const sourceUrl = getSourceImageUrl(photo);

  if (!shouldUseTransforms()) {
    return sourceUrl;
  }

  return buildCloudflareImageUrl(sourceUrl, { width, quality });
}

export function getSrcSet(photo: Photo, preset: ImagePreset): string {
  return IMAGE_WIDTHS[preset]
    .map((width) => `${getImageUrl(photo, width)} ${width}w`)
    .join(", ");
}

export function getResponsiveImageAttrs(photo: Photo, preset: ImagePreset) {
  const widths = IMAGE_WIDTHS[preset];
  const fallbackWidth = widths[Math.min(1, widths.length - 1)];

  return {
    src: getImageUrl(photo, fallbackWidth),
    srcSet: getSrcSet(photo, preset),
    width: photo.width,
    height: photo.height,
    style: {
      backgroundColor: photo.dominantColor
    }
  };
}
