import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Users, CheckCircle, Trash2, Sparkles, Clapperboard } from 'lucide-react';
import { MOCK_CORP_PRESENTERS, MOCK_CORP_PRODUCTIONS } from '../../data';
import { useProducaoProjetos, updateProjeto, addProjeto, setEtapa, moverEtapa } from '../../lib/producaoStore';
import { StageDragArea, DraggableStageCard } from './StageDragList';
import BriefingChecklistPanel from './BriefingChecklistPanel';

const STATUS = {
  rascunho: { label: 'Rascunho', tone: 'bg-slate-500/15 text-slate-300' },
  gravacao: { label: 'Gravação agendada', tone: 'bg-sky-500/15 text-sky-300' },
  em_edicao: { label: 'Em edição', tone: 'bg-violet-500/15 text-violet-300' },
};

const PROGRAMAS = Array.from(new Set(MOCK_CORP_PRODUCTIONS.map((p) => p.programa)));

function inputCls(editable) {
  return `w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500 disabled:opacity-60 disabled:cursor-not-allowed ${editable ? '' : 'opacity-70'}`;
}

function Section({ title, action, children }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{title}</p>
        {action}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[9px] uppercase text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function RascunhoActions({ proj, onMarcar, onRegistrar }) {
  const [scheduling, setScheduling] = useState(false);
  const [data, setData] = useState(proj.gravacao?.data || '');
  const [horario, setHorario] = useState(proj.gravacao?.horario || '');
  const [estudio, setEstudio] = useState(proj.gravacao?.estudio || 'Estúdio 1');
  const [pauta, setPauta] = useState(proj.pauta || '');
  const [equipe, setEquipe] = useState((proj.equipe || []).join(', '));

  if (proj.etapa === 'rascunho') {
    if (scheduling) {
      return (
        <div className="space-y-2">
          <p className="text-[10px] text-slate-400">Ao marcar, você define o que vai gravar, a equipe e a data. A data é opcional no rascunho, mas obrigatória pra agendar.</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Data *</span>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputCls(true)} />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Horário *</span>
              <input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} className={inputCls(true)} />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Estúdio</span>
              <input value={estudio} onChange={(e) => setEstudio(e.target.value)} className={inputCls(true)} />
            </label>
          </div>
          <label className="block">
            <span className="mb-0.5 block text-[9px] uppercase text-slate-500">O que vai gravar (pauta)</span>
            <textarea value={pauta} onChange={(e) => setPauta(e.target.value)} rows={2} className={inputCls(true)} placeholder="Pauta / objetivo da gravação" />
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Equipe (funcionários, separados por vírgula)</span>
            <input value={equipe} onChange={(e) => setEquipe(e.target.value)} className={inputCls(true)} placeholder="Bianca, Rafael, Ana" />
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (data && horario) {
                  onMarcar({ data, horario, estudio, pauta, equipe: equipe.split(',').map((s) => s.trim()).filter(Boolean) });
                  setScheduling(false);
                }
              }}
              className="rounded-md bg-sky-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-sky-400"
            >
              Confirmar
            </button>
            <button onClick={() => setScheduling(false)} className="rounded-md border border-slate-700 px-3 py-1.5 text-[11px] text-slate-400 hover:bg-slate-800">Cancelar</button>
          </div>
        </div>
      );
    }
    return (
      <button onClick={() => setScheduling(true)} className="flex items-center gap-1.5 rounded-md bg-sky-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-sky-400">
        <Calendar size={12} /> Marcar gravação
      </button>
    );
  }
  if (proj.etapa === 'gravacao') {
    if (proj.grav_status === 'gravada') {
      return (
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <CheckCircle size={13} className="text-emerald-400" /> Gravação registrada — receba os materiais na aba <span className="font-semibold text-slate-200">Gravações</span>.
        </div>
      );
    }
    return (
      <button onClick={onRegistrar} className="flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-amber-400">
        <CheckCircle size={12} /> Registrar gravação concluída
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2 text-[11px] text-slate-400">
      <Clapperboard size={13} className="text-violet-400" /> Produção seguiu para edição — continue na aba <span className="font-semibold text-slate-200">Em edição</span>.
    </div>
  );
}

