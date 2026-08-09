import type { AlbumDecisionProgress } from "../../shared/contracts";

export type AlbumProgressStatus = "anonymous" | "loading" | "ready" | "error";

export function formatAlbumProgress(progress: AlbumDecisionProgress): string {
  return `${progress.keptCount} kept · ${progress.passedCount} passed`;
}

export function isAlbumFullyDecided(progress: AlbumDecisionProgress | undefined): boolean {
  return Boolean(
    progress
      && progress.totalCount > 0
      && progress.keptCount + progress.passedCount === progress.totalCount
  );
}

export function shouldLockAlbumNavigation(
  status: AlbumProgressStatus,
  progress: AlbumDecisionProgress | undefined
): boolean {
  return status === "loading" || status === "error" || isAlbumFullyDecided(progress);
}
