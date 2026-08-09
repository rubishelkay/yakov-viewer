import type { AlbumDetail, DecisionValue } from "../../shared/contracts";

export function isAlbumDecisionComplete(
  album: Pick<AlbumDetail, "photos">,
  decisions: Readonly<Record<string, DecisionValue>>
): boolean {
  return album.photos.every((photo) => decisions[photo.id] !== undefined);
}

export function shouldRenderAlbumInFeed(
  album: Pick<AlbumDetail, "id" | "photos">,
  decisions: Readonly<Record<string, DecisionValue>>,
  activeMemberships: ReadonlySet<string>
): boolean {
  return !isAlbumDecisionComplete(album, decisions)
    || album.photos.some((photo) => activeMemberships.has(`${album.id}:${photo.id}`));
}

type ArrowShortcutEvent = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey"
>;

export function decisionFromArrowShortcut(event: ArrowShortcutEvent): DecisionValue | null {
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return null;
  if (event.key === "ArrowLeft") return "pass";
  if (event.key === "ArrowRight") return "keep";
  return null;
}
