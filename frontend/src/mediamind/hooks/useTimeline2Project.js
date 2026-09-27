import { useCallback, useEffect, useState } from 'react';

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
  const [state, setState] = useState(() => ({ past: [], present: readSaved(storageKey, initialDocument), future: [] }));

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(state.present));
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

  const undo = useCallback(() => setState((current) => {
    if (!current.past.length) return current;
    return { past: current.past.slice(0, -1), present: current.past.at(-1), future: [current.present, ...current.future] };
  }), []);

  const redo = useCallback(() => setState((current) => {
    if (!current.future.length) return current;
    return { past: [...current.past, current.present].slice(-HISTORY_LIMIT), present: current.future[0], future: current.future.slice(1) };
  }), []);

  const reset = useCallback(() => setState({ past: [], present: initialDocument, future: [] }), [initialDocument]);

  return { document: state.present, commit, updateTransient, undo, redo, reset, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}
