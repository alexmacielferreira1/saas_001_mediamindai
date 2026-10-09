import React from 'react';
import { Clapperboard, Calendar, Clock, MapPin, User, Mic, Activity, Sparkles } from 'lucide-react';
import { useProducaoProjetos } from '../../../lib/producaoStore';
import { AgendaUnificadaPanel } from '../OverviewPanels';
import CorpFeatureStrip from '../CorpFeatureStrip';
import PanelSplit from '../../ui/PanelSplit';

function statCards(recs) {
  return [
    { label: 'Gravações agendadas', value: recs.filter((r) => r.status !== 'gravada').length, Icon: Clapperboard, tone: 'text-amber-300' },
    { label: 'Estúdios em uso', value: new Set(recs.map((r) => r.estudio)).size, Icon: MapPin, tone: 'text-sky-300' },
    { label: 'Convidados confirmados', value: recs.filter((r) => r.convidado && r.status === 'confirmada').length, Icon: User, tone: 'text-emerald-300' },
    { label: 'Gravações concluídas', value: recs.filter((r) => r.status === 'gravada').length, Icon: Mic, tone: 'text-violet-300' },
  ];
}

// Visão geral do Videomaker — gravação de conteúdo audiovisual (agendamento, set, captação).
// Mesmo padrão de painéis redimensionáveis da Produção: barra de controle de layout
// (importar/exportar/salvar/redefinir) no topo + divisórias arrastáveis.
export default function VideomakerOverview() {
  const projetos = useProducaoProjetos();
  const recs = projetos
    .filter((p) => p.gravacao)
    .map((p) => ({
      id: p.id,
      programa: p.programa,
      episodio: p.episodio,
      titulo: p.titulo,
      data: p.gravacao.data,
      horario: p.gravacao.horario,
      estudio: p.gravacao.estudio,
      convidado: p.convidado_nome,
      status: p.gravada ? 'gravada' : (p.videomaker_confirmado ? 'confirmada' : 'planejada'),
    }));
  const stats = statCards(recs);
  const upcoming = recs.filter((r) => r.status !== 'gravada');

  return (
    <div className="flex h-full flex-col gap-3">
      <div>
        <h2 className="text-lg font-bold text-slate-50">Videomaker</h2>
        <p className="text-sm text-slate-400">Gravação de conteúdo audiovisual — agendamento, set e captação.</p>
      </div>

      <div className="min-h-0 flex-1">
        <PanelSplit
          storageKey="corp_videomaker_overview"
          direction="vertical"
          panels={[
            {
              id: 'indicadores',
              label: 'Indicadores',
              icon: Activity,
              defaultSize: 26,
              content: (
                <div className="h-full overflow-y-auto">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {stats.map((c) => {
                      const Icon = c.Icon;
                      return (
                        <div key={c.label} className="rounded-lg bg-slate-950/50 px-3 py-2.5">
                          <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500">
                            <Icon size={12} className={c.tone} /> {c.label}
                          </div>
                          <p className="text-xl font-bold text-slate-100">{c.value}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ),
            },
            {
              id: 'gravacoes',
              label: 'Próximas gravações',
              icon: Clapperboard,
              defaultSize: 30,
              content: (
                <div className="h-full overflow-y-auto">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Calendar size={14} className="text-sky-400" />
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Próximas gravações</p>
                    </div>
                    <div className="space-y-2">
                      {upcoming.map((r) => (
                        <div key={r.id} className="flex items-center gap-3 rounded-md bg-slate-950/50 px-3 py-2">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${r.status === 'confirmada' ? 'bg-amber-500' : 'bg-slate-500'}`} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-slate-200">{r.episodio} — {r.titulo}</p>
                            <p className="truncate text-[10px] text-slate-500">{r.programa} · {r.convidado}</p>
                          </div>
                          <div className="shrink-0 text-right text-[10px] text-slate-500">
                            <p className="flex items-center justify-end gap-1"><Calendar size={10} /> {r.data}</p>
                            <p className="flex items-center justify-end gap-1"><Clock size={10} /> {r.horario} · {r.estudio}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ),
            },
            {
              id: 'agenda',
              label: 'Agenda unificada',
              icon: Calendar,
              defaultSize: 28,
              content: <div className="h-full overflow-y-auto"><AgendaUnificadaPanel /></div>,
            },
            {
              id: 'destaques',
              label: 'Destaques',
              icon: Sparkles,
              defaultSize: 12,
              content: <div className="h-full overflow-y-auto"><CorpFeatureStrip /></div>,
            },
          ]}
        />
      </div>
    </div>
  );
}