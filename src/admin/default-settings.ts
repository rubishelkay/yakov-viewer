import type { AdminSettings } from "./archive-schema";

export const defaultAdminSettings: AdminSettings = {
  defaultAlbumStatus: "draft",
  defaultPhotoStatus: "review",
  expandedTargetMb: 2.5,
  publicDownloadMode: "downloadJpeg",
  downloadJpegTargetMb: 3.8,
  sourceJpegPublicAllowed: false,
  trashRetentionDays: 7,
  derivativeColorProfile: "srgb",
  sourceJpegPolicy: "preserve",
  publicExifPolicy: "strip-sensitive"
};
