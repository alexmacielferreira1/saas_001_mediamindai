import React from 'react';
import { Plus, Video, Calendar as CalendarIcon, Send, BarChart3 } from 'lucide-react';
import { MOCK_CORP_PRODUCTIONS } from '../../data';

// Resumo da Visão geral de Produção. Cada stat é clicável e leva à aba da etapa.
export default function CorpHeader({ onNavigate }) {
  const emProducao = MOCK_CORP_PRODUCTIONS.filter((p) => ['em_producao', 'gravado', 'em_edicao'].includes(p.status)).length;
  const agendadas = 5;
  const aguardandoAprovacao = MOCK_CORP_PRODUCTIONS.filter((p) => p.status === 'aguardando_aprovacao').length;
  const publicacoesHoje = 2;

  const stats = [
    { label: 'Em produção', value: emProducao, icon: Video, tone: 'text-sky-300', tab: 'rascunhos' },
    { label: 'Agendadas hoje', value: agendadas, icon: CalendarIcon, tone: 'text-violet-300', tab: 'gravacoes' },
    { label: 'Aguardando aprovação', value: aguardandoAprovacao, icon: Send, tone: 'text-amber-300', tab: 'em_aprovacao' },
    { label: 'Publicações hoje', value: publicacoesHoje, icon: BarChart3, tone: 'text-emerald-300', tab: 'publicacoes' },
  ];

  return (
    <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Olá, Claudia</p>
          <p className="text-xs text-slate-500">Sex, 11 de setembro de 2026</p>
        </div>
        <button onClick={() => onNavigate?.('rascunhos')} className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-sky-400">
          <Plus size={13} /> Nova produção
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.label}
              onClick={() => onNavigate?.(s.tab)}
              className="rounded-lg border border-slate-800 bg-slate-950/50 p-2.5 text-left transition hover:border-sky-600/50 hover:bg-slate-900"
            >
              <div className="flex items-center gap-1.5">
                <Icon size={13} className={s.tone} />
                <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{s.label}</span>
              </div>
              <p className={`mt-1 text-xl font-bold ${s.tone}`}>{s.value}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}