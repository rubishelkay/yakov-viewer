export type DecisionValue = "keep" | "pass";

export type AlbumSummary = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  coverUrl: string;
  photoCount: number;
};

export type AlbumDecisionProgress = {
  albumId: string;
  keptCount: number;
  passedCount: number;
  totalCount: number;
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

export type AccountPhoto = PublicPhoto & {
  sourceAlbumTitle: string;
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
  /** Opaque, time-prefixed mutation token; compare exactly rather than parsing it. */
  updatedAt: string;
};

export type DecisionDeletionRecord = {
  photoId: string;
  deleted: boolean;
};

export type DecisionUndoRequest = {
  expectedUpdatedAt: string;
  previousDecision: DecisionValue | null;
};

export type DecisionUndoResult = {
  decision: DecisionRecord | null;
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
  keptPhotos: AccountPhoto[];
  passedPhotos: AccountPhoto[];
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
