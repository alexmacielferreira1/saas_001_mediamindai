import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, Save, CheckCircle2, Trash2, MousePointer2, Pen, Highlighter,
  LogIn, LogOut, MessageSquare, Eraser,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';

const DURATION = 180000; // mock 3min
const VW = 1000, VH = 562;

function fmt(ms) {
  const s = Math.floor((ms || 0) / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
function toPath(pts) {
  return (pts || []).map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${(x * VW).toFixed(1)} ${(y * VH).toFixed(1)}`).join(' ');
}
function strokeStyle(tool) {
  return tool === 'highlighter'
    ? { stroke: '#fbbf24', strokeWidth: 22, strokeOpacity: 0.35 }
    : { stroke: '#22d3ee', strokeWidth: 3, strokeOpacity: 1 };
}

// Distância de um ponto a um segmento (para hit-test da borracha).
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function strokeHit(px, py, points, tol) {
  if (!points || !points.length) return false;
  if (points.length === 1) return Math.hypot(px - points[0][0], py - points[0][1]) <= tol;
  for (let i = 1; i < points.length; i++) {
    if (segDist(px, py, points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]) <= tol) return true;
  }
  return false;
}

// Tipo codificado no texto do ComentarioRevisao: desenho/in/out/texto.
function encodeAnno(a) {
  if (a.kind === 'desenho') return `@@desenho@@${JSON.stringify({ tool: a.tool, points: a.points, note: a.note || '' })}`;
  if (a.kind === 'in') return `@@in@@${a.texto || ''}`;
  if (a.kind === 'out') return `@@out@@${a.texto || ''}`;
  return a.texto || '';
}
function decodeAnno(c) {
  const t = c.texto || '';
  const tc = c.timecode_ms || 0;
  const label = c.timecode_label || fmt(tc);
  if (t.startsWith('@@desenho@@')) {
    try {
      const p = JSON.parse(t.slice(10));
      return { _id: c.id, kind: 'desenho', timecode_ms: tc, timecode_label: label, tool: p.tool, points: p.points || [], note: p.note || '', texto: p.note || '', status: c.status || 'aberta' };
    } catch { /* ignore */ }
  }
  if (t.startsWith('@@in@@')) return { _id: c.id, kind: 'in', timecode_ms: tc, timecode_label: label, texto: t.slice(6), status: c.status || 'aberta' };
  if (t.startsWith('@@out@@')) return { _id: c.id, kind: 'out', timecode_ms: tc, timecode_label: label, texto: t.slice(7), status: c.status || 'aberta' };
  return { _id: c.id, kind: 'texto', timecode_ms: tc, timecode_label: label, texto: t, status: c.status || 'aberta' };
}

const KIND_META = {
  texto: { Icon: MessageSquare, label: 'Texto', mark: 'bg-amber-400', chip: 'bg-amber-500/15 text-amber-300' },
  desenho: { Icon: Pen, label: 'Desenho', mark: 'bg-violet-400', chip: 'bg-violet-500/15 text-violet-300' },
  in: { Icon: LogIn, label: 'IN', mark: 'bg-emerald-400', chip: 'bg-emerald-500/15 text-emerald-300' },
  out: { Icon: LogOut, label: 'OUT', mark: 'bg-rose-400', chip: 'bg-rose-500/15 text-rose-300' },
};

const TOOLS = [
  { id: 'play', name: 'Mover', Icon: MousePointer2 },
  { id: 'pen', name: 'Caneta', Icon: Pen },
  { id: 'highlighter', name: 'Marca-texto', Icon: Highlighter },
  { id: 'eraser', name: 'Borracha', Icon: Eraser },
];

// Player de conferência com camada de anotação acima do vídeo.
// Caneta/marca-texto desenham sobre o vídeo (não alteram o arquivo);
// IN/OUT e texto marcam frames. Tudo é salvo pro editor ver.
export default function AprovacaoReviewPanel({ project, onEnviarEditor, onAprovar }) {
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [tool, setTool] = useState('play');
  const [annotations, setAnnotations] = useState([]);
  const [drawing, setDrawing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [newText, setNewText] = useState('');
  const timerRef = useRef(null);
  const erasingRef = useRef(false);

  useEffect(() => {
    let alive = true;
    setAnnotations([]);
    setTime(0);
    setPlaying(false);
    setTool('play');
    setLoading(true);
    base44.entities.ComentarioRevisao.filter({ asset_id: project.id })
      .then((list) => { if (alive) setAnnotations(list.map(decodeAnno)); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [project.id]);

  useEffect(() => {
    if (!playing) return;
    timerRef.current = setInterval(() => {
      setTime((t) => { if (t >= DURATION) { setPlaying(false); return DURATION; } return t + 1000; });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [playing]);

  // --- drawing / borracha ---
  function eraseAt(x, y) {
    const tol = 0.025;
    setAnnotations((a) => a.filter((an) => an.kind !== 'desenho' || !strokeHit(x, y, an.points, tol)));
  }
  function pDown(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    if (tool === 'eraser') {
      erasingRef.current = true;
      eraseAt(x, y);
      return;
    }
    if (tool !== 'pen' && tool !== 'highlighter') return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrawing({ kind: 'desenho', tool, timecode_ms: time, timecode_label: fmt(time), points: [[x, y]], note: '', texto: '', status: 'aberta' });
  }
  function pMove(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    if (erasingRef.current && tool === 'eraser') { eraseAt(x, y); return; }
    if (!drawing) return;
    setDrawing((d) => ({ ...d, points: [...d.points, [x, y]] }));
  }
  function pUp() {
    erasingRef.current = false;
    if (!drawing) return;
    if (drawing.points.length >= 2) setAnnotations((a) => [...a, drawing]);
    setDrawing(null);
  }

  // --- annotations CRUD ---
  function addText() {
    if (!newText.trim()) return;
    setAnnotations((a) => [...a, { kind: 'texto', timecode_ms: time, timecode_label: fmt(time), texto: newText.trim(), status: 'aberta' }]);
    setNewText('');
  }
  function markIn() {
    setAnnotations((a) => [...a, { kind: 'in', timecode_ms: time, timecode_label: fmt(time), texto: newText.trim(), status: 'aberta' }]);
    setNewText('');
  }
  function markOut() {
    setAnnotations((a) => [...a, { kind: 'out', timecode_ms: time, timecode_label: fmt(time), texto: newText.trim(), status: 'aberta' }]);
    setNewText('');
  }
  function removeAt(i) { setAnnotations((a) => a.filter((_, idx) => idx !== i)); }
  function updateTextAt(i, v) {
    setAnnotations((a) => a.map((x, idx) => (idx === i ? { ...x, texto: v, note: x.kind === 'desenho' ? v : x.note } : x)));
  }
  function toggleStatus(i) {
    setAnnotations((a) => a.map((x, idx) => (idx === i ? { ...x, status: x.status === 'resolvida' ? 'aberta' : 'resolvida' } : x)));
  }
  function clearDrawings() { setAnnotations((a) => a.filter((x) => x.kind !== 'desenho')); }

  function seek(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    setTime(Math.round(ratio * DURATION));
  }

  async function salvarEnviar() {
    setLoading(true);
    const novos = annotations.filter((a) => !a._id && (a.kind === 'desenho' ? a.points.length >= 2 : true));
    if (novos.length) {
      try {
        await base44.entities.ComentarioRevisao.bulkCreate(
          novos.map((a) => ({
            asset_id: project.id,
            asset_title: project.titulo,
            timecode_ms: a.timecode_ms,
            timecode_label: a.timecode_label,
            texto: encodeAnno(a),
            status: 'aberta',
            versao: 'v1',
          }))
        );
      } catch { /* ignore */ }
    }
    setLoading(false);
    onEnviarEditor?.(project.id);
  }

  const draws = annotations.filter((a) => a.kind === 'desenho');

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="mb-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-sky-400">Player de conferência</p>
        <h2 className="text-sm font-semibold text-slate-100">{project.titulo}</h2>
        <p className="text-[11px] text-slate-500">{project.programa} · {project.episodio} · resp. {project.responsavel || '—'}</p>
        {project.revisao_intermediaria && (
          <span className="mt-1 inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">Revisão intermediária do produtor</span>
        )}
      </div>

      {/* Toolbar de marcação */}
      <div className="mb-2 flex flex-wrap items-center gap-1 rounded-md border border-slate-700 bg-slate-950/50 p-1">
        {TOOLS.map((t) => {
          const Icon = t.Icon;
          return (
            <button key={t.id} onClick={() => setTool(t.id)} title={t.name}
              className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold transition ${tool === t.id ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800'}`}>
              <Icon size={12} /> {t.name}
            </button>
          );
        })}
        <div className="mx-1 h-4 w-px bg-slate-700" />
        <button onClick={markIn} title="Marcar IN no frame atual" className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/10"><LogIn size={12} /> IN</button>
        <button onClick={markOut} title="Marcar OUT no frame atual" className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold text-rose-300 hover:bg-rose-500/10"><LogOut size={12} /> OUT</button>
        <button onClick={clearDrawings} title="Limpar desenhos" className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold text-slate-400 hover:bg-slate-800"><Eraser size={12} /> Limpar</button>
      </div>

      {/* Player + camada de anotação */}
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-gradient-to-br from-slate-800 to-slate-950">
        <button onClick={() => setPlaying((p) => !p)} className="absolute inset-0 flex items-center justify-center text-slate-200/80 hover:text-white">
          {playing ? <Pause size={40} /> : <Play size={48} />}
        </button>
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          preserveAspectRatio="none"
          style={{ touchAction: 'none' }}
          className={`absolute inset-0 h-full w-full ${tool === 'play' ? 'pointer-events-none' : tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair'}`}
          onPointerDown={pDown}
          onPointerMove={pMove}
          onPointerUp={pUp}
        >
          {draws.map((d, i) => (
            <path key={i} d={toPath(d.points)} fill="none" strokeLinecap="round" strokeLinejoin="round" {...strokeStyle(d.tool)} />
          ))}
          {drawing && (
            <path d={toPath(drawing.points)} fill="none" strokeLinecap="round" strokeLinejoin="round" {...strokeStyle(drawing.tool)} />
          )}
        </svg>
        <span className="absolute right-2 top-2 rounded bg-black/50 px-1.5 py-0.5 font-mono text-[10px] text-slate-200">{fmt(time)} / {fmt(DURATION)}</span>
      </div>

      {/* Scrubber com marcadores por tipo */}
      <div className="mt-2">
        <div onClick={seek} className="relative h-2 cursor-pointer rounded-full bg-slate-800">
          <div className="absolute left-0 top-0 h-full rounded-full bg-sky-500" style={{ width: `${(time / DURATION) * 100}%` }} />
          <div className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-sky-300" style={{ left: `calc(${(time / DURATION) * 100}% - 6px)` }} />
          {annotations.map((a, i) => {
            const meta = KIND_META[a.kind];
            return <div key={i} className={`absolute top-1/2 h-2 w-0.5 -translate-y-1/2 ${meta.mark}`} style={{ left: `${(a.timecode_ms / DURATION) * 100}%` }} title={`${meta.label}: ${a.kind === 'desenho' ? a.note : a.texto}`} />;
          })}
        </div>
      </div>

      {/* Anotar texto no frame */}
      <div className="mt-3 flex items-center gap-2">
        <input value={newText} onChange={(e) => setNewText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addText(); }} placeholder="Anotar texto no frame atual..." className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500" />
        <button onClick={addText} className="rounded-md bg-slate-700 px-3 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-slate-600">Add</button>
      </div>

      {/* Lista de marcações */}
      <div className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto">
        {annotations.length === 0 && <p className="text-[11px] text-slate-500">Sem marcações. Use caneta/marca-texto sobre o vídeo, IN/OUT ou anote um texto.</p>}
        {annotations.map((a, i) => {
          const meta = KIND_META[a.kind];
          const Icon = meta.Icon;
          return (
            <div key={i} className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/40 p-2">
              <button onClick={() => setTime(a.timecode_ms)} className="shrink-0 rounded bg-sky-500/15 px-1.5 py-0.5 font-mono text-[10px] text-sky-300 hover:bg-sky-500/25">{a.timecode_label}</button>
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${meta.chip}`}><Icon size={10} className="-mt-0.5 mr-0.5 inline" />{meta.label}</span>
              <input
                value={a.kind === 'desenho' ? a.note || '' : a.texto || ''}
                onChange={(e) => updateTextAt(i, e.target.value)}
                placeholder={a.kind === 'desenho' ? 'Nota sobre o desenho...' : a.kind === 'in' ? 'Texto do IN...' : a.kind === 'out' ? 'Texto do OUT...' : 'Descrição...'}
                className="flex-1 bg-transparent text-[11px] text-slate-200 outline-none"
              />
              <button onClick={() => toggleStatus(i)} title="Alternar resolvida" className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${a.status === 'resolvida' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700/50 text-slate-400'}`}>{a.status === 'resolvida' ? 'ok' : 'aberta'}</button>
              <button onClick={() => removeAt(i)} className="shrink-0 text-slate-500 hover:text-rose-400"><Trash2 size={12} /></button>
            </div>
          );
        })}
      </div>

      {/* Ações */}
      <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
        <button onClick={salvarEnviar} disabled={loading} className="flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50">
          <Save size={12} /> Reprovar com ajustes (volta pra edição)
        </button>
        <button onClick={() => onAprovar?.(project.id)} disabled={loading} className="flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50">
          <CheckCircle2 size={12} /> Aprovar (→ Finalizado)
        </button>
      </div>
    </div>
  );
}