import React, { useState } from 'react';
import { Check, Plus, Trash2, Flag, Play, Download, Scissors, CalendarClock, FileVideo, Clock3, Copy } from 'lucide-react';
import { useProducaoProjetos, updateProjeto } from '../../lib/producaoStore';
import { buildMediaHandoff } from '../../lib/mediaHandoff';
import { base44 } from '@/api/base44Client';

// Registra (ou reaproveita) a Publicacao real da produção finalizada. É esse
// registro que a fila "Para publicação" e os relatórios de Gestão contam.
export async function registerPublication(proj, handoff) {
  const projectId = String(proj._entityId || proj.id);
  const open = await base44.entities.Publicacao.filter({ project_id: projectId, origem: 'finalizado' }, '-created_date', 20);
  const existing = (open || []).find((item) => String(item.project_id) === projectId && item.origem === 'finalizado' && item.status !== 'publicado');
  if (existing) return existing;
  const created = await base44.entities.Publicacao.create({
    titulo: proj.titulo || 'Publicação',
    descricao: handoff.descricao || '',
    plataforma: 'youtube',
    status: 'rascunho',
    programa: proj.programa || '',
    episodio: proj.episodio || '',
    project_id: projectId,
    trecho_in: handoff.inPoint,
    trecho_out: handoff.outPoint,
    duracao: `${handoff.inPoint}–${handoff.outPoint}`,
    origem: 'finalizado',
  });
  if (!created?.id) throw new Error('o servidor não devolveu o registro criado');
  return created;
}

const STAGES = [
  { id: 'rascunho', name: 'Rascunho', who: 'Equipe de redação' },
  { id: 'gravacao', name: 'Gravação', who: 'Equipe de produção' },
  { id: 'em_edicao', name: 'Edição', who: 'Edição' },
  { id: 'em_aprovacao', name: 'Aprovação', who: 'Direção' },
  { id: 'finalizado', name: 'Finalizado', who: 'Direção' },
];

