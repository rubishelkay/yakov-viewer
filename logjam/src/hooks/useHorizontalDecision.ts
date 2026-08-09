import { useCallback, useRef, useState } from "react";

import type { DecisionValue } from "../../shared/contracts";

type DragState = {
  active: boolean;
  offset: number;
  hint: DecisionValue | null;
};

const initialDrag: DragState = { active: false, offset: 0, hint: null };

export function useHorizontalDecision(onDecision: (decision: DecisionValue) => void) {
  const start = useRef({ x: 0, y: 0, at: 0, pointerId: -1, axis: "pending" as "pending" | "x" | "y" });
  const [drag, setDrag] = useState<DragState>(initialDrag);

  const reset = useCallback(() => setDrag(initialDrag), []);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button, a, input")) return;
    start.current = {
      x: event.clientX,
      y: event.clientY,
      at: performance.now(),
      pointerId: event.pointerId,
      axis: "pending"
    };
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (start.current.pointerId !== event.pointerId || start.current.axis === "y") return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    if (start.current.axis === "pending") {
      if (Math.hypot(dx, dy) < 12) return;
      if (Math.abs(dy) > Math.abs(dx) * 1.15) {
        start.current.axis = "y";
        return;
      }
      if (Math.abs(dx) <= Math.abs(dy) * 1.15) return;
      start.current.axis = "x";
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    const threshold = Math.max(72, Math.min(132, event.currentTarget.clientWidth * 0.18));
    setDrag({
      active: true,
      offset: dx,
      hint: Math.abs(dx) >= threshold * 0.55 ? dx > 0 ? "keep" : "pass" : null
    });
  }, []);

  const finish = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (start.current.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.current.x;
    const elapsed = Math.max(1, performance.now() - start.current.at);
    const threshold = Math.max(72, Math.min(132, event.currentTarget.clientWidth * 0.18));
    const shouldCommit = start.current.axis === "x"
      && (Math.abs(dx) >= threshold || Math.abs(dx / elapsed) >= 0.65);
    start.current.pointerId = -1;
    start.current.axis = "pending";
    reset();
    if (shouldCommit) onDecision(dx > 0 ? "keep" : "pass");
  }, [onDecision, reset]);

  const cancel = useCallback(() => {
    start.current.pointerId = -1;
    start.current.axis = "pending";
    reset();
  }, [reset]);

  return {
    drag,
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: cancel
    }
  };
}
