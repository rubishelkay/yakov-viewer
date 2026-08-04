import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import type { AccountPayload, DecisionRecord, DecisionValue } from "../../shared/contracts";
import { ApiError, jsonBody, privateApi } from "../lib/api";
import {
  clearPendingDecision,
  hasAuthenticatedHint,
  preserveDecisionAndSignIn,
  readPendingDecision,
  setAuthenticatedHint
} from "../lib/auth";
import { replayPendingDecisionState } from "./replayPending";

type DecisionContextValue = {
  decisions: Record<string, DecisionValue>;
  decide(photoId: string, decision: DecisionValue): Promise<void>;
  hydrate(records: DecisionRecord[]): void;
  error: string | null;
  clearError(): void;
};

const DecisionContext = createContext<DecisionContextValue | null>(null);

export function DecisionProvider({ children }: { children: React.ReactNode }) {
  const [decisions, setDecisions] = useState<Record<string, DecisionValue>>({});
  const [error, setError] = useState<string | null>(null);
  const replayStarted = useRef(false);

  const hydrate = useCallback((records: DecisionRecord[]) => {
    setDecisions(Object.fromEntries(records.map((record) => [record.photoId, record.decision])));
  }, []);

  useEffect(() => {
    const pending = readPendingDecision();
    if (pending && !replayStarted.current) {
      replayStarted.current = true;
      void replayPendingDecisionState({
        write: async () => {
          const result = await privateApi<{ decision: DecisionRecord }>(
            `/api/private/decisions/${encodeURIComponent(pending.photoId)}`,
            { method: "PUT", body: jsonBody({ decision: pending.decision }) }
          );
          return result.decision;
        },
        afterSuccessfulWrite: (saved) => {
          setAuthenticatedHint(true);
          clearPendingDecision();
          setDecisions((current) => ({ ...current, [saved.photoId]: saved.decision }));
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
      });
      return;
    }
    if (!hasAuthenticatedHint()) return;
    const controller = new AbortController();
    void privateApi<AccountPayload>("/api/private/account", { signal: controller.signal })
      .then((account) => hydrate(account.decisions))
      .catch((cause: unknown) => {
        if (cause instanceof ApiError && cause.authenticationRequired) setAuthenticatedHint(false);
      });
    return () => controller.abort();
  }, [hydrate]);

  const decide = useCallback(async (photoId: string, decision: DecisionValue) => {
    if (!hasAuthenticatedHint()) {
      preserveDecisionAndSignIn(photoId, decision);
      return;
    }
    const previous = decisions[photoId];
    setDecisions((current) => ({ ...current, [photoId]: decision }));
    try {
      const result = await privateApi<{ decision: DecisionRecord }>(
        `/api/private/decisions/${encodeURIComponent(photoId)}`,
        { method: "PUT", body: jsonBody({ decision }) }
      );
      setAuthenticatedHint(true);
      setDecisions((current) => ({ ...current, [result.decision.photoId]: result.decision.decision }));
    } catch (cause) {
      setDecisions((current) => {
        const next = { ...current };
        if (previous) next[photoId] = previous;
        else delete next[photoId];
        return next;
      });
      if (cause instanceof ApiError && cause.authenticationRequired) {
        setAuthenticatedHint(false);
        preserveDecisionAndSignIn(photoId, decision);
        return;
      }
      setError(cause instanceof Error ? cause.message : "Decision could not be saved.");
      throw cause;
    }
  }, [decisions]);

  const value = useMemo<DecisionContextValue>(() => ({
    decisions,
    decide,
    hydrate,
    error,
    clearError: () => setError(null)
  }), [decide, decisions, error, hydrate]);

  return <DecisionContext.Provider value={value}>{children}</DecisionContext.Provider>;
}

export function useDecisions(): DecisionContextValue {
  const context = useContext(DecisionContext);
  if (!context) throw new Error("useDecisions must be used within DecisionProvider");
  return context;
}
