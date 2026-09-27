import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTimeline2Document, setPlayhead, setZoom } from '../lib/timeline2Model';
import { useTimeline2Project } from './useTimeline2Project';

describe('useTimeline2Project', () => {
  beforeEach(() => localStorage.clear());

  it('persists committed documents and supports undo and redo', () => {
    const initial = createTimeline2Document({ name: 'Noticiário' });
    const { result } = renderHook(() => useTimeline2Project(initial, 'timeline2-test'));

    act(() => result.current.commit((document) => setZoom(document, 2)));
    expect(result.current.document.zoom).toBe(2);
    expect(JSON.parse(localStorage.getItem('timeline2-test')).zoom).toBe(2);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.document.zoom).toBe(1);
    act(() => result.current.redo());
    expect(result.current.document.zoom).toBe(2);
  });

  it('falls back to the supplied document when saved JSON is invalid', () => {
    localStorage.setItem('timeline2-broken', '{broken');
    const initial = createTimeline2Document({ name: 'Recuperado' });
    const { result } = renderHook(() => useTimeline2Project(initial, 'timeline2-broken'));

    expect(result.current.document.name).toBe('Recuperado');
  });

  it('moves playback time without filling the undo history', () => {
    const initial = { ...createTimeline2Document(), duration: 20 };
    const { result } = renderHook(() => useTimeline2Project(initial, 'timeline2-playback'));

    act(() => result.current.updateTransient((document) => setPlayhead(document, 8)));

    expect(result.current.document.playhead).toBe(8);
    expect(result.current.canUndo).toBe(false);
    expect(JSON.parse(localStorage.getItem('timeline2-playback')).playhead).toBe(8);
  });
});
