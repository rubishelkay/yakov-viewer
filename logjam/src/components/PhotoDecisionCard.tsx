import { useCallback, useRef, useState, type CSSProperties } from "react";

import type { DecisionValue, PublicPhoto } from "../../shared/contracts";
import { useHorizontalDecision } from "../hooks/useHorizontalDecision";

type Props = {
  photo: PublicPhoto;
  decision?: DecisionValue;
  onDecision(decision: DecisionValue): Promise<void>;
  eager?: boolean;
};

type CardPhase = "idle" | "exiting" | "dismissed";

const EXIT_ANIMATION_MS = 420;

function waitForExitAnimation(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, EXIT_ANIMATION_MS));
}

export function PhotoDecisionCard({ photo, decision, onDecision, eager = false }: Props) {
  const busy = useRef(false);
  const card = useRef<HTMLElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [phase, setPhase] = useState<CardPhase>("idle");
  const [exitDirection, setExitDirection] = useState<DecisionValue | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const commit = useCallback((next: DecisionValue, advanceKeyboardFocus = false) => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setPhase("exiting");
    setExitDirection(next);
    setAnnouncement(`${next === "keep" ? "Keeping" : "Passing"} ${photo.title || "photo"}`);
    void Promise.all([onDecision(next), waitForExitAnimation()]).then(() => {
      const nextGesture = advanceKeyboardFocus ? adjacentGesture(card.current) : null;
      setAnnouncement(`${photo.title || "Photo"} marked ${next}`);
      setPhase("dismissed");
      if (nextGesture) {
        window.requestAnimationFrame(() => nextGesture.focus({ preventScroll: true }));
      }
    }).catch(() => {
      setAnnouncement(`Could not save the decision for ${photo.title || "this photo"}`);
      setExitDirection(null);
      setPhase("idle");
    }).finally(() => {
      busy.current = false;
      setSaving(false);
    });
  }, [onDecision, photo.title]);
  const swipe = useHorizontalDecision(commit);
  const tilt = Math.max(-2.2, Math.min(2.2, swipe.drag.offset / 80));

  if (phase === "idle" && decision) return null;

  const cardClassName = [
    "photo-card",
    phase === "exiting" ? "is-exiting" : "",
    exitDirection ? `is-exiting--${exitDirection}` : ""
  ].filter(Boolean).join(" ");

  return (
    <>
      <div className="visually-hidden" aria-live="polite">{announcement}</div>
      {phase !== "dismissed" && (
        <article
          ref={card}
          className={cardClassName}
          aria-busy={saving || undefined}
          style={{ "--photo-max-width": `${88 * photo.width / Math.max(1, photo.height)}vh` } as CSSProperties}
        >
          <div className="photo-card__collapse">
            <div className="photo-card__body">
              <div className="photo-card__frame">
                <div
                  className="photo-card__gesture"
                  {...swipe.bind}
                  tabIndex={phase === "exiting" ? -1 : 0}
                  role="group"
                  aria-disabled={saving || undefined}
                  aria-label={`${photo.title || "Photograph"}. Swipe left to pass or right to keep.`}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowLeft") {
                      event.preventDefault();
                      commit("pass", true);
                    }
                    if (event.key === "ArrowRight") {
                      event.preventDefault();
                      commit("keep", true);
                    }
                  }}
                  style={{
                    "--drag-offset": `${swipe.drag.offset}px`,
                    "--drag-tilt": `${tilt}deg`
                  } as CSSProperties}
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
                  <div className="decision-controls" aria-label="Photo decision">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={(event) => commit("pass", event.detail === 0)}
                    >
                      <span aria-hidden="true">←</span> Pass
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={(event) => commit("keep", event.detail === 0)}
                    >
                      Keep <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </article>
      )}
    </>
  );
}

function adjacentGesture(currentCard: HTMLElement | null): HTMLElement | null {
  const currentGesture = currentCard?.querySelector<HTMLElement>(".photo-card__gesture");
  if (!currentGesture) return null;
  const gestures = Array.from(document.querySelectorAll<HTMLElement>(".photo-card__gesture"));
  const currentIndex = gestures.indexOf(currentGesture);
  if (currentIndex < 0) return null;
  return gestures[currentIndex + 1] ?? gestures[currentIndex - 1] ?? null;
}
