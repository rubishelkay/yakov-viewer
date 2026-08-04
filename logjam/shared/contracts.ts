export type DecisionValue = "keep" | "pass";

export type AlbumSummary = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  coverUrl: string;
  photoCount: number;
};

export type PublicPhoto = {
  id: string;
  slug: string;
  title: string;
  width: number;
  height: number;
  thumbUrl: string;
  displayUrl: string;
};

export type AlbumDetail = AlbumSummary & {
  photos: PublicPhoto[];
  nextAlbumSlug: string | null;
};

export type Viewer = {
  id: string;
  email: string;
  displayName: string;
};

export type DecisionRecord = {
  photoId: string;
  decision: DecisionValue;
  updatedAt: string;
};

export type CurationSummary = {
  id: string;
  title: string;
  status: "active" | "archived";
  revision: number;
  itemCount: number;
  submissionCount: number;
  locked: boolean;
  updatedAt: string;
};

export type CurationDetail = CurationSummary & {
  photos: PublicPhoto[];
  submissions: Array<{
    id: string;
    version: number;
    itemCount: number;
    submittedAt: string;
    promotedAlbumId: string | null;
    status: "submitted" | "archived";
  }>;
};

export type AccountPayload = {
  viewer: Viewer;
  decisions: DecisionRecord[];
  curations: CurationSummary[];
  keptPhotos: PublicPhoto[];
  passedPhotos: PublicPhoto[];
};

export type PendingDecision = {
  kind: "decision";
  photoId: string;
  decision: DecisionValue;
  returnTo: string;
};

export type ApiErrorPayload = {
  error: {
    code: string;
    message: string;
  };
};
