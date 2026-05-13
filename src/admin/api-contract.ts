import type {
  AdminArchive,
  ArchiveAlbum,
  ArchiveSet,
  ArchiveTag,
  PublicDownloadPolicy,
  SetLayoutMode,
  UploadJob
} from "./archive-schema";

export type ApiEnvelope<T> = {
  ok: true;
  data: T;
  meta: {
    source: "mock" | "d1" | "r2" | "stub";
    generatedAt: string;
  };
};

export type ApiErrorEnvelope = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
  meta: {
    generatedAt: string;
  };
};

export type AdminArchiveResponse = ApiEnvelope<AdminArchive>;

export type AdminSetsResponse = ApiEnvelope<{
  sets: ArchiveSet[];
}>;

export type AdminAlbumsResponse = ApiEnvelope<{
  albums: ArchiveAlbum[];
}>;

export type AdminTagsResponse = ApiEnvelope<{
  tags: ArchiveTag[];
}>;

export type CreateAlbumRequest = {
  title: string;
  setIds?: string[];
  tagIds?: string[];
  publicDownloadPolicy?: PublicDownloadPolicy;
};

export type CreateAlbumResponse = ApiEnvelope<{
  album: ArchiveAlbum;
}>;

export type UpdateSetRequest = {
  title?: string;
  subtitle?: string;
  status?: ArchiveSet["status"];
  layoutMode?: SetLayoutMode;
  albumIdsWithOrder?: ArchiveSet["albumIdsWithOrder"];
};

export type SignedUploadRequest = {
  albumId: string;
  files: Array<{
    fileName: string;
    bytes: number;
    mimeType: "image/jpeg";
    position: number;
  }>;
};

export type SignedUploadResponse = ApiEnvelope<{
  uploadBatchId: string;
  jobs: UploadJob[];
  uploadMethod: "r2-direct-upload";
  expiresInSeconds: number;
}>;

export const adminApiRoutes = {
  archive: "/api/admin/archive",
  sets: "/api/admin/sets",
  albums: "/api/admin/albums",
  tags: "/api/admin/tags",
  signUpload: "/api/admin/uploads/sign"
} as const;

export const publicApiRoutes = {
  sets: "/api/public/sets",
  albums: "/api/public/albums",
  photos: "/api/public/photos"
} as const;

