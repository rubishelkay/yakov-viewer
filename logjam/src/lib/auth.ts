import type { DecisionValue, PendingDecision } from "../../shared/contracts";
import { parsePendingDecision, safeReturnTo } from "../../shared/logic";

const PENDING_KEY = "logjam.pending-action.v1";
const AUTH_HINT_KEY = "logjam.authenticated.v1";

export function redirectToSignIn(returnTo = currentReturnTo()): void {
  const safe = safeReturnTo(returnTo);
  replaceWithAuth(window.location, safe);
}

export function replaceWithAuth(
  navigation: Pick<Location, "replace">,
  returnTo: string
): void {
  const safe = safeReturnTo(returnTo);
  navigation.replace(`/auth/start?returnTo=${encodeURIComponent(safe)}`);
}

export function preserveDecisionAndSignIn(photoId: string, decision: DecisionValue): void {
  const pending: PendingDecision = {
    kind: "decision",
    photoId,
    decision,
    returnTo: currentReturnTo()
  };
  try {
    window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    // The route still survives; only automatic replay is unavailable.
  }
  redirectToSignIn(pending.returnTo);
}

export function readPendingDecision(): PendingDecision | null {
  try {
    return parsePendingDecision(window.sessionStorage.getItem(PENDING_KEY));
  } catch {
    return null;
  }
}

export function clearPendingDecision(): void {
  try {
    window.sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // Storage is an enhancement, not the source of truth.
  }
}

export function setAuthenticatedHint(value: boolean): void {
  try {
    if (value) window.localStorage.setItem(AUTH_HINT_KEY, "true");
    else window.localStorage.removeItem(AUTH_HINT_KEY);
  } catch {
    // Ignore browsers with blocked storage.
  }
}

export function hasAuthenticatedHint(): boolean {
  try {
    return window.localStorage.getItem(AUTH_HINT_KEY) === "true";
  } catch {
    return false;
  }
}

export function currentReturnTo(): string {
  return safeReturnTo(`${window.location.pathname}${window.location.search}${window.location.hash}`);
}
