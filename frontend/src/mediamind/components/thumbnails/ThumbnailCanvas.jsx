import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { renderThumbnail, thumbnailLayers } from '../../lib/thumbnailRenderer';

const ThumbnailCanvas = forwardRef(function ThumbnailCanvas({ draft, format, simers = true, referenceUrl = '', selectedLayer, onSelectLayer, onLayoutChange, showGuides = false }, ref) {
  const canvasRef = useRef(null); const drag = useRef(null); const [error, setError] = useState(''); const [rendering, setRendering] = useState(true);
  const layers = thumbnailLayers(draft, format);
  useEffect(() => {
    let live = true; const canvas = canvasRef.current;
    setRendering(true); setError(''); canvas.dataset.renderStatus = 'rendering';
    const promise = renderThumbnail(canvas, draft, format, { simers, referenceUrl, cancelled: () => !live });
    canvas.thumbnailReady = promise;
    promise.then(() => { if (live) { setRendering(false); canvas.dataset.renderStatus = 'ready'; } }).catch((e) => { if (live) { setError(e.message); setRendering(false); canvas.dataset.renderStatus = 'error'; } });
    return () => { live = false; };
  }, [draft, format, simers, referenceUrl]);
  function down(event) {
    if (!onSelectLayer) return;
    const rect = event.currentTarget.getBoundingClientRect(); const x = (event.clientX - rect.left) / rect.width * 100; const y = (event.clientY - rect.top) / rect.height * 100;
    const layer = [...layers].sort((a, b) => b.order - a.order).find((l) => !l.hidden && x >= l.x && x <= l.x + l.w && y >= l.y && y <= l.y + l.h);
    if (!layer) return;
    onSelectLayer(layer.id, format);
    if (!layer.locked) { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { layer, x, y, rect }; }
  }
  function startResize(event, layer, corner) {
    if (!onLayoutChange || layer.locked) return;
    event.preventDefault(); event.stopPropagation();
    const surface = canvasRef.current?.parentElement; const rect = surface?.getBoundingClientRect();
    if (!surface || !rect?.width || !rect?.height) return;
    surface.setPointerCapture?.(event.pointerId);
    drag.current = { mode: 'resize', layer, corner, rect };
  }
  function move(event) {
    if (!drag.current || !onLayoutChange) return;
    const { layer, x, y, rect, mode, corner } = drag.current;
    if (mode === 'resize') {
      const px = (event.clientX - rect.left) / rect.width * 100; const py = (event.clientY - rect.top) / rect.height * 100;
      const right = layer.x + layer.w; const bottom = layer.y + layer.h;
      const scaleX = corner.includes('e') ? (px - layer.x) / layer.w : (right - px) / layer.w;
      const scaleY = corner.includes('s') ? (py - layer.y) / layer.h : (bottom - py) / layer.h;
      const rawScale = Math.abs(scaleX - 1) > Math.abs(scaleY - 1) ? scaleX : scaleY;
      const scale = Math.max(0.1, rawScale); const w = Math.round(layer.w * scale * 10) / 10; const h = Math.round(layer.h * scale * 10) / 10;
      onLayoutChange(format, layer.id, { x: corner.includes('w') ? Math.round((right - w) * 10) / 10 : layer.x, y: corner.includes('n') ? Math.round((bottom - h) * 10) / 10 : layer.y, w, h });
      return;
    }
    onLayoutChange(format, layer.id, { x: Math.round((layer.x + (event.clientX - rect.left) / rect.width * 100 - x) * 10) / 10, y: Math.round((layer.y + (event.clientY - rect.top) / rect.height * 100 - y) * 10) / 10 });
  }
  const selected = layers.find((l) => l.id === selectedLayer);
  return <div ref={ref} data-testid={`thumbnail-canvas-${format}`} className="relative w-full overflow-hidden rounded-xl" style={{ background: draft.colors.background, aspectRatio: ['single', 'carousel'].includes(draft.pieceType) ? '4/5' : format === 'vertical' ? '9/16' : '16/9', touchAction: 'none' }} onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
    <canvas ref={canvasRef} className="block h-full w-full" aria-label={`${draft.pieceType === 'thumb' || draft.program ? 'Thumb' : 'Arte'} ${format}: ${draft.highlight || draft.title}`} role="img" />
    {showGuides && <div data-testid={`thumbnail-guides-${format}`} className="pointer-events-none absolute inset-[5%] border border-dashed border-cyan-300/70" aria-hidden="true"><span className="absolute inset-y-0 left-1/2 border-l border-dashed border-cyan-300/45" /><span className="absolute inset-x-0 top-1/2 border-t border-dashed border-cyan-300/45" /></div>}
    {selected && !selected.hidden && <div className="pointer-events-none absolute border-2 border-sky-400" style={{ left: `${selected.x}%`, top: `${selected.y}%`, width: `${selected.w}%`, height: `${selected.h}%`, transform: `rotate(${selected.rotation}deg)` }}>{[['nw', '-left-2 -top-2', 'superior esquerdo'], ['ne', '-right-2 -top-2', 'superior direito'], ['se', '-bottom-2 -right-2', 'inferior direito'], ['sw', '-bottom-2 -left-2', 'inferior esquerdo']].map(([corner, position, label]) => <button key={corner} type="button" aria-label={`Redimensionar pelo canto ${label}`} className={`pointer-events-auto absolute h-4 w-4 rounded-sm border-2 border-white bg-sky-400 shadow ${position}`} style={{ cursor: `${corner}-resize` }} onPointerDown={(event) => startResize(event, selected, corner)} />)}</div>}
    {rendering && <span className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-xs text-white">Atualizando…</span>}
    {error && <p role="alert" className="absolute inset-x-0 bottom-0 bg-rose-950/90 p-3 text-xs text-white">{error}</p>}
  </div>;
});
export default ThumbnailCanvas;
