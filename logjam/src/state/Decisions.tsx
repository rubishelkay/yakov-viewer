import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import type {
  AccountPayload,
  DecisionRecord,
  DecisionUndoResult as DecisionUndoApiResult,
  DecisionValue
} from "../../shared/contracts";
import { ApiError, jsonBody, privateApi } from "../lib/api";
import {
  clearPendingDecision,
  hasAuthenticatedHint,
  preserveDecisionAndSignIn,
  readPendingDecision,
  setAuthenticatedHint
} from "../lib/auth";
import {
  appendDecisionUndo,
  beginDecisionUndoSession,
  endDecisionUndoSession,
  popDecisionUndo,
  removePhotoFromDecisionUndo,
  type DecisionUndoEntry,
  type DecisionUndoSessionState
} from "./decisionHistory";
import { replayPendingDecisionState } from "./replayPending";

export type DecideOptions = {
  recordUndo?: boolean;
  undoContext?: string;
  undoSession?: string;
};

export type UndoDecisionResult = {
  photoId: string;
  restoredDecision: DecisionValue | undefined;
  context?: string;
  sessionId: string | null;
};

type DecisionContextValue = {
  decisions: Record<string, DecisionValue>;
  decide(photoId: string, decision: DecisionValue, options?: DecideOptions): Promise<void>;
  undoLastDecision(): Promise<UndoDecisionResult | null>;
  beginFeedUndoSession(sessionId: string): () => void;
  canUndo: boolean;
  isBusy: boolean;
  hydrate(records: DecisionRecord[]): void;
  error: string | null;
  clearError(): void;
};

const DecisionContext = createContext<DecisionContextValue | null>(null);