export default function RascunhosPage({ newDraftSignal = 0 }) {
  const projetos = useProducaoProjetos();
  const meus = projetos.filter((p) => ['rascunho', 'gravacao', 'em_edicao'].includes(p.etapa));
  const [selectedId, setSelectedId] = useState(meus[0]?.id);
  const selected = meus.find((p) => p.id === selectedId) || meus[0];

  // Sinal do botão "Novo" (/corp?novo=producao): cria um rascunho novo.
  useEffect(() => {
    if (newDraftSignal > 0) addDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newDraftSignal]);

  if (!selected) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-slate-800 bg-slate-900/40 text-sm text-slate-500">
        Nenhum rascunho. Crie um novo projeto pra começar.
      </div>
    );
  }

  function field(name, value) { updateProjeto(selected.id, { [name]: value }); }
  function addDraft() {
    const id = addProjeto({ programa: PROGRAMAS[0], titulo: 'Nova produção', apresentadores: [] });
    setSelectedId(id);
  }
  function setPresenter(i, name, value) {
    updateProjeto(selected.id, { apresentadores: selected.apresentadores.map((a, idx) => (idx === i ? { ...a, [name]: value } : a)) });
  }
  function addPresenter() { updateProjeto(selected.id, { apresentadores: [...(selected.apresentadores || []), { nome: '', cg: '' }] }); }
  function removePresenter(i) { updateProjeto(selected.id, { apresentadores: selected.apresentadores.filter((_, idx) => idx !== i) }); }
  function loadDefaults() { updateProjeto(selected.id, { apresentadores: MOCK_CORP_PRESENTERS.map((p) => ({ nome: p.nome, cg: p.cg })) }); }

  const editable = selected.etapa === 'rascunho' || selected.etapa === 'gravacao';
  const st = STATUS[selected.etapa];

  return (
    <div className="grid h-full gap-4 lg:grid-cols-5">
      {/* Lista de rascunhos */}
      <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/40 lg:col-span-2">
        <div className="flex items-center justify-between border-b border-slate-800 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Rascunhos</p>
          <button onClick={addDraft} className="flex items-center gap-1 rounded-md bg-sky-500 px-2 py-1.5 text-[10px] font-bold text-slate-950 hover:bg-sky-400"><Plus size={11} /> Novo</button>
        </div>
        <StageDragArea onMove={moverEtapa} className="flex-1 min-h-0">
          <div className="h-full overflow-y-auto p-2">
            {meus.map((d) => {
              const ds = STATUS[d.etapa];
              return (
                <DraggableStageCard key={d.id} id={d.id} etapa={d.etapa} onClick={() => setSelectedId(d.id)} className={`mb-1.5 w-full rounded-lg border px-3 py-2 text-left transition ${selectedId === d.id ? 'border-sky-600 bg-sky-950/30' : 'border-slate-800 hover:bg-slate-800/30'}`}>
                  <p className="truncate text-xs font-medium text-slate-200">{d.titulo}</p>
                  <p className="truncate text-[10px] text-slate-500">{d.programa}{d.episodio ? ` · ${d.episodio}` : ''}</p>
                  {ds && <span className={`mt-1.5 inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${ds.tone}`}>{ds.label}</span>}
                </DraggableStageCard>
              );
            })}
          </div>
        </StageDragArea>
      </div>

      {/* Editor */}
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 lg:col-span-3">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-sky-400">Rascunho de produção</p>
            <h2 className="text-sm font-semibold text-slate-100">{selected.titulo}</h2>
          </div>
          <span className={`rounded px-2 py-1 text-[10px] font-bold uppercase ${st.tone}`}>{st.label}</span>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <Section title="Identificação">
            <Field label="Título de trabalho">
              <input disabled={!editable} value={selected.titulo} onChange={(e) => field('titulo', e.target.value)} className={inputCls(editable)} />
            </Field>
            <Field label="Programa">
              <select disabled={!editable} value={selected.programa} onChange={(e) => field('programa', e.target.value)} className={inputCls(editable)}>
                <option value="">—</option>
                {PROGRAMAS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Episódio">
              <input disabled={!editable} value={selected.episodio || ''} onChange={(e) => field('episodio', e.target.value)} placeholder="EP054" className={inputCls(editable)} />
            </Field>
          </Section>

          <Section title="Conteúdo">
            <Field label="Headline">
              <input disabled={!editable} value={selected.headline} onChange={(e) => field('headline', e.target.value)} placeholder="Título da matéria/episódio" className={inputCls(editable)} />
            </Field>
            <Field label="Descrição">
              <textarea disabled={!editable} value={selected.descricao} onChange={(e) => field('descricao', e.target.value)} rows={3} placeholder="Sinopse / pauta" className={inputCls(editable)} />
            </Field>
          </Section>

          <Section
            title="Pessoas"
            action={editable && (
              <button onClick={loadDefaults} className="flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"><Sparkles size={11} /> Apresentadores padrão</button>
            )}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Convidado — nome">
                <input disabled={!editable} value={selected.convidado_nome} onChange={(e) => field('convidado_nome', e.target.value)} className={inputCls(editable)} />
              </Field>
              <Field label="Convidado — CG">
                <input disabled={!editable} value={selected.convidado_cg} onChange={(e) => field('convidado_cg', e.target.value)} placeholder="Cargo / CRM / título" className={inputCls(editable)} />
              </Field>
            </div>
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase text-slate-500"><Users size={11} /> Apresentadores</div>
              <div className="space-y-1.5">
                {(selected.apresentadores || []).map((a, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input disabled={!editable} value={a.nome} onChange={(e) => setPresenter(i, 'nome', e.target.value)} placeholder="Nome" className={inputCls(editable)} />
                    <input disabled={!editable} value={a.cg} onChange={(e) => setPresenter(i, 'cg', e.target.value)} placeholder="CG (cargo/CRM)" className={inputCls(editable)} />
                    {editable && <button onClick={() => removePresenter(i)} className="shrink-0 rounded-md border border-slate-700 px-2 py-1.5 text-slate-400 hover:bg-slate-800"><Trash2 size={12} /></button>}
                  </div>
                ))}
                {editable && <button onClick={addPresenter} className="flex items-center gap-1 rounded-md border border-dashed border-slate-700 px-2 py-1.5 text-[10px] text-slate-400 hover:bg-slate-800"><Plus size={11} /> Adicionar apresentador</button>}
                {(!selected.apresentadores || selected.apresentadores.length === 0) && <p className="text-[10px] text-slate-600">Nenhum apresentador. Use "Apresentadores padrão" para preencher os fixos.</p>}
              </div>
            </div>
          </Section>

          <Section title="Gravação">
            {selected.gravacao ? (
              <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5 text-xs text-slate-200">
                <p className="flex items-center gap-2"><Calendar size={12} className="text-sky-400" /> {selected.gravacao.data} · {selected.gravacao.horario} · {selected.gravacao.estudio}</p>
                {selected.pauta && <p className="mt-1.5 text-[11px] text-slate-400">Pauta: {selected.pauta}</p>}
                {(selected.equipe || []).length > 0 && <p className="mt-1 text-[11px] text-slate-400">Equipe: {selected.equipe.join(', ')}</p>}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">Gravação ainda não marcada — a data é opcional no rascunho, mas obrigatória ao agendar.</p>
            )}
          </Section>

          <BriefingChecklistPanel draft={selected} />
        </div>

        <div className="border-t border-slate-800 px-4 py-3">
          <RascunhoActions
            key={selected.id}
            proj={selected}
            onMarcar={(g) => updateProjeto(selected.id, { etapa: 'gravacao', gravacao: { data: g.data, horario: g.horario, estudio: g.estudio }, pauta: g.pauta, equipe: g.equipe })}
            onRegistrar={() => updateProjeto(selected.id, { gravada: true, grav_status: 'gravada' })}
          />
        </div>
      </div>
    </div>
  );
}