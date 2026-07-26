import type { AdminSettings } from "./archive-schema";

export const defaultAdminSettings: AdminSettings = {
  defaultAlbumStatus: "draft",
  defaultPhotoStatus: "review",
  expandedTargetMb: 5,
  publicDownloadMode: "none",
  downloadJpegTargetMb: 5,
  sourceJpegPublicAllowed: false,
  trashRetentionDays: 7,
  derivativeColorProfile: "srgb",
  sourceJpegPolicy: "preserve",
  publicExifPolicy: "strip-sensitive"
};
