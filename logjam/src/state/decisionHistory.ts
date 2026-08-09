import type { DecisionValue } from "../../shared/contracts";

export type DecisionUndoEntry = {
  photoId: string;
  previous: DecisionValue | undefined;
  next: DecisionValue;
  expectedUpdatedAt: string;
  context?: string;
};

export type DecisionUndoSessionState = {
  sessionId: string | null;
  history: DecisionUndoEntry[];
};

export function beginDecisionUndoSession(
  state: DecisionUndoSessionState,
  sessionId: string
): DecisionUndoSessionState {
  if (state.sessionId === sessionId) return state;
  return { sessionId, history: [] };
}

export function endDecisionUndoSession(
  state: DecisionUndoSessionState,
  sessionId: string
): DecisionUndoSessionState {
  if (state.sessionId !== sessionId) return state;
  return { sessionId: null, history: [] };
}

export function appendDecisionUndo(
  history: readonly DecisionUndoEntry[],
  entry: DecisionUndoEntry
): DecisionUndoEntry[] {
  return [...history, entry];
}

export function removePhotoFromDecisionUndo(
  history: readonly DecisionUndoEntry[],
  photoId: string
): DecisionUndoEntry[] {
  return history.filter((entry) => entry.photoId !== photoId);
}

export function popDecisionUndo(history: readonly DecisionUndoEntry[]): {
  entry: DecisionUndoEntry | null;
  remaining: DecisionUndoEntry[];
} {
  if (history.length === 0) return { entry: null, remaining: [] };
  return {
    entry: history.at(-1) ?? null,
    remaining: history.slice(0, -1)
  };
}