function fmtDate(d) {
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function genHistory(proj) {
  const base = new Date(proj.created_date || (Date.now() - 12 * 86400000));
  const order = STAGES.map((s) => s.id);
  const curIdx = order.indexOf(proj.etapa);
  const upto = curIdx >= 0 ? curIdx : STAGES.length - 1;
  const out = [];
  for (let i = 0; i <= upto; i++) {
    const s = STAGES[i];
    const when = new Date(base.getTime() + i * 2 * 86400000 + 3 * 3600000);
    out.push({ ...s, when, done: true });
  }
  return out;
}

const STAGE_LABELS = { rascunho: 'Rascunho', gravacao: 'Gravação', em_edicao: 'Edição', em_aprovacao: 'Aprovação', finalizado: 'Finalizado' };

// Histórico real (rastreável) quando existe; senão sintetiza a partir da etapa.
function buildHistory(proj) {
  const h = proj.historico || [];
  if (h.length) {
    return h.map((e, i) => ({
      id: `${e.etapa}-${i}`,
      name: STAGE_LABELS[e.etapa] || e.etapa,
      who: e.quem || '—',
      when: new Date(e.when),
      done: true,
      obs: e.obs || '',
    }));
  }
  return genHistory(proj);
}

// Tela de Finalizado: timeline vertical de processos + histórico (quem/quando/status)
// ligada por nós numerados, e um passo a passo de tarefas marcáveis, criáveis e excluíveis.
export default function FinalizadoTimeline({ onNavigate }) {
  const projetos = useProducaoProjetos();
  const finalizados = projetos.filter((p) => p.etapa === 'finalizado');
  const [selId, setSelId] = useState(finalizados[0]?.id);
  const proj = finalizados.find((p) => p.id === selId) || finalizados[0];
  const [novo, setNovo] = useState('');
  const [inPoint, setInPoint] = useState('00:00:00');
  const [outPoint, setOutPoint] = useState('00:08:42');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');

  if (!proj) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30 text-center text-sm text-slate-500">
        <div><Flag size={22} className="mx-auto mb-2 text-slate-600" />Nenhuma produção finalizada. Avance um projeto até Finalizado na esteira.</div>
      </div>
    );
  }

  const history = buildHistory(proj);
  const tarefas = proj.tarefas || [];
  const feitas = tarefas.filter((t) => t.feito).length;

  function setTarefas(next) { updateProjeto(proj.id, { tarefas: next }); }
  function toggle(id) { setTarefas(tarefas.map((t) => (t.id === id ? { ...t, feito: !t.feito } : t))); }
  function add() { if (!novo.trim()) return; setTarefas([...tarefas, { id: `t-${Date.now()}`, texto: novo.trim(), feito: false }]); setNovo(''); }
  function remove(id) { setTarefas(tarefas.filter((t) => t.id !== id)); }
  function sendTo(destination) { onNavigate?.(destination, buildMediaHandoff(proj, destination, inPoint, outPoint)); }
  async function schedulePublication() {
    if (publishing) return;
    const handoff = buildMediaHandoff(proj, 'publicacoes', inPoint, outPoint);
    setPublishing(true); setPublishError('');
    try {
      const record = await registerPublication(proj, handoff);
      onNavigate?.('publicacoes', { ...handoff, id: record.id, publicationId: record.id });
    } catch (error) {
      setPublishError(`Não foi possível registrar a publicação: ${error?.message || 'erro desconhecido'}.`);
    } finally { setPublishing(false); }
  }

  return (
    <div className="grid h-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950/35 lg:grid-cols-[minmax(300px,30%)_1fr]">
      <aside className="flex min-h-0 flex-col border-b border-slate-800 bg-slate-950/20 lg:border-b-0 lg:border-r">
        <div className="border-b border-slate-800 px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-400">Acervo oficial</p><h2 className="text-sm font-semibold text-slate-100">Produções finalizadas</h2><p className="text-[10px] text-slate-500">{finalizados.length} mídia(s) aprovadas</p></div>
        <div className="flex-1 divide-y divide-slate-800 overflow-y-auto">{finalizados.map((p) => <button key={p.id} onClick={() => setSelId(p.id)} className={`w-full border-l-2 px-4 py-3 text-left transition-colors ${p.id === proj.id ? 'border-l-sky-400 bg-sky-950/35' : 'border-l-transparent hover:bg-slate-900/60'}`}><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-bold uppercase text-sky-400">{p.episodio || '—'} · {p.programa}</p><span className="mm-badge mm-badge-success">oficial</span></div><p className="mt-1 text-xs font-semibold text-slate-200">{p.titulo}</p><p className="mt-1 text-[10px] text-slate-500">Versão aprovada · {p.responsavel || 'Equipe'}</p></button>)}</div>
      </aside>

      <main className="flex min-h-0 flex-col bg-slate-900/20">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 px-4 py-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-400">Finalizado · versão oficial</p><h2 className="text-base font-semibold text-slate-100">{proj.titulo}</h2><p className="text-[11px] text-slate-500">{proj.programa} · {proj.episodio} · aprovado pela Direção</p></div><div className="flex gap-2"><button className="flex items-center gap-1 rounded border border-slate-700 px-2 py-1.5 text-[10px] text-slate-300 hover:bg-slate-800"><Download size={11} /> Baixar master</button><button className="flex items-center gap-1 rounded border border-slate-700 px-2 py-1.5 text-[10px] text-slate-300 hover:bg-slate-800"><Copy size={11} /> Copiar link</button></div></div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <section className="grid gap-3 xl:grid-cols-[1.3fr_.7fr]">
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/65"><div className="flex aspect-video items-center justify-center bg-[radial-gradient(circle_at_center,_#172033,_#050914_70%)]"><button className="flex size-12 items-center justify-center rounded-full border border-sky-400/40 bg-sky-500/15 text-sky-300 hover:bg-sky-500/25"><Play size={20} className="ml-0.5" /></button></div><div className="p-3"><div className="relative h-2 rounded bg-slate-800"><div className="absolute inset-y-0 left-[18%] right-[24%] rounded bg-sky-500/55" /><span className="absolute left-[18%] top-1/2 size-3 -translate-y-1/2 rounded-full bg-emerald-400" /><span className="absolute right-[24%] top-1/2 size-3 -translate-y-1/2 rounded-full bg-rose-400" /></div><div className="mt-2 grid grid-cols-2 gap-2"><label className="text-[9px] uppercase text-slate-500">IN<input value={inPoint} onChange={(e) => setInPoint(e.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-emerald-300" /></label><label className="text-[9px] uppercase text-slate-500">OUT<input value={outPoint} onChange={(e) => setOutPoint(e.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-rose-300" /></label></div></div></div>
            <div className="space-y-3"><section className="rounded-xl border border-slate-800 bg-slate-950/45 p-3"><p className="text-[10px] font-bold uppercase text-slate-400">Dados da versão oficial</p><div className="mt-2 grid grid-cols-2 gap-3 text-[10px]"><div><p className="text-slate-600">Versão</p><p className="text-slate-300">V3 Master</p></div><div><p className="text-slate-600">Duração</p><p className="text-slate-300">00:08:42</p></div><div><p className="text-slate-600">Formato</p><p className="text-slate-300">16:9 · 4K</p></div><div><p className="text-slate-600">Aprovado em</p><p className="text-slate-300">18/09/2026</p></div><div><p className="text-slate-600">Responsável</p><p className="text-slate-300">{proj.responsavel || 'Equipe'}</p></div><div><p className="text-slate-600">Status</p><p className="text-emerald-300">Oficial</p></div></div></section>{onNavigate && <section className="rounded-xl border border-slate-800 bg-slate-950/45 p-3"><p className="text-[10px] font-bold uppercase text-slate-400">Próximas ações</p><p className="mt-1 text-[9px] text-slate-500">O trecho {inPoint}–{outPoint} e seus metadados serão enviados juntos.</p><div className="mt-2 space-y-2"><button onClick={() => sendTo('redes_sociais')} className="flex w-full items-center justify-center gap-1.5 rounded bg-violet-500 px-3 py-2 text-[11px] font-bold text-slate-950 hover:bg-violet-400"><Scissors size={12} /> Enviar trecho para Cortes</button><button onClick={schedulePublication} disabled={publishing} className="flex w-full items-center justify-center gap-1.5 rounded bg-sky-500 px-3 py-2 text-[11px] font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-60"><CalendarClock size={12} /> {publishing ? 'Registrando…' : 'Agendar publicação'}</button>{publishError && <p role="alert" className="text-[10px] text-rose-300">{publishError}</p>}</div></section>}</div>
          </section>

          <section className="grid gap-3 xl:grid-cols-2"><div className="rounded-xl border border-slate-800 bg-slate-950/45"><div className="border-b border-slate-800 px-3 py-2"><p className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-400"><Clock3 size={11} /> Histórico da produção</p></div><div className="grid grid-cols-2 gap-2 p-3">{history.map((e, i) => <div key={e.id} className="rounded-xl border border-slate-800 bg-slate-950/45 p-2"><div className="flex items-center justify-between"><p className="text-[10px] font-semibold text-slate-200">{i + 1}. {e.name}</p><Check size={11} className="text-emerald-400" /></div><p className="mt-1 text-[9px] text-slate-500">{e.who} · {fmtDate(e.when)}</p></div>)}</div></div><div className="rounded-xl border border-slate-800 bg-slate-950/45"><div className="flex items-center justify-between border-b border-slate-800 px-3 py-2"><p className="text-[10px] font-bold uppercase text-slate-400">Checklist final · {feitas}/{tarefas.length}</p><FileVideo size={12} className="text-sky-400" /></div><div className="max-h-44 divide-y divide-slate-800 overflow-y-auto">{tarefas.map((t) => <div key={t.id} className="flex items-center gap-2 px-3 py-2"><button onClick={() => toggle(t.id)} className={`flex size-5 items-center justify-center rounded border ${t.feito ? 'border-emerald-500 bg-emerald-500 text-slate-950' : 'border-slate-600'}`}>{t.feito && <Check size={12} />}</button><span className={`flex-1 text-[10px] ${t.feito ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{t.texto}</span><button onClick={() => remove(t.id)} className="text-slate-600 hover:text-rose-300"><Trash2 size={11} /></button></div>)}</div><div className="flex gap-2 border-t border-slate-800 p-2"><input value={novo} onChange={(e) => setNovo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Nova tarefa..." className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-200" /><button onClick={add} className="rounded bg-sky-500 px-2 text-slate-950"><Plus size={12} /></button></div></div></section>
        </div>
      </main>
    </div>
  );
}
