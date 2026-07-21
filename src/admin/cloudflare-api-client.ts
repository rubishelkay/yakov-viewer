import { z } from "zod";

import {
  adminArchiveSchema,
  albumPhotoSchema,
  archiveAlbumSchema,
  archiveAssetSchema,
  archivePhotoSchema,
  uploadJobSchema,
  type ArchiveAlbum,
  type ArchiveStatus,
  type PublicDownloadPolicy
} from "./archive-schema";

const uploadPhotoResultSchema = z.object({
  photo: archivePhotoSchema,
  albumPhoto: albumPhotoSchema,
  asset: archiveAssetSchema,
  assets: z.array(archiveAssetSchema).min(1),
  uploadJob: uploadJobSchema,
  adminPreviewUrl: z.string().startsWith("/api/admin/assets/")
});

export type UploadPhotoResult = z.infer<typeof uploadPhotoResultSchema>;

export async function readCloudflareArchive() {
  return adminArchiveSchema.parse(await requestData("/api/admin/archive/"));
}

export async function createCloudflareAlbum(input: {
  title: string;
  subtitle?: string;
  status?: ArchiveStatus;
  publicDownloadPolicy?: PublicDownloadPolicy;
}): Promise<ArchiveAlbum> {
  return archiveAlbumSchema.parse(
    await requestData("/api/admin/albums/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    })
  );
}

export async function uploadCloudflareJpeg(
  albumId: string,
  input: {
    clientUploadId: string;
    display: { blob: Blob; height: number; width: number };
    file: File;
    height: number;
    thumb: { blob: Blob; height: number; width: number };
    title?: string;
    width: number;
  }
): Promise<UploadPhotoResult> {
  const body = new FormData();
  body.set("file", input.file);
  body.set("width", String(input.width));
  body.set("height", String(input.height));
  body.set("clientUploadId", input.clientUploadId);
  body.set("thumb", input.thumb.blob, derivativeFileName(input.file.name, "thumb"));
  body.set("thumbWidth", String(input.thumb.width));
  body.set("thumbHeight", String(input.thumb.height));
  body.set("display", input.display.blob, derivativeFileName(input.file.name, "display"));
  body.set("displayWidth", String(input.display.width));
  body.set("displayHeight", String(input.display.height));
  if (input.title) body.set("title", input.title);

  return uploadPhotoResultSchema.parse(
    await requestData(`/api/admin/albums/${encodeURIComponent(albumId)}/photos/`, {
      method: "POST",
      body
    })
  );
}

export function getCloudflareAdminAssetUrl(assetId: string) {
  return `/api/admin/assets/${encodeURIComponent(assetId)}/`;
}

async function requestData(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, { ...init, cache: "no-store" });
  const payload = await response.json() as {
    ok: boolean;
    data?: unknown;
    error?: { code?: string; message?: string };
  };

  if (!response.ok || !payload.ok) {
    throw new CloudflareArchiveApiError(
      payload.error?.code ?? "request_failed",
      payload.error?.message ?? `Cloudflare archive request failed with ${response.status}.`,
      response.status
    );
  }

  return payload.data;
}

export class CloudflareArchiveApiError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
  }
}

function derivativeFileName(sourceName: string, version: "display" | "thumb") {
  const stem = sourceName.replace(/\.[^.]+$/, "") || "photo";
  return `${stem}-${version}.jpg`;
}
