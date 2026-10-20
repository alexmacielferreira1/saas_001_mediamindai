import { describe, expect, it } from 'vitest';
import {
  EDITOR_SHORTCUTS, captionAt, clampView, computePeaks, emptyHistory, fitView, frameMs, isFullView, peaksInView,
  recordHistory, redoHistory, resolveHistoryKey, resolvePlayerKey, resolveSnap, snapCaptionsToWords, snapThresholdMs,
  stepFrames, undoHistory, zoomView,
} from './clipEditorTools';

describe('clipEditorTools', () => {
  it('steps frames on a 30 fps grid and clamps to the duration', () => {
    expect(frameMs()).toBeCloseTo(33.333, 2);
    expect(frameMs(0)).toBeCloseTo(33.333, 2);
    expect(stepFrames(1000, 1)).toBeCloseTo(1033.33, 1);
    expect(stepFrames(1010, -1)).toBeCloseTo(966.67, 1);
    expect(stepFrames(0, -1)).toBe(0);
    expect(stepFrames(1990, 5, { maxMs: 2000 })).toBe(2000);
  });

  it('maps keys to player actions and ignores typing, modifiers and buttons for space', () => {
    expect(resolvePlayerKey({ key: 'k', target: document.body })).toBe('toggle-play');
    expect(resolvePlayerKey({ key: ' ', target: document.body })).toBe('toggle-play');
    expect(resolvePlayerKey({ key: ' ', target: document.createElement('button') })).toBeNull();
    expect(resolvePlayerKey({ key: 'ArrowRight', target: document.body })).toBe('frame-step-forward');
    expect(resolvePlayerKey({ key: 'ArrowLeft', shiftKey: true, target: document.body })).toBe('jump-backward');
    expect(resolvePlayerKey({ key: 'I', shiftKey: true, target: document.body })).toBeNull();
    expect(resolvePlayerKey({ key: 's', target: document.createElement('textarea') })).toBeNull();
    expect(resolvePlayerKey({ key: 's', ctrlKey: true, target: document.body })).toBeNull();
    expect(resolvePlayerKey({ key: 'Delete', target: document.body })).toBe('delete');
    expect(resolvePlayerKey({ key: 'x', target: document.body })).toBeNull();
    expect(resolvePlayerKey({ key: 'k', defaultPrevented: true, target: document.body })).toBeNull();
    expect(resolvePlayerKey(null)).toBeNull();
    const editable = document.createElement('div');
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    expect(resolvePlayerKey({ key: 'j', target: editable })).toBeNull();
  });

  it('maps undo/redo shortcuts', () => {
    expect(resolveHistoryKey({ key: 'z', ctrlKey: true, target: document.body })).toBe('undo');
    expect(resolveHistoryKey({ key: 'Z', ctrlKey: true, shiftKey: true, target: document.body })).toBe('redo');
    expect(resolveHistoryKey({ key: 'y', metaKey: true, target: document.body })).toBe('redo');
    expect(resolveHistoryKey({ key: 'z', target: document.body })).toBeNull();
    expect(resolveHistoryKey({ key: 'z', ctrlKey: true, target: document.createElement('input') })).toBeNull();
    expect(resolveHistoryKey({ key: 'q', ctrlKey: true, target: document.body })).toBeNull();
    expect(EDITOR_SHORTCUTS.map((item) => item.action)).toEqual(expect.arrayContaining(['toggle-play', 'split', 'undo']));
  });

  it('snaps to the closest point inside the threshold', () => {
    expect(resolveSnap(1040, [1000, 1100, 'x'], 50)).toEqual({ time: 1000, snapped: true });
    expect(resolveSnap(1040, [1200], 50)).toEqual({ time: 1040, snapped: false });
    expect(snapThresholdMs(10000, 100)).toBe(1000);
  });

  it('snaps caption edges to word boundaries without inverting them', () => {
    const words = [{ start_ms: 1000, end_ms: 1400 }, { start_ms: 1500, end_ms: 2000 }];
    const { captions, changed } = snapCaptionsToWords([
      { id: 'a', start_ms: 1100, end_ms: 1900 },
      { id: 'b', start_ms: 5000, end_ms: 6000 },
      { id: 'c', start_ms: 1000, end_ms: 2000 },
    ], words, 200);
    expect(changed).toBe(1);
    expect(captions[0]).toMatchObject({ start_ms: 1000, end_ms: 2000 });
    expect(captions[1]).toMatchObject({ start_ms: 5000, end_ms: 6000 });
  });

  it('zooms, fits and resets the visible window', () => {
    expect(clampView(null, 10000)).toEqual({ start: 0, end: 10000 });
    expect(zoomView(null, 2, 10000, 2000)).toEqual({ start: 0, end: 5000 });
    expect(zoomView({ start: 0, end: 10000 }, 2, 10000)).toEqual({ start: 2500, end: 7500 });
    expect(zoomView({ start: 0, end: 600 }, 4, 10000).end - zoomView({ start: 0, end: 600 }, 4, 10000).start).toBe(500);
    expect(fitView(2000, 4000, 10000)).toEqual({ start: 1900, end: 4100 });
    expect(fitView(4000, 2000, 10000)).toEqual({ start: 0, end: 10000 });
    expect(isFullView(null, 10000)).toBe(true);
    expect(isFullView({ start: 100, end: 900 }, 10000)).toBe(false);
  });

  it('computes peaks per bucket and slices them for the view', () => {
    const peaks = computePeaks([new Float32Array([0, 0.5, -0.9, 0.1]), new Float32Array([0.2, 0, 0, 0.3])], 2);
    expect(peaks[0]).toBeCloseTo(0.5);
    expect(peaks[1]).toBeCloseTo(0.9);
    expect(computePeaks([], 10)).toEqual([0]);
    expect(peaksInView([1, 2, 3, 4], 4000, { start: 1000, end: 3000 })).toEqual([2, 3]);
    expect(peaksInView([], 4000, null)).toEqual([]);
  });

  it('records, coalesces, undoes and redoes history', () => {
    let history = recordHistory(emptyHistory(), ['v0'], { now: 1000 });
    history = recordHistory(history, ['v1'], { now: 1200 });
    expect(history.past).toEqual([['v0']]);
    history = recordHistory(history, ['v1'], { now: 5000 });
    expect(history.past).toEqual([['v0'], ['v1']]);
    const undone = undoHistory(history, ['v2']);
    expect(undone.value).toEqual(['v1']);
    const redone = redoHistory(undone.history, ['v1']);
    expect(redone.value).toEqual(['v2']);
    expect(undoHistory(emptyHistory(), [])).toBeNull();
    expect(redoHistory(emptyHistory(), [])).toBeNull();
    expect(recordHistory(null, ['x'], { now: 1 }).past).toEqual([['x']]);
  });

  it('finds the caption under the playhead', () => {
    expect(captionAt([{ id: 'a', start_ms: 0, end_ms: 1000 }], 500)?.id).toBe('a');
    expect(captionAt([{ id: 'a', start_ms: 0, end_ms: 1000 }], 1000)).toBeNull();
  });
});

describe('clipEditorTools history commands', () => {
  it('does not merge a typing change into a previous command step', () => {
    let history = recordHistory(emptyHistory(), ['a'], { now: 1000, coalesceMs: 0 });
    history = recordHistory(history, ['b'], { now: 1100 });
    expect(history.past).toEqual([['a'], ['b']]);
  });
});
