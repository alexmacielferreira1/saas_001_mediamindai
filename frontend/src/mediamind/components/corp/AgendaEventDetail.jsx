import React, { useState, useEffect } from 'react';
import { useWorkDraftState, useWorkDraftExists } from '../../lib/workProtection';
import { X, ArrowRight, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import { MOCK_CORP_PRODUCTIONS } from '../../data';

const TYPE_LABEL = { gravacao: 'Gravação', aprovacao: 'Aprovação', publicacao: 'Publicação', edicao: 'Edição' };
const TYPE_TAB = { gravacao: 'gravacoes', aprovacao: 'em_aprovacao', publicacao: 'publicacoes', edicao: 'em_edicao' };
const TIPOS = [
  { value: 'gravacao', label: 'Gravação' },
  { value: 'aprovacao', label: 'Aprovação' },
  { value: 'publicacao', label: 'Publicação' },
  { value: 'edicao', label: 'Edição' },
];
const STATUS_OPTS = [
  { value: '', label: '—' },
  { value: 'planejada', label: 'Planejada' },
  { value: 'confirmada', label: 'Confirmada' },
  { value: 'gravada', label: 'Gravada' },
  { value: 'em_edicao', label: 'Em edição' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'publicado', label: 'Publicado' },
];
const PROGRAMAS = Array.from(new Set(MOCK_CORP_PRODUCTIONS.map((p) => p.programa)));

const inputCls = 'w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500 disabled:opacity-60 disabled:cursor-not-allowed';
const taCls = `${inputCls} resize-none`;

function toDate(day) {
  if (!day) return '';
  return `2026-07-${String(day).padStart(2, '0')}`;
}
function dayFromDate(data) {
  if (!data) return 15;
  return Number(data.split('-')[2]) || 15;
}
function fieldsOf(e) {
  return {
    titulo: e.titulo || '',
    programa: e.programa || '',
    episodio: e.episodio || '',
    tipo: e.type || 'gravacao',
    data: toDate(e.day),
    horario: e.horario || '',
    duracao_prevista: e.duracao_prevista || '',
    estudio: e.estudio || '',
    convidado: e.convidado || '',
    convidado_cg: e.convidado_cg || '',
    equipe: e.equipe || '',
    equipamentos: e.equipamentos || '',
    status: e.status || '',
    pauta: e.pauta || '',
    descricao: e.descricao || '',
  };
}
const FIELD_KEYS = Object.keys(fieldsOf({}));

// Detalhe do evento — todos os campos possíveis (preenchidos ou não), pra
// poder adicionar mais. Edits vão pro Rascunho; Salvar commita. ‹ Atual | Rascunho ›.
export default function AgendaEventDetail({ event, onClose, onNavigate, onUpdate }) {
  const [mode, setMode] = useState('rascunho');
  const hasRecoveredDraft = useWorkDraftExists(`agenda:${event.id}:draft`);
  const [draft, setDraft] = useWorkDraftState(`agenda:${event.id}:draft`, () => fieldsOf(event));

  useEffect(() => {
    if (!hasRecoveredDraft) setDraft(fieldsOf(event));
    setMode('rascunho');
  }, [event.id]);

  const atual = fieldsOf(event);
  const dirty = FIELD_KEYS.some((k) => draft[k] !== atual[k]);
  const view = mode === 'rascunho' ? draft : atual;
  const editable = mode === 'rascunho';

  function setField(name, value) {
    setDraft((d) => ({ ...d, [name]: value }));
  }

  function salvar() {
    onUpdate?.({
      titulo: draft.titulo,
      programa: draft.programa,
      episodio: draft.episodio,
      type: draft.tipo,
      day: dayFromDate(draft.data),
      horario: draft.horario,
      duracao_prevista: draft.duracao_prevista,
      estudio: draft.estudio,
      convidado: draft.convidado,
      convidado_cg: draft.convidado_cg,
      equipe: draft.equipe,
      equipamentos: draft.equipamentos,
      status: draft.status,
      pauta: draft.pauta,
      descricao: draft.descricao,
    });
    setMode('atual');
  }

  if (!event) return null;

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-sky-400">Dia {event.day} · {TYPE_LABEL[event.type]}</p>
          <input disabled={!editable} value={view.titulo} onChange={(e) => setField('titulo', e.target.value)} className={`${inputCls} mt-1 font-semibold`} />
        </div>
        <button onClick={onClose} className="shrink-0 rounded-md border border-slate-700 px-2 py-1 text-slate-400 hover:bg-slate-800" title="Fechar"><X size={12} /></button>
      </div>

      {/* ‹ Atual | Rascunho ›  + Salvar à direita na mesma linha */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-md border border-slate-700 p-0.5 text-[10px]">
          <button onClick={() => setMode('atual')} className={`flex items-center gap-0.5 rounded px-2 py-1 font-semibold transition ${mode === 'atual' ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800'}`}>
            <ChevronLeft size={11} /> Atual
          </button>
          <button onClick={() => setMode('rascunho')} className={`flex items-center gap-0.5 rounded px-2 py-1 font-semibold transition ${mode === 'rascunho' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800'}`}>
            Rascunho <ChevronRight size={11} />
          </button>
          {mode === 'rascunho' && (
            <span className={`ml-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${dirty ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-700/50 text-slate-400'}`}>
              {dirty ? 'não salvo' : 'sem alterações'}
            </span>
          )}
        </div>
        {editable && (
          <button
            onClick={salvar}
            disabled={!dirty}
            className="flex items-center gap-1.5 rounded-md bg-sky-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={12} /> Salvar
          </button>
        )}
      </div>

      <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
        <div>
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">Identificação</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="block col-span-2">
              <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Título</span>
              <input disabled={!editable} value={view.titulo} onChange={(e) => setField('titulo', e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Programa</span>
              <select disabled={!editable} value={view.programa} onChange={(e) => setField('programa', e.target.value)} className={inputCls}>
                <option value="">—</option>
                {PROGRAMAS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Episódio</span>
              <input disabled={!editable} value={view.episodio} onChange={(e) => setField('episodio', e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Tipo</span>
              <select disabled={!editable} value={view.tipo} onChange={(e) => setField('tipo', e.target.value)} className={inputCls}>
                {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Status</span>
              <select disabled={!editable} value={view.status} onChange={(e) => setField('status', e.target.value)} className={inputCls}>
                {STATUS_OPTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">Agenda</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Data</span>
              <input type="date" disabled={!editable} value={view.data} onChange={(e) => setField('data', e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Horário</span>
              <input type="time" disabled={!editable} value={view.horario} onChange={(e) => setField('horario', e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Duração prevista</span>
              <input disabled={!editable} value={view.duracao_prevista} onChange={(e) => setField('duracao_prevista', e.target.value)} placeholder="60 min" className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Estúdio</span>
              <input disabled={!editable} value={view.estudio} onChange={(e) => setField('estudio', e.target.value)} className={inputCls} />
            </label>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">Pessoas</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Convidado — nome</span>
              <input disabled={!editable} value={view.convidado} onChange={(e) => setField('convidado', e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Convidado — CG</span>
              <input disabled={!editable} value={view.convidado_cg} onChange={(e) => setField('convidado_cg', e.target.value)} placeholder="Cargo / CRM" className={inputCls} />
            </label>
            <label className="block col-span-2">
              <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Equipe (vírgulas)</span>
              <input disabled={!editable} value={view.equipe} onChange={(e) => setField('equipe', e.target.value)} placeholder="Bianca, Rafael, Ana" className={inputCls} />
            </label>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">Produção</p>
          <label className="block">
            <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Equipamentos</span>
            <input disabled={!editable} value={view.equipamentos} onChange={(e) => setField('equipamentos', e.target.value)} placeholder="2 câmeras, mesa de áudio, teleprompter" className={inputCls} />
          </label>
        </div>

        <div>
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">Conteúdo</p>
          <div className="space-y-2">
            <label className="block">
              <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Pauta</span>
              <textarea disabled={!editable} value={view.pauta} onChange={(e) => setField('pauta', e.target.value)} rows={2} className={taCls} />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Descrição</span>
              <textarea disabled={!editable} value={view.descricao} onChange={(e) => setField('descricao', e.target.value)} rows={3} className={taCls} />
            </label>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-slate-800 pt-3">
        <button
          onClick={() => onNavigate?.(TYPE_TAB[event.type])}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-700 px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-slate-800"
        >
          Ir para {TYPE_LABEL[event.type]} <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}
