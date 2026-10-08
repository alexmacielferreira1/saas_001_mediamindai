import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { renderThumbnail, thumbnailLayers } from '../../lib/thumbnailRenderer';

const ThumbnailCanvas = forwardRef(function ThumbnailCanvas({ draft, format, simers = true, referenceUrl = '', selectedLayer, onSelectLayer, onLayoutChange }, ref) {
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
  function move(event) {
    if (!drag.current || !onLayoutChange) return;
    const { layer, x, y, rect } = drag.current;
    onLayoutChange(format, layer.id, { x: Math.round((layer.x + (event.clientX - rect.left) / rect.width * 100 - x) * 10) / 10, y: Math.round((layer.y + (event.clientY - rect.top) / rect.height * 100 - y) * 10) / 10 });
  }
  const selected = layers.find((l) => l.id === selectedLayer);
  return <div ref={ref} data-testid={`thumbnail-canvas-${format}`} className="relative w-full overflow-hidden rounded-xl" style={{ background: draft.colors.background, aspectRatio: format === 'vertical' ? '9/16' : '16/9', touchAction: 'none' }} onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
    <canvas ref={canvasRef} className="block h-full w-full" aria-label={`Thumb ${format}: ${draft.highlight || draft.title}`} role="img" />
    {selected && !selected.hidden && <div className="pointer-events-none absolute border-2 border-sky-400" style={{ left: `${selected.x}%`, top: `${selected.y}%`, width: `${selected.w}%`, height: `${selected.h}%`, transform: `rotate(${selected.rotation}deg)` }} />}
    {rendering && <span className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-xs text-white">Atualizando…</span>}
    {error && <p role="alert" className="absolute inset-x-0 bottom-0 bg-rose-950/90 p-3 text-xs text-white">{error}</p>}
  </div>;
});
export default ThumbnailCanvas;
