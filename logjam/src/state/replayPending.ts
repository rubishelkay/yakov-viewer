import type { DecisionRecord } from "../../shared/contracts";

type ReplayDependencies = {
  write(): Promise<DecisionRecord>;
  afterSuccessfulWrite(saved: DecisionRecord): void;
  loadAll(): Promise<DecisionRecord[]>;
  hydrate(records: DecisionRecord[]): void;
  onRefreshError(cause: unknown): void;
};

export async function replayPendingDecisionState(deps: ReplayDependencies): Promise<void> {
  const saved = await deps.write();
  deps.afterSuccessfulWrite(saved);
  try {
    deps.hydrate(await deps.loadAll());
  } catch (cause) {
    deps.onRefreshError(cause);
  }
}
