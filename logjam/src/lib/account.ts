import type { AccountPayload, DecisionValue } from "../../shared/contracts";

export function reclassifyAccountPhoto(
  account: AccountPayload,
  photoId: string,
  decision: DecisionValue,
  updatedAt = new Date().toISOString()
): AccountPayload {
  const photo = account.keptPhotos.find((candidate) => candidate.id === photoId)
    ?? account.passedPhotos.find((candidate) => candidate.id === photoId);
  if (!photo) return account;

  const keptPhotos = account.keptPhotos.filter((candidate) => candidate.id !== photoId);
  const passedPhotos = account.passedPhotos.filter((candidate) => candidate.id !== photoId);

  if (decision === "keep") keptPhotos.unshift(photo);
  else passedPhotos.unshift(photo);

  return {
    ...account,
    decisions: [
      { photoId, decision, updatedAt },
      ...account.decisions.filter((record) => record.photoId !== photoId)
    ],
    keptPhotos,
    passedPhotos
  };
}
