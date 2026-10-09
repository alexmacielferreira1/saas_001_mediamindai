import React, { useState } from 'react';
import { Plus, Calendar, Clock, MapPin, Check, Clapperboard } from 'lucide-react';
import { MOCK_CORP_PRECHECKLIST, MOCK_CORP_PRODUCTIONS } from '../../data';
import { useProducaoProjetos, updateProjeto, addProjeto, moverEtapa } from '../../lib/producaoStore';
import { StageDragArea, DraggableStageCard } from './StageDragList';

const PROGRAMAS = Array.from(new Set(MOCK_CORP_PRODUCTIONS.map((p) => p.programa)));
const VIDEOMAKERS = ['Bianca', 'Rafael', 'Ana', 'Carlos Lima', 'Marina Alves'];
const GRAV_STATUS = {
  agendada: { label: 'Agendada', tone: 'bg-sky-500/15 text-sky-300' },
  gravando: { label: 'Gravando', tone: 'bg-amber-500/15 text-amber-300' },
  gravada: { label: 'Gravada', tone: 'bg-emerald-500/15 text-emerald-300' },
  problema: { label: 'Problema', tone: 'bg-rose-500/15 text-rose-300' },
};

function inputCls() {
  return 'w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500';
}

// Gravações: projetos cuja gravação já foi agendada no Rascunho.
// Aqui o que vai gravar (pauta), a equipe e os apresentadores já estão definidos —
// é o lugar de confirmar/ajustar e registrar a gravação concluída (→ Em edição).
export default function GravacoesPage() {
  const projetos = useProducaoProjetos();
  const gravacoes = projetos.filter((p) => p.etapa === 'gravacao' && !p.gravada);
  const [selectedId, setSelectedId] = useState(gravacoes[0]?.id);
  const [checked, setChecked] = useState({});
  const rec = gravacoes.find((p) => p.id === selectedId) || gravacoes[0];

  if (!rec) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-slate-800 bg-slate-900/40 text-sm text-slate-500">
        Nenhuma gravação agendada. Marque uma gravação na aba <span className="font-semibold text-slate-300">&nbsp;Rascunhos&nbsp;</span>.
      </div>
    );
  }

  function field(name, value) { updateProjeto(rec.id, { [name]: value }); }
  function setGravacao(name, value) { updateProjeto(rec.id, { gravacao: { ...rec.gravacao, [name]: value } }); }
  function setEquipe(str) { updateProjeto(rec.id, { equipe: str.split(',').map((s) => s.trim()).filter(Boolean) }); }
  function setApresentador(i, name, value) {
    updateProjeto(rec.id, { apresentadores: rec.apresentadores.map((a, idx) => (idx === i ? { ...a, [name]: value } : a)) });
  }
  function addApresentador() { updateProjeto(rec.id, { apresentadores: [...(rec.apresentadores || []), { nome: '', cg: '' }] }); }
  function nova() {
    const id = addProjeto({ etapa: 'gravacao', programa: PROGRAMAS[0], titulo: 'Nova gravação', gravacao: { data: '', horario: '', estudio: 'Estúdio 1' }, equipe: [], apresentadores: [] });
    setSelectedId(id);
  }

  return (
    <div className="grid h-full gap-4 lg:grid-cols-5">
      {/* Agendamento de gravações */}
      <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/40 lg:col-span-2">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Gravações agendadas</p>
          <button onClick={nova} className="flex items-center gap-1 rounded-md bg-sky-500 px-2 py-1 text-[10px] font-bold text-slate-950 hover:bg-sky-400"><Plus size={11} /> Nova</button>
        </div>
        <StageDragArea onMove={moverEtapa} className="flex-1 min-h-0">
          <div className="h-full space-y-2 overflow-y-auto p-3">
            {gravacoes.map((r) => (
              <DraggableStageCard
                key={r.id}
                id={r.id}
                etapa={r.etapa}
                onClick={() => setSelectedId(r.id)}
                className={`w-full rounded-lg border p-3 text-left transition ${r.id === rec.id ? 'border-sky-600 bg-sky-950/30' : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'}`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase text-sky-400">{r.episodio || '—'} · {r.programa}</p>
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${(GRAV_STATUS[r.grav_status] || GRAV_STATUS.agendada).tone}`}>{(GRAV_STATUS[r.grav_status] || GRAV_STATUS.agendada).label}</span>
                </div>
                <p className="mt-1 text-sm font-medium text-slate-200">{r.titulo}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><Calendar size={10} /> {r.gravacao?.data || '—'}</span>
                  <span className="flex items-center gap-1"><Clock size={10} /> {r.gravacao?.horario || '—'}</span>
                  <span className="flex items-center gap-1"><MapPin size={10} /> {r.gravacao?.estudio || '—'}</span>
                </div>
                {r.videomaker && <p className="mt-1 text-[10px] text-slate-500">Videomaker: <span className={r.videomaker_confirmado ? 'text-emerald-300' : 'text-slate-300'}>{r.videomaker}{r.videomaker_confirmado ? ' ✓' : ' (pend. confirmar)'}</span></p>}
              </DraggableStageCard>
            ))}
          </div>
        </StageDragArea>
      </div>

      {/* Detalhe: gravação + briefing + checklist */}
      <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/40 lg:col-span-3">
        <div className="border-b border-slate-800 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-sky-400">{rec.episodio || '—'} · {rec.programa}</p>
          <h2 className="text-sm font-semibold text-slate-100">{rec.titulo}</h2>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="block">
              <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Data</span>
              <input type="date" value={rec.gravacao?.data || ''} onChange={(e) => setGravacao('data', e.target.value)} className={inputCls()} />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Horário</span>
              <input type="time" value={rec.gravacao?.horario || ''} onChange={(e) => setGravacao('horario', e.target.value)} className={inputCls()} />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Estúdio</span>
              <input value={rec.gravacao?.estudio || ''} onChange={(e) => setGravacao('estudio', e.target.value)} className={inputCls()} />
            </label>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase text-slate-500">O que vai gravar (pauta)</p>
            <textarea value={rec.pauta || ''} onChange={(e) => field('pauta', e.target.value)} rows={2} className={inputCls()} placeholder="Pauta / objetivo da gravação" />
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase text-slate-500">Equipe (funcionários)</p>
            <input value={(rec.equipe || []).join(', ')} onChange={(e) => setEquipe(e.target.value)} className={inputCls()} placeholder="Bianca, Rafael, Ana" />
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase text-slate-500">Apresentadores</p>
            <div className="space-y-1.5">
              {(rec.apresentadores || []).map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={a.nome} onChange={(e) => setApresentador(i, 'nome', e.target.value)} className={inputCls()} placeholder="Nome" />
                  <input value={a.cg} onChange={(e) => setApresentador(i, 'cg', e.target.value)} className={inputCls()} placeholder="CG (cargo/CRM)" />
                </div>
              ))}
              <button onClick={addApresentador} className="flex items-center gap-1 rounded-md border border-dashed border-slate-700 px-2 py-1.5 text-[10px] text-slate-400 hover:bg-slate-800"><Plus size={11} /> Adicionar apresentador</button>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase text-slate-500">Convidado</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={rec.convidado_nome || ''} onChange={(e) => field('convidado_nome', e.target.value)} className={inputCls()} placeholder="Nome" />
              <input value={rec.convidado_cg || ''} onChange={(e) => field('convidado_cg', e.target.value)} className={inputCls()} placeholder="CG (cargo/CRM)" />
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase text-slate-500">Atribuição — Videomaker</p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="block flex-1">
                <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Videomaker responsável</span>
                <select value={rec.videomaker || ''} onChange={(e) => updateProjeto(rec.id, { videomaker: e.target.value, videomaker_confirmado: false })} className={inputCls()}>
                  <option value="">—</option>
                  {VIDEOMAKERS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <button
                onClick={() => updateProjeto(rec.id, { videomaker_confirmado: true })}
                disabled={!rec.videomaker || rec.videomaker_confirmado}
                className="rounded-md bg-sky-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {rec.videomaker_confirmado ? 'Confirmado ✓' : 'Confirmar com videomaker'}
              </button>
            </div>
            {!rec.videomaker && <p className="mt-1 text-[10px] text-slate-500">Designe quem vai gravar — a gravação aparece pra esse videomaker na aba Gravações.</p>}
          </div>

          <div>
            <p className="mb-2 text-[10px] font-bold uppercase text-slate-500">Checklist de pré-gravação</p>
            <div className="space-y-1.5">
              {MOCK_CORP_PRECHECKLIST.map((c, i) => {
                const key = `${rec.id}-${i}`;
                const on = checked[key];
                return (
                  <button
                    key={i}
                    onClick={() => setChecked((s) => ({ ...s, [key]: !s[key] }))}
                    className="flex w-full items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-left hover:border-slate-700"
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? 'border-emerald-500 bg-emerald-500 text-slate-950' : 'border-slate-600'}`}>
                      {on && <Check size={11} />}
                    </span>
                    <span className={`text-xs ${on ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{c}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 px-4 py-3">
          {rec.grav_status !== 'gravando' && rec.grav_status !== 'gravada' && (
            <button onClick={() => updateProjeto(rec.id, { grav_status: 'gravando' })} className="flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-sky-500">
              <Clapperboard size={12} /> Iniciar gravação
            </button>
          )}
          <button
            onClick={() => updateProjeto(rec.id, { gravada: true, grav_status: 'gravada' })}
            disabled={rec.grav_status === 'gravada'}
            className="flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Clapperboard size={12} /> {rec.grav_status === 'gravada' ? 'Gravação registrada ✓' : 'Registrar gravação concluída → Receber materiais'}
          </button>
        </div>
      </div>
    </div>
  );
}