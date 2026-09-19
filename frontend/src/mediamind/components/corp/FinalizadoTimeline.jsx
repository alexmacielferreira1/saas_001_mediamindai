import React, { useState } from 'react';
import { Check, Plus, Trash2, Flag, Film, Send } from 'lucide-react';
import { useProducaoProjetos, updateProjeto } from '../../lib/producaoStore';

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

  return (
    <div className="grid h-full gap-4 lg:grid-cols-5">
      {/* Timeline vertical */}
      <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/40 lg:col-span-2">
        <div className="border-b border-slate-800 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-sky-400">Linha do tempo da produção</p>
          <h2 className="truncate text-sm font-semibold text-slate-100">{proj.titulo}</h2>
          {finalizados.length > 1 && (
            <select value={proj.id} onChange={(e) => setSelId(e.target.value)} className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-200 outline-none">
              {finalizados.map((p) => <option key={p.id} value={p.id}>{p.titulo}</option>)}
            </select>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <ol className="space-y-0">
            {history.map((e, i) => (
              <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
                <div className="flex flex-col items-center">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${e.done ? 'bg-sky-500 text-slate-950' : 'border border-slate-700 text-slate-500'}`}>{i + 1}</div>
                  {i < history.length - 1 && <span className="mt-1 w-px flex-1 bg-gradient-to-b from-sky-600/60 to-slate-700" />}
                </div>
                <div className="flex-1 pb-1">
                  <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-200">{e.name}</p>
                      <span className="mm-badge mm-badge-success">concluído</span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">{e.who} · {fmtDate(e.when)}</p>
                    {e.obs && <p className="mt-1 text-[10px] italic text-slate-400">↳ {e.obs}</p>}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Passo a passo */}
      <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/40 lg:col-span-3">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Passo a passo</p>
            <p className="text-xs text-slate-300">Status: <span className="font-semibold text-emerald-300">{feitas}/{tarefas.length} tarefas</span> · Produção finalizada</p>
          </div>
          <span className="mm-badge mm-badge-success"><Flag size={11} /> Finalizado</span>
        </div>

        {onNavigate && (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-4 py-2.5">
            <button onClick={() => onNavigate('cortes')} className="flex items-center gap-1.5 rounded-md bg-violet-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-violet-400">
              <Film size={12} /> Enviar pra Cortes
            </button>
            <button onClick={() => onNavigate('publicacoes')} className="flex items-center gap-1.5 rounded-md bg-sky-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-sky-400">
              <Send size={12} /> Agendar publicação
            </button>
          </div>
        )}

        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {tarefas.length === 0 && <p className="py-6 text-center text-[11px] text-slate-500">Nenhuma tarefa. Adicione os passos da produção.</p>}
          {tarefas.map((t) => (
            <div key={t.id} className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
              <button onClick={() => toggle(t.id)} className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${t.feito ? 'border-emerald-500 bg-emerald-500 text-slate-950' : 'border-slate-600'}`}>{t.feito && <Check size={12} />}</button>
              <span className={`flex-1 text-xs ${t.feito ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{t.texto}</span>
              <button onClick={() => remove(t.id)} className="rounded-md border border-slate-700 px-1.5 py-1 text-slate-400 hover:bg-rose-950/40 hover:text-rose-300"><Trash2 size={12} /></button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 border-t border-slate-800 p-3">
          <input value={novo} onChange={(e) => setNovo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Nova tarefa do passo a passo..." className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500" />
          <button onClick={add} className="flex items-center gap-1 rounded-md bg-sky-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-sky-400"><Plus size={12} /> Adicionar</button>
        </div>
      </div>
    </div>
  );
}