export function DecisionProvider({ children }: { children: React.ReactNode }) {
  const [decisions, setDecisions] = useState<Record<string, DecisionValue>>({});
  const decisionsRef = useRef<Record<string, DecisionValue>>({});
  const undoState = useRef<DecisionUndoSessionState>({ sessionId: null, history: [] });
  const [undoDepth, setUndoDepth] = useState(0);
  const mutationBusy = useRef(false);
  const [isBusy, setIsBusy] = useState(() => hasAuthenticatedHint() || readPendingDecision() !== null);
  const [error, setError] = useState<string | null>(null);
  const replayStarted = useRef(false);

  const hydrate = useCallback((records: DecisionRecord[]) => {
    const next = Object.fromEntries(records.map((record) => [record.photoId, record.decision]));
    decisionsRef.current = next;
    setDecisions(next);
  }, []);

  const replaceUndoState = useCallback((next: DecisionUndoSessionState) => {
    undoState.current = next;
    setUndoDepth(next.history.length);
  }, []);

  const replaceUndoHistory = useCallback((history: DecisionUndoEntry[]) => {
    replaceUndoState({ ...undoState.current, history });
  }, [replaceUndoState]);

  const beginFeedUndoSession = useCallback((sessionId: string) => {
    const started = beginDecisionUndoSession(undoState.current, sessionId);
    if (started !== undoState.current) replaceUndoState(started);
    return () => {
      const ended = endDecisionUndoSession(undoState.current, sessionId);
      if (ended !== undoState.current) replaceUndoState(ended);
    };
  }, [replaceUndoState]);

  const replaceDecision = useCallback((photoId: string, decision: DecisionValue | undefined) => {
    const next = { ...decisionsRef.current };
    if (decision) next[photoId] = decision;
    else delete next[photoId];
    decisionsRef.current = next;
    setDecisions(next);
  }, []);

  const startMutation = useCallback(() => {
    if (mutationBusy.current) throw new Error("Another decision is still being saved.");
    mutationBusy.current = true;
    setIsBusy(true);
  }, []);

  const finishMutation = useCallback(() => {
    mutationBusy.current = false;
    setIsBusy(false);
  }, []);

  useEffect(() => {
    const pending = readPendingDecision();
    if (pending && !replayStarted.current) {
      replayStarted.current = true;
      const replayUndoSession = undoState.current.sessionId;
      startMutation();
      let pendingPrevious: DecisionValue | undefined;
      void replayPendingDecisionState({
        write: async () => {
          const before = await privateApi<AccountPayload>("/api/private/account");
          pendingPrevious = before.decisions.find((record) => record.photoId === pending.photoId)?.decision;
          const result = await privateApi<{ decision: DecisionRecord }>(
            `/api/private/decisions/${encodeURIComponent(pending.photoId)}`,
            { method: "PUT", body: jsonBody({ decision: pending.decision }) }
          );
          return result.decision;
        },
        afterSuccessfulWrite: (saved) => {
          setAuthenticatedHint(true);
          clearPendingDecision();
          replaceDecision(saved.photoId, saved.decision);
          if (replayUndoSession && undoState.current.sessionId === replayUndoSession) {
            replaceUndoHistory(appendDecisionUndo(undoState.current.history, {
              photoId: saved.photoId,
              previous: pendingPrevious,
              next: saved.decision,
              expectedUpdatedAt: saved.updatedAt
            }));
          }
        },
        loadAll: async () => (await privateApi<AccountPayload>("/api/private/account")).decisions,
        hydrate,
        onRefreshError: (cause) => {
          if (cause instanceof ApiError && cause.authenticationRequired) setAuthenticatedHint(false);
          setError(cause instanceof Error
            ? `Decision saved, but the full edit could not be refreshed: ${cause.message}`
            : "Decision saved, but the full edit could not be refreshed.");
        }
      }).catch((cause: unknown) => {
          if (cause instanceof ApiError && cause.authenticationRequired) setAuthenticatedHint(false);
          setError(cause instanceof Error ? cause.message : "The pending decision could not be saved.");
      }).finally(finishMutation);
      return;
    }
    if (!hasAuthenticatedHint()) {
      setIsBusy(false);
      return;
    }
    const controller = new AbortController();
    void privateApi<AccountPayload>("/api/private/account", { signal: controller.signal })
      .then((account) => hydrate(account.decisions))
      .catch((cause: unknown) => {
        if (cause instanceof ApiError && cause.authenticationRequired) setAuthenticatedHint(false);
      })
      .finally(() => setIsBusy(false));
    return () => controller.abort();
  }, [finishMutation, hydrate, replaceDecision, replaceUndoHistory, startMutation]);

  const decide = useCallback(async (
    photoId: string,
    decision: DecisionValue,
    options: DecideOptions = {}
  ) => {
    if (!hasAuthenticatedHint()) {
      preserveDecisionAndSignIn(photoId, decision);
      return;
    }
    startMutation();
    const previous = decisionsRef.current[photoId];
    replaceDecision(photoId, decision);
    try {
      const result = await privateApi<{ decision: DecisionRecord }>(
        `/api/private/decisions/${encodeURIComponent(photoId)}`,
        { method: "PUT", body: jsonBody({ decision }) }
      );
      setAuthenticatedHint(true);
      replaceDecision(result.decision.photoId, result.decision.decision);
      const nextHistory = options.recordUndo && options.undoSession === undoState.current.sessionId
        ? appendDecisionUndo(undoState.current.history, {
            photoId,
            previous,
            next: result.decision.decision,
            expectedUpdatedAt: result.decision.updatedAt,
            context: options.undoContext
          })
        : options.recordUndo
          ? undoState.current.history
          : removePhotoFromDecisionUndo(undoState.current.history, photoId);
      if (nextHistory !== undoState.current.history) replaceUndoHistory(nextHistory);
    } catch (cause) {
      replaceDecision(photoId, previous);
      if (cause instanceof ApiError && cause.authenticationRequired) {
        setAuthenticatedHint(false);
        preserveDecisionAndSignIn(photoId, decision);
        return;
      }
      setError(cause instanceof Error ? cause.message : "Decision could not be saved.");
      throw cause;
    } finally {
      finishMutation();
    }
  }, [finishMutation, replaceDecision, replaceUndoHistory, startMutation]);

  const undoLastDecision = useCallback(async (): Promise<UndoDecisionResult | null> => {
    if (mutationBusy.current) return null;
    const undoSession = undoState.current.sessionId;
    const popped = popDecisionUndo(undoState.current.history);
    if (!popped.entry) return null;

    startMutation();
    replaceUndoHistory(popped.remaining);
    replaceDecision(popped.entry.photoId, popped.entry.previous);
    try {
      const result = await privateApi<DecisionUndoApiResult>(
        `/api/private/decisions/${encodeURIComponent(popped.entry.photoId)}/undo`,
        {
          method: "POST",
          body: jsonBody({
            expectedUpdatedAt: popped.entry.expectedUpdatedAt,
            previousDecision: popped.entry.previous ?? null
          })
        }
      );
      replaceDecision(
        popped.entry.photoId,
        result.decision?.decision
      );
      setAuthenticatedHint(true);
      return {
        photoId: popped.entry.photoId,
        restoredDecision: result.decision?.decision,
        context: popped.entry.context,
        sessionId: undoSession
      };
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "decision_conflict") {
        replaceUndoHistory([]);
        try {
          const account = await privateApi<AccountPayload>("/api/private/account");
          hydrate(account.decisions);
        } catch (refreshCause) {
          replaceDecision(popped.entry.photoId, popped.entry.next);
          if (refreshCause instanceof ApiError && refreshCause.authenticationRequired) {
            setAuthenticatedHint(false);
          }
        }
        setError(cause.message);
        throw cause;
      }
      replaceDecision(popped.entry.photoId, popped.entry.next);
      if (undoState.current.sessionId === undoSession) {
        replaceUndoHistory(appendDecisionUndo(undoState.current.history, popped.entry));
      }
      if (cause instanceof ApiError && cause.authenticationRequired) setAuthenticatedHint(false);
      setError(cause instanceof Error ? cause.message : "The previous decision could not be restored.");
      throw cause;
    } finally {
      finishMutation();
    }
  }, [finishMutation, hydrate, replaceDecision, replaceUndoHistory, startMutation]);

  const value = useMemo<DecisionContextValue>(() => ({
    decisions,
    decide,
    undoLastDecision,
    beginFeedUndoSession,
    canUndo: undoDepth > 0,
    isBusy,
    hydrate,
    error,
    clearError: () => setError(null)
  }), [beginFeedUndoSession, decide, decisions, error, hydrate, isBusy, undoDepth, undoLastDecision]);

  return <DecisionContext.Provider value={value}>{children}</DecisionContext.Provider>;
}

export function useDecisions(): DecisionContextValue {
  const context = useContext(DecisionContext);
  if (!context) throw new Error("useDecisions must be used within DecisionProvider");
  return context;
}
