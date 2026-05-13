"use client";

import { useCallback, useRef, useState } from "react";

type ConfirmTone = "danger" | "neutral";

type ConfirmOptions = {
  cancelLabel?: string;
  confirmLabel?: string;
  message: string;
  title: string;
  tone?: ConfirmTone;
};

type ActiveConfirm = Required<Omit<ConfirmOptions, "tone">> & {
  tone: ConfirmTone;
};

export function useAdminConfirmDialog() {
  const [activeConfirm, setActiveConfirm] = useState<ActiveConfirm | null>(null);
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  const close = useCallback((confirmed: boolean) => {
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
    setActiveConfirm(null);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    resolverRef.current?.(false);

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setActiveConfirm({
        cancelLabel: options.cancelLabel ?? "Cancel",
        confirmLabel: options.confirmLabel ?? "Confirm",
        message: options.message,
        title: options.title,
        tone: options.tone ?? "neutral"
      });
    });
  }, []);

  const dialog = activeConfirm ? (
    <div className="admin-modal-backdrop" role="presentation">
      <div
        aria-describedby="admin-confirm-message"
        aria-labelledby="admin-confirm-title"
        aria-modal="true"
        className="admin-confirm-dialog"
        data-tone={activeConfirm.tone}
        role="dialog"
      >
        <div>
          <p className="admin-kicker">Confirm action</p>
          <h2 id="admin-confirm-title">{activeConfirm.title}</h2>
          <p id="admin-confirm-message">{activeConfirm.message}</p>
        </div>
        <div className="admin-row-actions">
          <button className="admin-ghost-button" onClick={() => close(false)} type="button">
            {activeConfirm.cancelLabel}
          </button>
          <button
            className={activeConfirm.tone === "danger" ? "admin-danger-button" : "admin-button"}
            onClick={() => close(true)}
            type="button"
          >
            {activeConfirm.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog };
}
