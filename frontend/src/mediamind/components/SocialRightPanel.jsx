import React from 'react';
import { Scissors, ArrowRight, Film, Clock, CheckCircle2, Send, Gauge } from 'lucide-react';
import { MOCK_CLIPS } from '../data';

const METRICS = [
  { key: 'fluxo', label: 'Cortes no fluxo', icon: Clock, tone: 'text-violet-300', bg: 'bg-violet-500/10', border: 'border-violet-700/30' },
  { key: 'revisar', label: 'Prontos para revisar', icon: CheckCircle2, tone: 'text-sky-300', bg: 'bg-sky-500/10', border: 'border-sky-700/30' },
  { key: 'aprovacao', label: 'Em aprovação/publicação', icon: Send, tone: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-700/30' },
  { key: 'potencial', label: 'Potencial médio', icon: Gauge, tone: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-700/30' },
];

export function SocialMetrics() {
  const counts = {
    fluxo: MOCK_CLIPS.length,
    revisar: MOCK_CLIPS.filter((c) => c.status === 'ready').length,
    aprovacao: MOCK_CLIPS.filter((c) => c.status === 'sent_to_publish').length,
    potencial: '0/100',
  };
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {METRICS.map((m) => {
        const Icon = m.icon;
        return (
          <div key={m.key} className={`rounded-xl border ${m.border} ${m.bg} px-4 py-3`}>
            <div className="mb-2 flex items-center gap-2">
              <Icon size={15} className={m.tone} />
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{m.label}</span>
            </div>
            <p className={`text-2xl font-bold ${m.tone}`}>{counts[m.key]}</p>
          </div>
        );
      })}
    </div>
  );
}

export default function SocialRightPanel({ selectedClip }) {
  const clip = selectedClip
    ? MOCK_CLIPS.find((c) => c.id === selectedClip)
    : null;

  return (
    <div className="flex h-full w-72 shrink-0 flex-col rounded-xl border border-slate-800 bg-slate-900/40">
      <div className="border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Scissors size={15} className="text-sky-400" />
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Preparo do corte</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!clip ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-800">
              <Film size={24} className="text-slate-600" />
            </div>
            <p className="text-sm font-medium text-slate-300">Selecione ou crie um corte</p>
            <p className="text-xs text-slate-500">para iniciar o preparo.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <p className="mb-1 text-[10px] uppercase text-slate-500">Corte selecionado</p>
              <p className="text-sm font-semibold text-slate-200">{clip.title}</p>
              <p className="mt-1 text-xs text-slate-500">{clip.program_name} · {clip.editor}</p>
            </div>
            <button className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-sky-500 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-sky-400">
              Editar corte <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="border-t border-slate-800 p-4">
        <div className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-3">
          <p className="mb-2 text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Próxima etapa:</span> Os cortes enviados aparecem na fila real de aprovação.
          </p>
          <button className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-sky-500 py-2 text-xs font-bold text-slate-950 transition hover:bg-sky-400">
            Abrir fila de publicação <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}