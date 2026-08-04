import { useCallback, useState } from "react";

import type { DecisionValue, PublicPhoto } from "../../shared/contracts";
import { useHorizontalDecision } from "../hooks/useHorizontalDecision";

type Props = {
  photo: PublicPhoto;
  decision?: DecisionValue;
  onDecision(decision: DecisionValue): Promise<void>;
  eager?: boolean;
};

export function PhotoDecisionCard({ photo, decision, onDecision, eager = false }: Props) {
  const [saving, setSaving] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const commit = useCallback((next: DecisionValue) => {
    if (saving) return;
    setSaving(true);
    setAnnouncement(`${next === "keep" ? "Keeping" : "Passing"} ${photo.title || "photo"}`);
    void onDecision(next).then(() => {
      setAnnouncement(`${photo.title || "Photo"} marked ${next}`);
    }).catch(() => {
      setAnnouncement(`Could not save the decision for ${photo.title || "this photo"}`);
    }).finally(() => setSaving(false));
  }, [onDecision, photo.title, saving]);
  const swipe = useHorizontalDecision(commit);
  const tilt = Math.max(-2.2, Math.min(2.2, swipe.drag.offset / 80));

  return (
    <article className={`photo-card${saving ? " is-saving" : ""}`}>
      <div className="visually-hidden" aria-live="polite">{announcement}</div>
      <div
        className="photo-card__gesture"
        {...swipe.bind}
        tabIndex={0}
        role="group"
        aria-label={`${photo.title || "Photograph"}. Swipe left to pass or right to keep.`}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            commit("pass");
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            commit("keep");
          }
        }}
        style={{
          transform: `translate3d(${swipe.drag.offset}px, 0, 0) rotate(${tilt}deg)`
        }}
      >
        <img
          src={photo.displayUrl}
          alt={photo.title || "Untitled photograph"}
          width={photo.width}
          height={photo.height}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
        />
        <span
          className="gesture-label gesture-label--pass"
          data-visible={swipe.drag.hint === "pass"}
          aria-hidden="true"
        >
          Pass
        </span>
        <span
          className="gesture-label gesture-label--keep"
          data-visible={swipe.drag.hint === "keep"}
          aria-hidden="true"
        >
          Keep
        </span>
      </div>
      <div className="photo-card__footer">
        <span className="photo-card__index">{photo.title || "Untitled"}</span>
        <div className="decision-controls" aria-label="Photo decision">
          <button
            className={decision === "pass" ? "is-selected" : ""}
            type="button"
            disabled={saving}
            onClick={() => commit("pass")}
            aria-pressed={decision === "pass"}
          >
            <span aria-hidden="true">←</span> Pass
          </button>
          <button
            className={decision === "keep" ? "is-selected decision-keep" : "decision-keep"}
            type="button"
            disabled={saving}
            onClick={() => commit("keep")}
            aria-pressed={decision === "keep"}
          >
            Keep <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </article>
  );
}
