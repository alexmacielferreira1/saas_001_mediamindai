import React, { useState, useEffect, useRef } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import {
  Play, Pause, SkipBack, SkipForward, ZoomIn, ZoomOut, Scissors,
  Trash2, Volume2, Type, Video,
} from 'lucide-react';
import { formatTime } from '../data';

const TRACKS = [
  { id: 't1', label: 'T1', icon: Type, textClass: 'text-violet-400', clipClass: 'border-violet-500 bg-violet-600/70', hint: 'textos' },
  { id: 'v2', label: 'V2', icon: Video, textClass: 'text-sky-400', clipClass: 'border-sky-400 bg-sky-500/60', hint: 'vídeos' },
  { id: 'v1', label: 'V1', icon: Video, textClass: 'text-sky-400', clipClass: 'border-sky-500 bg-sky-600/70', hint: 'vídeos' },
  { id: 'a1', label: 'A1', icon: Volume2, textClass: 'text-emerald-400', clipClass: 'border-emerald-500 bg-emerald-600/70', hint: 'áudios' },
];

export default function WorkspaceTimelineBar({ items, onRemove }) {
  const [zoom, setZoom] = useState(40);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const scrollRef = useRef(null);

  // Compute sequential positions per track
  const trackOffsets = {};
  TRACKS.forEach((t) => { trackOffsets[t.id] = 0; });

  const clips = items.map((item) => {
    const track = item.track || 'v1';
    const dur = item.duration || 0;
    const start = trackOffsets[track] || 0;
    trackOffsets[track] = start + dur;
    return { ...item, track, start, duration: dur };
  });

  const totalDuration = Math.max(...Object.values(trackOffsets), 1);
  const timelineWidth = Math.max(800, totalDuration * zoom + 100);
  const rulerMarks = Math.ceil(timelineWidth / (zoom * 5));

  useEffect(() => {
    if (!playing || totalDuration <= 1) return;
    let raf;
    let last = performance.now();
    function tick(now) {
      const dt = (now - last) / 1000;
      last = now;
      setCurrentTime((t) => {
        const next = t + dt;
        if (next >= totalDuration) {
          setPlaying(false);
          return 0;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, totalDuration]);

  const playheadLeft = currentTime * zoom;

  function seekToClientX(clientX) {
    if (!scrollRef.current) return;
    const rect = scrollRef.current.getBoundingClientRect();
    const scrollLeft = scrollRef.current.scrollLeft;
    const x = clientX - rect.left + scrollLeft;
    const sec = Math.max(0, Math.min(totalDuration, x / zoom));
    setCurrentTime(sec);
  }

  function startScrub(e) {
    e.preventDefault();
    seekToClientX(e.clientX);
    const onMove = (ev) => seekToClientX(ev.clientX);
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  const totalClips = clips.length;

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/70">
      {/* Controls bar */}
      <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-2">
        <div className="flex items-center gap-1">
          <button onClick={() => setCurrentTime(0)} className="rounded-lg bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700" title="Início">
            <SkipBack size={14} />
          </button>
          <button
            onClick={() => setPlaying(!playing)}
            disabled={totalClips === 0}
            className={`rounded-lg p-2 text-slate-950 transition ${totalClips === 0 ? 'cursor-not-allowed bg-slate-700' : 'bg-sky-500 hover:bg-sky-400'}`}
            title={playing ? 'Pausar' : 'Reproduzir'}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button onClick={() => setCurrentTime(totalDuration)} className="rounded-lg bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700" title="Fim">
            <SkipForward size={14} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-sky-300">
            {totalClips} {totalClips === 1 ? 'clipe' : 'clipes'}
          </span>
          <div className="font-mono text-sm font-bold text-sky-300">
            {formatTime(currentTime)} <span className="text-slate-600">/ {formatTime(totalDuration)}</span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button className="flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1.5 text-xs text-slate-400 hover:bg-slate-800">
            <Scissors size={12} /> Cortar
          </button>
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2 py-1">
            <button onClick={() => setZoom(Math.max(10, zoom - 10))} className="text-slate-400 hover:text-slate-200"><ZoomOut size={14} /></button>
            <input
              type="range"
              min={10}
              max={120}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-24 accent-sky-500"
            />
            <button onClick={() => setZoom(Math.min(120, zoom + 10))} className="text-slate-400 hover:text-slate-200"><ZoomIn size={14} /></button>
          </div>
        </div>
      </div>

      {/* Timeline body */}
      <div className="flex flex-1 min-h-0">
        {/* Track headers */}
        <div className="flex w-16 shrink-0 flex-col border-r border-slate-800 bg-slate-950/40">
          <div className="h-7 border-b border-slate-800" />
          {TRACKS.map((t) => {
            const Icon = t.icon;
            return (
              <div key={t.id} className="flex flex-1 items-center gap-1.5 border-b border-slate-800/60 px-2 text-[10px] font-bold text-slate-400">
                <Icon size={12} className={t.textClass} />
                {t.label}
              </div>
            );
          })}
        </div>

        {/* Scrollable timeline */}
        <div ref={scrollRef} className="relative flex-1 overflow-x-auto overflow-y-hidden">
          <div className="relative" style={{ width: timelineWidth }}>
            {/* Ruler (click/drag to seek) */}
            <div
              className="relative h-7 cursor-pointer select-none border-b border-slate-800 bg-slate-950/40"
              onMouseDown={startScrub}
            >
              {Array.from({ length: rulerMarks + 1 }).map((_, i) => {
                const sec = i * 5;
                const left = sec * zoom;
                if (left > timelineWidth) return null;
                return (
                  <div key={i} className="absolute top-0 flex h-full flex-col justify-end" style={{ left }}>
                    <div className="h-2 w-px bg-slate-700" />
                    <span className="mb-0.5 ml-1 text-[9px] font-mono text-slate-500">{formatTime(sec)}</span>
                  </div>
                );
              })}
            </div>

            {/* Tracks — each is a Droppable */}
            {TRACKS.map((t) => {
              const trackClips = clips.filter((c) => c.track === t.id);
              return (
                <Droppable key={t.id} droppableId={`timeline-${t.id}`} direction="horizontal">
                  {(dropProvided, snapshot) => (
                    <div
                      ref={dropProvided.innerRef}
                      {...dropProvided.droppableProps}
                      className={`relative border-b border-slate-800/60 transition ${snapshot.isDraggingOver ? 'bg-sky-950/30' : ''}`}
                      style={{ height: '2.2rem' }}
                    >
                      {/* Grid lines */}
                      {Array.from({ length: rulerMarks + 1 }).map((_, i) => (
                        <div key={i} className="absolute top-0 h-full w-px bg-slate-800/40" style={{ left: i * 5 * zoom }} />
                      ))}

                      {/* Clips on this track */}
                      {trackClips.map((clip) => {
                        const left = clip.start * zoom;
                        const width = Math.max(20, clip.duration * zoom);
                        return (
                          <div
                            key={clip.id}
                            className={`group absolute top-1 flex h-6 items-center gap-1 overflow-hidden rounded border px-1.5 ${t.clipClass}`}
                            style={{ left, width }}
                            title={clip.type === 'text' ? (clip.text || 'Texto') : clip.title}
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentTime(clip.start);
                            }}
                          >
                            <span className="text-[10px]">{clip.icon}</span>
                            <span className="truncate text-[10px] font-medium text-white">
                              {clip.type === 'text' ? (clip.text || 'Texto') : clip.title}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); onRemove(clip.id); }}
                              className="absolute right-0.5 top-0.5 hidden rounded bg-black/40 p-0.5 text-white group-hover:block hover:bg-rose-600"
                            >
                              <Trash2 size={9} />
                            </button>
                          </div>
                        );
                      })}

                      {/* Empty hint */}
                      {trackClips.length === 0 && (
                        <div className="pointer-events-none flex h-full items-center justify-center text-[10px] text-slate-600">
                          solte {t.hint} aqui
                        </div>
                      )}
                      {dropProvided.placeholder}
                    </div>
                  )}
                </Droppable>
              );
            })}

            {/* Playhead */}
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-30 w-0.5 bg-rose-500"
              style={{ left: playheadLeft }}
            >
              <div className="absolute -top-0 -left-1.5 h-3 w-3.5 rounded-sm bg-rose-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}