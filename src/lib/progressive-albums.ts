export const publicAlbumBatchSize = 15;

export function nextPublicAlbumCount(
  current: number,
  total: number,
  batchSize = publicAlbumBatchSize
) {
  return Math.min(total, Math.max(0, current) + batchSize);
}
