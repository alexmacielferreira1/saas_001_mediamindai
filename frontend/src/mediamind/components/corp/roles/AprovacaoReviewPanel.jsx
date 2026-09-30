import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, Save, CheckCircle2, Trash2, MousePointer2, Pen, Highlighter,
  LogIn, LogOut, MessageSquare, Eraser, ArrowUpRight, Square, Circle, Type, Download, FileVideo, FileText, History, XCircle, RotateCcw,
} from 'lucide-react';

const DURATION = 180000; // mock 3min
const VW = 1000, VH = 562;
const reviewStorageKey = (projectId) => `mediamind:review:${projectId}`;

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

const TOOL_LABEL = {
  pen: 'Caneta', highlighter: 'Marca-texto', arrow: 'Seta', rectangle: 'Retângulo', circle: 'Círculo', text: 'Texto',
};

function renderDrawing(d, key) {
  const points = d.points || [];
  const [start, end = start] = [points[0], points[points.length - 1]];
  if (!start) return null;
  const x1 = start[0] * VW, y1 = start[1] * VH;
  const x2 = end[0] * VW, y2 = end[1] * VH;
  const common = { 'data-annotation-shape': d.tool, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (d.tool === 'rectangle') return <rect key={key} {...common} x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={Math.abs(x2 - x1)} height={Math.abs(y2 - y1)} stroke="#38bdf8" strokeWidth="4" />;
  if (d.tool === 'circle') {
    const radius = Math.hypot(x2 - x1, y2 - y1);
    return <circle key={key} {...common} cx={x1} cy={y1} r={radius} stroke="#a78bfa" strokeWidth="4" />;
  }
  if (d.tool === 'arrow') return <line key={key} {...common} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fb7185" strokeWidth="5" markerEnd="url(#approval-arrow)" />;
  if (d.tool === 'text') return <text key={key} data-annotation-shape="text" x={x1} y={y1} fill="#f8fafc" stroke="#020617" strokeWidth="1" paintOrder="stroke" fontSize="28" fontWeight="700">{d.note || 'Texto'}</text>;
  return <path key={key} {...common} d={toPath(points)} {...strokeStyle(d.tool)} />;
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
  { id: 'arrow', name: 'Seta', Icon: ArrowUpRight },
  { id: 'rectangle', name: 'Retângulo', Icon: Square },
  { id: 'circle', name: 'Círculo', Icon: Circle },
  { id: 'text', name: 'Texto', Icon: Type },
  { id: 'eraser', name: 'Borracha', Icon: Eraser },
];

const DEMO_COMMENTS = [
  { at: '00:01:15', author: 'Marcelo Silva', text: 'Diminuir o tempo desta fala. Está muito longa para o ritmo do jornal.', tone: 'bg-rose-400' },
  { at: '00:03:42', author: 'Elisa Pereira', text: 'Ajustar enquadramento. Deixar mais centralizado no rosto.', tone: 'bg-amber-400' },
  { at: '00:08:21', author: 'Alex Maciel', text: 'Verificar grafismo e ortografia. O nome do projeto está incorreto.', tone: 'bg-sky-400' },
  { at: '00:12:10', author: 'Marcelo Silva', text: 'Inserir imagem de apoio aqui.', tone: 'bg-rose-400' },
  { at: '00:18:33', author: 'Diretor', text: 'Verificar transição para o próximo bloco.', tone: 'bg-emerald-400' },
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
  const [generalComment, setGeneralComment] = useState('');
  const timerRef = useRef(null);
  const erasingRef = useRef(false);

  useEffect(() => {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(reviewStorageKey(project.id)) || 'null'); } catch { saved = null; }
    setAnnotations(Array.isArray(saved?.annotations) ? saved.annotations.map(decodeAnno) : []);
    setGeneralComment(saved?.generalComment || '');
    setTime(0);
    setPlaying(false);
    setTool('play');
    setLoading(false);
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
    if (!['pen', 'highlighter', 'arrow', 'rectangle', 'circle', 'text'].includes(tool)) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrawing({ kind: 'desenho', tool, timecode_ms: time, timecode_label: fmt(time), points: [[x, y]], note: tool === 'text' ? 'Texto' : '', texto: tool === 'text' ? 'Texto' : '', status: 'aberta' });
  }
  function pMove(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    if (erasingRef.current && tool === 'eraser') { eraseAt(x, y); return; }
    if (!drawing) return;
    setDrawing((d) => ({ ...d, points: ['pen', 'highlighter'].includes(d.tool) ? [...d.points, [x, y]] : [d.points[0], [x, y]] }));
  }
  function pUp() {
    erasingRef.current = false;
    if (!drawing) return;
    if (drawing.tool === 'text' || drawing.points.length >= 2) setAnnotations((a) => [...a, drawing]);
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

  function salvarEnviar() {
    setLoading(true);
    localStorage.setItem(reviewStorageKey(project.id), JSON.stringify({ annotations, generalComment }));
    setLoading(false);
    onEnviarEditor?.(project.id);
  }

  function approveVersion() {
    const openReviewNotes = annotations.filter((item) => item.status !== 'resolvida').length + DEMO_COMMENTS.length;
    if (openReviewNotes > 0 && !window.confirm(`Existem ${openReviewNotes} apontamentos abertos. Deseja aprovar esta versão mesmo assim?`)) return;
    onAprovar?.(project.id);
  }

  const draws = annotations.filter((a) => a.kind === 'desenho');

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-900/20">
      <header className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-400">Revisão da produção</p><h2 className="text-base font-semibold text-slate-100">{project.titulo}</h2><p className="text-[10px] text-slate-500">Revise a versão, adicione comentários e solicite ajustes se necessário.</p></div><div className="text-right"><p className="text-[11px] font-semibold text-slate-200">{project.programa} · {project.episodio}</p><span className="mt-1 inline-block rounded bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-300">V3 · Rodada 3 · Em revisão</span></div></header>

      <div className="grid grid-cols-6 border-b border-slate-800 bg-slate-950/25">{['Planejamento','Gravação','Edição','Revisão','Publicação','Concluído'].map((stage, i) => <div key={stage} className={`flex items-center gap-2 border-r border-slate-800 px-3 py-2 ${i === 3 ? 'bg-sky-500/15' : ''}`}><span className={`flex size-6 items-center justify-center rounded-full text-[10px] font-bold ${i <= 3 ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>{i + 1}</span><div><p className={`text-[9px] font-semibold ${i === 3 ? 'text-sky-300' : 'text-slate-400'}`}>{stage}</p><p className="text-[8px] text-slate-600">{i === 3 ? 'Revisar e aprovar' : i < 3 ? 'Concluído' : 'Pendente'}</p></div></div>)}</div>

      <div className="grid min-h-0 flex-1 overflow-hidden xl:grid-cols-[205px_minmax(420px,1fr)_270px]">
        <aside className="min-h-0 overflow-y-auto border-b border-slate-800 bg-slate-950/25 xl:border-b-0 xl:border-r">
          <section className="border-b border-slate-800 p-3"><div className="flex items-center justify-between"><p className="text-[10px] font-bold text-slate-300">Informações da produção</p><button className="rounded border border-sky-700/50 px-2 py-1 text-[9px] text-sky-300">Editar</button></div><div className="mt-3 flex items-center gap-2"><div className="flex size-11 items-center justify-center rounded bg-sky-950 text-sm font-bold text-sky-300">{project.programa?.slice(0,2).toUpperCase()}</div><div><p className="text-[11px] font-semibold text-slate-200">{project.programa}</p><p className="text-[10px] text-slate-500">{project.titulo}</p></div></div><p className="mt-3 text-[9px] leading-relaxed text-slate-500">{project.pauta || 'Conteúdo audiovisual em revisão final para distribuição.'}</p><div className="mt-3 grid grid-cols-2 gap-2 text-[9px]"><div><p className="text-slate-600">Duração</p><p className="text-slate-300">00:28:40</p></div><div><p className="text-slate-600">Editor</p><p className="text-slate-300">{project.editor || project.responsavel || 'Equipe'}</p></div><div><p className="text-slate-600">Status</p><p className="text-amber-300">Em revisão</p></div><div><p className="text-slate-600">Prazo</p><p className="text-slate-300">19/09 18:00</p></div></div></section>
          <section className="p-3"><div className="flex items-center justify-between"><p className="text-[10px] font-bold text-slate-300">Versões da edição</p><button className="rounded bg-sky-500 px-2 py-1 text-[9px] font-bold text-slate-950">+ Nova versão</button></div><div className="mt-2 space-y-2">{[['V3','Em revisão','Alex Maciel','text-amber-300'],['V2','Alterações solicitadas','Elisa Pereira','text-rose-300'],['V1','Aprovada (anterior)','Marcelo Silva','text-emerald-300']].map(([v,s,a,t],i)=><button key={v} className={`w-full rounded border p-2 text-left ${i===0?'border-sky-500 bg-sky-950/30':'border-slate-800 bg-slate-950/30'}`}><div className="flex items-center justify-between"><span className="text-sm font-bold text-slate-200">{v}</span><span className={`text-[8px] font-bold ${t}`}>{s}</span></div><p className="mt-1 text-[8px] text-slate-500">10/09/2026 · {a}</p></button>)}</div><button className="mt-2 w-full rounded border border-slate-700 py-1.5 text-[9px] text-sky-300">Comparar versões</button></section>
        </aside>

        <main className="min-h-0 overflow-y-auto p-2">
          <div className="flex flex-wrap items-center gap-1 border border-slate-800 bg-slate-950/45 p-1">{TOOLS.map((t)=>{const Icon=t.Icon;return <button key={t.id} onClick={()=>setTool(t.id)} aria-pressed={tool===t.id} className={`flex items-center gap-1 rounded px-2 py-1 text-[9px] ${tool===t.id?'bg-sky-500 text-slate-950':'text-slate-400 hover:bg-slate-800'}`}><Icon size={11}/>{t.name}</button>;})}</div>

          <div className="relative mt-2 aspect-video overflow-hidden rounded-xl border border-slate-700 bg-[radial-gradient(circle_at_50%_35%,_#315070,_#132238_48%,_#060a12_80%)]"><div className="absolute inset-x-[22%] bottom-0 top-[14%] rounded-t-[45%] bg-gradient-to-b from-slate-600 via-slate-800 to-slate-950"/><div className="absolute left-[8%] top-[26%] rounded border-2 border-amber-400 bg-amber-950/75 px-3 py-2 text-xs font-bold text-amber-300">Ajustar<br/>enquadramento</div><div className="absolute right-[7%] top-[30%] rounded border-2 border-rose-400 bg-rose-950/80 px-3 py-2 text-xs font-bold text-rose-200">Reduzir tempo<br/>desta fala</div><div className="absolute bottom-[12%] left-[30%] rounded bg-white px-3 py-2 text-xs font-semibold text-slate-900">Verificar grafismo<br/>e ortografia</div><button onClick={()=>setPlaying((p)=>!p)} className="absolute inset-0 flex items-center justify-center text-white/80">{playing?<Pause size={36}/>:<Play size={42}/>}</button><svg aria-label="Área de marcação do vídeo" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" style={{touchAction:'none'}} className={`absolute inset-0 h-full w-full ${tool==='play'?'pointer-events-none':tool==='eraser'?'cursor-cell':'cursor-crosshair'}`} onPointerDown={pDown} onPointerMove={pMove} onPointerUp={pUp}><defs><marker id="approval-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#fb7185"/></marker></defs>{draws.map((d,i)=>renderDrawing(d,`draw-${i}`))}{drawing&&renderDrawing(drawing,'drawing')}</svg><span className="absolute bottom-2 left-3 font-mono text-[9px] text-white">{fmt(time)} / 28:40</span></div>

          <div className="mt-2 rounded-xl border border-slate-800 bg-slate-950/45 p-2"><div onClick={seek} className="relative h-9 cursor-pointer overflow-hidden bg-slate-900"><div className="absolute inset-x-0 bottom-1 h-2 bg-[repeating-linear-gradient(90deg,#29445c_0,#29445c_5px,#17202d_5px,#17202d_8px)]"/>{[18,36,52,68,84].map((x,i)=><span key={x} className={`absolute bottom-0 top-0 w-0.5 ${['bg-amber-400','bg-rose-400','bg-sky-400','bg-emerald-400','bg-rose-400'][i]}`} style={{left:`${x}%`}}/>)}{annotations.map((a,i)=><button key={`marker-${i}`} aria-label={`Marcação ${a.timecode_label}`} onClick={(e)=>{e.stopPropagation();setTime(a.timecode_ms);}} className="absolute top-0 size-2 -translate-x-1/2 rounded-full bg-violet-300 ring-2 ring-slate-950" style={{left:`${(a.timecode_ms/DURATION)*100}%`}}/>)}<div className="absolute bottom-0 top-0 w-0.5 bg-sky-300" style={{left:`${(time/DURATION)*100}%`}}/></div><div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2"><button onClick={markIn} className="rounded border border-slate-700 px-2 py-1 text-[9px] text-emerald-300">IN · {fmt(time)}</button><button onClick={markOut} className="rounded border border-slate-700 px-2 py-1 text-[9px] text-rose-300">OUT · 28:40</button><button className="rounded border border-sky-700 px-3 py-1 text-[9px] text-sky-300">Ir para timecode</button></div></div>

          <div className="mt-2 grid gap-2 lg:grid-cols-[1fr_.7fr]"><label className="rounded-xl border border-slate-800 bg-slate-950/45 p-2"><span className="text-[9px] font-bold text-slate-300">Observação geral desta rodada</span><textarea value={generalComment} onChange={(e)=>setGeneralComment(e.target.value)} rows={3} className="mt-1 w-full resize-none bg-transparent text-[10px] text-slate-300 outline-none" placeholder="Ajustes principais desta revisão..."/></label><div className="rounded-xl border border-slate-800 bg-slate-950/45 p-2"><p className="text-[9px] font-bold text-slate-300">Arquivos e materiais</p><div className="mt-2 space-y-1"><button className="flex w-full items-center justify-between rounded border border-slate-800 px-2 py-1.5 text-[9px] text-slate-400"><span className="flex items-center gap-1"><FileVideo size={11}/>Jornal_da_Cidade_V3.mp4</span><Download size={11}/></button><button className="flex w-full items-center justify-between rounded border border-slate-800 px-2 py-1.5 text-[9px] text-slate-400"><span className="flex items-center gap-1"><FileText size={11}/>Roteiro_JC_Ep235.pdf</span><Download size={11}/></button></div></div></div>
        </main>

        <aside className="min-h-0 overflow-y-auto border-t border-slate-800 bg-slate-950/25 xl:border-l xl:border-t-0">
          <div className="flex items-center justify-between border-b border-slate-800 p-2"><div className="flex gap-1"><button className="rounded bg-sky-500/15 px-2 py-1 text-[9px] text-sky-300">Comentários ({DEMO_COMMENTS.length+annotations.length})</button><button className="rounded px-2 py-1 text-[9px] text-slate-500">Por timecode</button></div><button onClick={()=>document.getElementById('approval-comment-input')?.focus()} className="rounded bg-sky-500 px-2 py-1 text-[9px] font-bold text-slate-950">+ Novo</button></div>
          <div className="divide-y divide-slate-800">{DEMO_COMMENTS.map((c,i)=><button key={i} onClick={()=>setTime([75000,222000,501000,730000,1113000][i]%DURATION)} className="w-full p-2 text-left hover:bg-slate-900/60"><div className="flex items-center gap-2"><span className={`size-2 rounded-full ${c.tone}`}/><span className="text-[9px] font-semibold text-slate-300">{c.author}</span><span className="ml-auto font-mono text-[8px] text-slate-600">{c.at}</span></div><p className="mt-1 pl-4 text-[9px] leading-relaxed text-slate-500">{c.text}</p></button>)}</div>
          {annotations.length > 0 && <div className="divide-y divide-slate-800 border-t border-slate-800">{annotations.map((a,i)=>{const meta=KIND_META[a.kind]||KIND_META.desenho;const Icon=meta.Icon;return <article key={`${a.timecode_ms}-${i}`} className="p-2"><div className="flex items-center gap-1.5"><Icon size={11} className="text-violet-300"/><button onClick={()=>setTime(a.timecode_ms)} className="font-mono text-[9px] text-sky-300">{a.timecode_label}</button><span className={`rounded px-1.5 py-0.5 text-[8px] ${meta.chip}`}>{a.kind==='desenho'?(TOOL_LABEL[a.tool]||meta.label):meta.label}</span><button onClick={()=>toggleStatus(i)} className="ml-auto text-[8px] text-emerald-300">{a.status==='resolvida'?'Resolvida':'Aberta'}</button><button onClick={()=>removeAt(i)} aria-label="Excluir marcação" className="text-slate-600 hover:text-rose-300"><Trash2 size={10}/></button></div><input aria-label={`Comentário da marcação ${i+1}`} value={a.kind==='desenho'?(a.note||''):(a.texto||'')} onChange={(e)=>updateTextAt(i,e.target.value)} placeholder="Descreva o ajuste..." className="mt-1 w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[9px] text-slate-300"/></article>;})}</div>}
          <div className="border-t border-slate-800 p-2"><div className="flex gap-1"><input id="approval-comment-input" value={newText} onChange={(e)=>setNewText(e.target.value)} onKeyDown={(e)=>e.key==='Enter'&&addText()} placeholder="Comentar neste timecode..." className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-[9px] text-slate-200"/><button onClick={addText} className="rounded bg-sky-500 px-2 text-[9px] font-bold text-slate-950">Adicionar</button></div></div>
          <section className="border-t border-slate-800 p-3"><div className="flex items-center justify-between"><p className="flex items-center gap-1 text-[9px] font-bold text-slate-300"><History size={11}/>Histórico da revisão</p><button className="text-[8px] text-sky-400">Ver completo</button></div><div className="mt-2 space-y-2 text-[8px] text-slate-500"><p>10/09 14:32 · Alex enviou V3 para aprovação</p><p>10/09 11:18 · Marcelo solicitou alterações na V2</p><p>09/09 16:20 · João enviou V2 para aprovação</p></div></section>
        </aside>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 px-4 py-3"><p className="text-[9px] text-slate-500"><span className="font-semibold text-rose-300">Existem {DEMO_COMMENTS.length+annotations.length} apontamentos nesta revisão.</span><br/>A produção retornará para a fila Alteração quando forem solicitados ajustes.</p><div className="flex gap-2"><button onClick={salvarEnviar} disabled={loading} className="flex items-center gap-1 rounded border border-amber-500 px-3 py-2 text-[10px] font-bold text-amber-300 hover:bg-amber-500/10"><RotateCcw size={12}/>Enviar para Alteração</button><button onClick={salvarEnviar} disabled={loading} className="flex items-center gap-1 rounded border border-rose-500 px-3 py-2 text-[10px] font-bold text-rose-300 hover:bg-rose-500/10"><XCircle size={12}/>Rejeitar e enviar para Alteração</button><button onClick={approveVersion} disabled={loading} className="flex items-center gap-1 rounded bg-emerald-500 px-4 py-2 text-[10px] font-bold text-slate-950 hover:bg-emerald-400"><CheckCircle2 size={12}/>Aprovar versão</button></div></footer>
    </div>
  );
}
