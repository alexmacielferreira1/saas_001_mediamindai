import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Users, CheckCircle, Trash2, Sparkles, Clapperboard } from 'lucide-react';
import { MOCK_CORP_PRESENTERS, MOCK_CORP_PRODUCTIONS } from '../../data';
import { useProducaoProjetos, updateProjeto, addProjeto, moverEtapa } from '../../lib/producaoStore';
import { StageDragArea, DraggableStageCard } from './StageDragList';
import BriefingChecklistPanel from './BriefingChecklistPanel';
import { isProjectInProductionStage } from '../../lib/productionWorkflow';

const STATUS = {
  rascunho: { label: 'Rascunho', tone: 'bg-slate-500/15 text-slate-300' },
  gravacao: { label: 'Gravação agendada', tone: 'bg-sky-500/15 text-sky-300' },
  agendamentos: { label: 'Agendamento', tone: 'bg-sky-500/15 text-sky-300' },
  gravacoes: { label: 'Gravação', tone: 'bg-amber-500/15 text-amber-300' },
  para_editar: { label: 'Para editar', tone: 'bg-violet-500/15 text-violet-300' },
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
  if (isProjectInProductionStage(proj, 'agendamentos')) {
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
  // Cada produção aparece em uma única fila. Ao avançar, ela deixa de ser rascunho.
  const meus = projetos.filter((p) => p.etapa === 'rascunho');
  const [selectedId, setSelectedId] = useState(meus[0]?.id);
  const selected = meus.find((p) => p.id === selectedId) || meus[0];

  // Sinal do botão "Novo" (/corp?novo=producao): cria um rascunho novo.
  useEffect(() => {
    if (newDraftSignal > 0) addDraft();
  }, [newDraftSignal]);

  if (!selected) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 text-sm text-slate-500">
        Nenhum rascunho. Crie um novo projeto pra começar.
        <button onClick={addDraft} className="flex min-h-9 items-center gap-1 rounded-md bg-sky-500 px-3 text-[10px] font-bold text-slate-950 hover:bg-sky-400"><Plus size={11} /> Novo rascunho</button>
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

  const editable = selected.etapa === 'rascunho';
  const st = STATUS[selected.etapa];

  return (
    <div className="grid h-full overflow-hidden border border-slate-800 bg-slate-950/35 lg:grid-cols-[minmax(300px,38%)_1fr]">
      {/* Lista de rascunhos */}
      <div className="flex h-full min-h-0 flex-col border-b border-slate-800 bg-slate-950/20 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between border-b border-slate-800 p-3">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-400">Pré-produção</p><p className="text-sm font-semibold text-slate-100">Rascunhos e pautas</p><p className="text-[10px] text-slate-500">{meus.length} itens no fluxo</p></div>
          <button onClick={addDraft} className="flex min-h-9 items-center gap-1 rounded-md bg-sky-500 px-3 text-[10px] font-bold text-slate-950 hover:bg-sky-400"><Plus size={11} /> Novo rascunho</button>
        </div>
        <StageDragArea onMove={moverEtapa} className="flex-1 min-h-0">
          <div className="h-full overflow-y-auto divide-y divide-slate-800">
            {meus.map((d) => {
              const ds = STATUS[d.etapa];
              return (
                <DraggableStageCard key={d.id} id={d.id} etapa={d.etapa} onClick={() => setSelectedId(d.id)} className={`flex w-full gap-3 border-l-2 px-3 py-2 text-left transition-colors ${selectedId === d.id ? 'border-l-sky-400 bg-sky-950/35' : 'border-l-transparent hover:bg-slate-900/60'}`}>
                  <div className="grid h-12 w-16 shrink-0 place-items-center rounded bg-[radial-gradient(circle_at_50%_35%,#2563eb,#111827_68%)] text-xl">{d.programa?.includes('Mentes') ? '🧠' : d.programa?.includes('Prescrição') ? '🎙️' : '🎬'}</div>
                  <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-slate-200">{d.titulo}</p>
                  <p className="truncate text-[10px] text-slate-500">{d.programa}{d.episodio ? ` · ${d.episodio}` : ''}</p>
                  {ds && <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[8px] font-bold uppercase ${ds.tone}`}>{ds.label}</span>}</div>
                </DraggableStageCard>
              );
            })}
          </div>
        </StageDragArea>
      </div>

      {/* Editor */}
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-900/20">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-sky-400">Rascunho de produção</p>
            <h2 className="text-sm font-semibold text-slate-100">{selected.titulo}</h2>
          </div>
          <span className={`rounded px-2 py-1 text-[10px] font-bold uppercase ${st.tone}`}>{st.label}</span>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          <div className="grid gap-3 xl:grid-cols-[.8fr_1.35fr]">
            <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/30 p-3"><p className="text-[10px] font-bold uppercase text-slate-500">Thumbnail / Capa</p><div className="grid aspect-video place-items-center rounded-lg bg-[radial-gradient(circle_at_50%_38%,#2563eb,#111827_70%)] text-6xl">{selected.programa?.includes('Mentes') ? '🧠' : '🎬'}</div><button className="w-full rounded bg-sky-500 px-3 py-2 text-[10px] font-bold text-slate-950">Alterar thumbnail</button><div className="flex items-center justify-between"><p className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-500"><Users size={11}/>Apresentadores</p>{editable&&<button onClick={loadDefaults} className="text-[9px] text-sky-400"><Sparkles size={10} className="inline"/> Usar padrão</button>}</div><div className="space-y-1.5">{(selected.apresentadores||[]).map((a,i)=><div key={i} className="flex gap-1"><input disabled={!editable} value={a.nome} onChange={(e)=>setPresenter(i,'nome',e.target.value)} placeholder="Nome" className={inputCls(editable)}/><button onClick={()=>removePresenter(i)} className="rounded border border-slate-700 px-2 text-slate-500"><Trash2 size={11}/></button></div>)}{editable&&<button onClick={addPresenter} className="rounded border border-dashed border-slate-700 px-2 py-1.5 text-[9px] text-slate-400"><Plus size={10} className="inline"/> Adicionar apresentador</button>}</div></section>
            <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/30 p-3"><p className="text-[10px] font-bold uppercase text-slate-500">Informações básicas</p><div className="grid gap-2 sm:grid-cols-2"><Field label="Título de trabalho"><input disabled={!editable} value={selected.titulo} onChange={(e)=>field('titulo',e.target.value)} className={inputCls(editable)}/></Field><Field label="Programa"><select disabled={!editable} value={selected.programa} onChange={(e)=>field('programa',e.target.value)} className={inputCls(editable)}>{PROGRAMAS.map((p)=><option key={p}>{p}</option>)}</select></Field><Field label="Episódio"><input disabled={!editable} value={selected.episodio||''} onChange={(e)=>field('episodio',e.target.value)} className={inputCls(editable)}/></Field><Field label="Categoria"><input disabled={!editable} value={selected.categoria||'Saúde e Bem-estar'} onChange={(e)=>field('categoria',e.target.value)} className={inputCls(editable)}/></Field></div><Field label="Descrição"><textarea disabled={!editable} value={selected.descricao||'Discussão sobre saúde mental no ambiente de trabalho, com especialistas, exemplos práticos e orientações para empresas e colaboradores.'} onChange={(e)=>field('descricao',e.target.value)} rows={4} className={inputCls(editable)}/></Field><div className="grid gap-2 sm:grid-cols-2"><Field label="Convidado — nome"><input disabled={!editable} value={selected.convidado_nome} onChange={(e)=>field('convidado_nome',e.target.value)} className={inputCls(editable)}/></Field><Field label="Convidado — cargo"><input disabled={!editable} value={selected.convidado_cg} onChange={(e)=>field('convidado_cg',e.target.value)} className={inputCls(editable)}/></Field></div><div className="flex flex-wrap gap-1">{['saúde mental','trabalho','bem-estar','empresa'].map((tag)=><span key={tag} className="rounded bg-slate-800 px-2 py-1 text-[9px] text-slate-300">{tag} ×</span>)}<button className="rounded border border-dashed border-slate-700 px-2 py-1 text-[9px] text-slate-400">+ Adicionar tag</button></div></section>
          </div>
          <div className="grid gap-3 xl:grid-cols-[1.2fr_.8fr]"><section className="rounded-lg border border-slate-800 bg-slate-950/30 p-3"><p className="mb-2 text-[10px] font-bold uppercase text-slate-500">Resumo / Pauta inicial</p><div className="mb-2 flex gap-3 border-b border-slate-800 pb-2 text-xs text-slate-400"><b>B</b><i>I</i><u>U</u><span>☷</span></div><textarea disabled={!editable} value={selected.pauta||'1. Abertura\n2. Cenário atual da saúde mental no trabalho\n3. Entrevista com especialista\n4. Exemplos de boas práticas\n5. Encerramento'} onChange={(e)=>field('pauta',e.target.value)} rows={6} className="w-full resize-none bg-transparent text-xs leading-6 text-slate-300 outline-none"/></section><BriefingChecklistPanel draft={selected}/></div>

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

        </div>

        <div className="border-t border-slate-800 px-4 py-3">
          <RascunhoActions
            key={selected.id}
            proj={selected}
            onMarcar={(g) => updateProjeto(selected.id, { etapa: 'agendamentos', grav_status: 'agendada', gravacao: { data: g.data, horario: g.horario, estudio: g.estudio }, pauta: g.pauta, equipe: g.equipe })}
            onRegistrar={() => updateProjeto(selected.id, { etapa: 'gravacoes', gravada: true, grav_status: 'gravada' })}
          />
        </div>
      </div>
    </div>
  );
}
