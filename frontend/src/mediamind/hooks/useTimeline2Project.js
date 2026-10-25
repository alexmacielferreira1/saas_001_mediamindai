import { useCallback, useEffect, useRef } from 'react';
import { useWorkDraftState, useWorkStorageKey } from '../lib/workProtection';

const HISTORY_LIMIT = 100;

function readSaved(storageKey, fallback) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return saved && Array.isArray(saved.tracks) ? saved : fallback;
  } catch {
    return fallback;
  }
}

export function useTimeline2Project(initialDocument, storageKey = 'mm_timeline2_project') {
  storageKey = useWorkStorageKey(storageKey);
  const [state, setState] = useWorkDraftState(`timeline:${storageKey}`, () => ({ past: [], present: readSaved(storageKey, initialDocument), future: [] }));
  const gestureStartRef = useRef(null);

  // Autosave neste navegador. Falha (ex.: cota cheia) não derruba o editor:
  // fica registrada para o botão "Salvar projeto" informar o usuário.
  const lastSaveErrorRef = useRef(null);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state.present));
      lastSaveErrorRef.current = null;
    } catch (error) {
      lastSaveErrorRef.current = error;
    }
  }, [state.present, storageKey]);

  // "Salvar projeto": grava na mesma chave do autosave (a que o editor lê ao abrir).
  const save = useCallback(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state.present));
      lastSaveErrorRef.current = null;
      return { ok: true, savedAt: new Date() };
    } catch (error) {
      lastSaveErrorRef.current = error;
      const quota = error?.name === 'QuotaExceededError' || /quota/i.test(String(error?.message || ''));
      return { ok: false, quota, error };
    }
  }, [state.present, storageKey]);

  const commit = useCallback((change) => {
    setState((current) => {
      const next = typeof change === 'function' ? change(current.present) : change;
      if (!next || next === current.present || JSON.stringify(next) === JSON.stringify(current.present)) return current;
      return { past: [...current.past, current.present].slice(-HISTORY_LIMIT), present: next, future: [] };
    });
  }, []);

  const updateTransient = useCallback((change) => {
    setState((current) => {
      const next = typeof change === 'function' ? change(current.present) : change;
      if (!next || next === current.present) return current;
      return { ...current, present: next };
    });
  }, []);

  const beginGesture = useCallback(() => {
    setState((current) => {
      gestureStartRef.current = current.present;
      return current;
    });
  }, []);

  const finishGesture = useCallback(() => {
    setState((current) => {
      const start = gestureStartRef.current;
      gestureStartRef.current = null;
      if (!start || JSON.stringify(start) === JSON.stringify(current.present)) return current;
      return { past: [...current.past, start].slice(-HISTORY_LIMIT), present: current.present, future: [] };
    });
  }, []);

  const undo = useCallback(() => setState((current) => {
    if (!current.past.length) return current;
    return { past: current.past.slice(0, -1), present: current.past.at(-1), future: [current.present, ...current.future] };
  }), []);

  const redo = useCallback(() => setState((current) => {
    if (!current.future.length) return current;
    return { past: [...current.past, current.present].slice(-HISTORY_LIMIT), present: current.future[0], future: current.future.slice(1) };
  }), []);

  const reset = useCallback(() => setState({ past: [], present: initialDocument, future: [] }), [initialDocument]);

  return { document: state.present, save, commit, updateTransient, beginGesture, finishGesture, undo, redo, reset, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}
