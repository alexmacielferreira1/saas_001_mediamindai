// Gestos de arraste da timeline do MMFilm com pointer events (mouse, caneta e toque):
// captura do ponteiro, limiar antes de começar, prévia coalescida por requestAnimationFrame,
// gravação só no soltar, Esc / pointercancel cancelam. O estado do gesto fica em ref (sem re-render por movimento).
import { useCallback, useEffect, useRef } from "react";

export const DRAG_THRESHOLD_PX = 3;

// Mídia sendo arrastada do painel Projeto / Monitor (o dataTransfer não pode ser lido durante o dragover).
export const assetDragState = { current: null };

const snapshot = (event) => ({
  clientX: event.clientX ?? 0,
  clientY: event.clientY ?? 0,
  ctrlKey: Boolean(event.ctrlKey || event.metaKey),
  altKey: Boolean(event.altKey),
  shiftKey: Boolean(event.shiftKey),
});

/**
 * Inicia um gesto a partir de um pointerdown.
 * handlers: start() ao passar do limiar; preview(ponto) no rAF; commit(ponto, { moved }) no soltar;
 * cancel() em Esc/pointercancel. Retorna uma função que aborta o gesto.
 */
export function startPointerGesture(event, { threshold = DRAG_THRESHOLD_PX, start, preview, commit, cancel } = {}) {
  const origin = snapshot(event);
  const target = event.currentTarget || event.target;
  const pointerId = event.pointerId;
  if (pointerId !== undefined) {
    try {
      target?.setPointerCapture?.(pointerId);
    } catch {
      // ponteiro já liberado (ex.: toque cancelado)
    }
  }
  let started = false;
  let last = origin;
  let frame = null;
  const far = (point) => Math.hypot(point.clientX - origin.clientX, point.clientY - origin.clientY) >= threshold;
  const begin = () => {
    if (started) return;
    started = true;
    start?.(last);
  };
  const paint = () => {
    frame = null;
    if (started) preview?.(last);
  };
  const cleanup = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", abort);
    window.removeEventListener("keydown", key, true);
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    if (pointerId !== undefined) {
      try {
        target?.releasePointerCapture?.(pointerId);
      } catch {
        // já liberado
      }
    }
  };
  function move(moveEvent) {
    if (pointerId !== undefined && moveEvent.pointerId !== undefined && moveEvent.pointerId !== pointerId) return;
    last = snapshot(moveEvent);
    if (!started && far(last)) begin();
    if (started && frame === null) frame = requestAnimationFrame(paint);
  }
  function up(upEvent) {
    if (pointerId !== undefined && upEvent.pointerId !== undefined && upEvent.pointerId !== pointerId) return;
    cleanup();
    const point = snapshot(upEvent);
    last = Number.isFinite(upEvent.clientX) ? point : { ...point, clientX: last.clientX, clientY: last.clientY };
    const moved = started || far(last);
    commit?.(last, { moved });
  }
  function abort() {
    cleanup();
    if (started) cancel?.();
  }
  function key(keyEvent) {
    if (keyEvent.key !== "Escape") return;
    keyEvent.preventDefault?.();
    keyEvent.stopPropagation?.();
    abort();
  }
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", abort);
  window.addEventListener("keydown", key, true);
  return abort;
}

/** Hook: inicia gestos e aborta o que estiver ativo ao desmontar o componente. */
export function useTimelineDrag() {
  const active = useRef(null);
  useEffect(() => () => active.current?.(), []);
  return useCallback((event, handlers) => {
    active.current?.();
    const abort = startPointerGesture(event, {
      ...handlers,
      commit: (point, info) => {
        active.current = null;
        handlers.commit?.(point, info);
      },
      cancel: () => {
        active.current = null;
        handlers.cancel?.();
      },
    });
    active.current = abort;
    return abort;
  }, []);
}

/** Índice da faixa sob o ponteiro (linhas de altura fixa abaixo da régua). */
export function trackIndexAt(clientY, top, rulerHeight, trackHeight, count) {
  return Math.max(0, Math.min(count - 1, Math.floor((clientY - top - rulerHeight) / trackHeight)));
}
