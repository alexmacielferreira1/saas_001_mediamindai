import React from 'react';
import { CheckCircle2, Clock, Gauge, Hourglass } from 'lucide-react';
import { Panel } from '../../ui';
import { useProducaoProjetos } from '../../lib/producaoStore';

const STAGE_LABEL = {
  rascunho: 'Rascunho',
  gravacao: 'Gravação',
  em_edicao: 'Edição',
  em_aprovacao: 'Aprovação',
  finalizado: 'Finalizado',
};
// Etapas cuja duração é medida pelo tempo entre entrada e saída. "finalizado"
// é terminal — não há saída, então não entra na média por etapa.
const DURATION_STAGES = ['rascunho', 'gravacao', 'em_edicao', 'em_aprovacao'];

// Tempo médio gasto em cada etapa, derivado do histórico de transições.
// Cada entrada de histórico registra { etapa, quando } (ISO). A duração de uma
// etapa é o intervalo até a próxima transição do mesmo projeto.
function computeMetrics(projetos) {
  const concluidas = projetos.filter((p) => p.etapa === 'finalizado');

  const totals = {}; // etapa -> ms acumulado
  const counts = {}; // etapa -> nº medições
  DURATION_STAGES.forEach((s) => { totals[s] = 0; counts[s] = 0; });

  let totalCycleMs = 0;
  let cycleCount = 0;

  projetos.forEach((p) => {
    const hist = (p.historico || []).slice().sort((a, b) => (a.quando || '').localeCompare(b.quando || ''));
    for (let i = 0; i < hist.length - 1; i++) {
      const cur = hist[i];
      const nxt = hist[i + 1];
      const stage = cur.etapa;
      if (!DURATION_STAGES.includes(stage)) continue;
      const t0 = Date.parse(cur.quando);
      const t1 = Date.parse(nxt.quando);
      if (!Number.isNaN(t0) && !Number.isNaN(t1) && t1 >= t0) {
        const delta = t1 - t0;
        totals[stage] += delta;
        counts[stage] += 1;
        if (stage === 'rascunho' && nxt.etapa === 'finalizado') {
          totalCycleMs += delta;
          cycleCount += 1;
        }
      }
    }
  });

  // Ciclo total = da primeira à última transição de projetos finalizados,
  // quando há histórico suficiente; senão, soma das médias por etapa.
  const stageAvgs = DURATION_STAGES.map((s) => ({
    etapa: s,
    label: STAGE_LABEL[s],
    avgMs: counts[s] > 0 ? totals[s] / counts[s] : 0,
    amostras: counts[s],
  }));

  const sumStageMs = stageAvgs.reduce((acc, s) => acc + s.avgMs, 0);
  const cycleMs = cycleCount > 0 ? totalCycleMs / cycleCount : sumStageMs;

  return { concluidas: concluidas.length, total: projetos.length, stageAvgs, cycleMs };
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return '—';
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m ? `${h}h ${m}min` : `${h}h`;
  const d = Math.floor(h / 24);
  const hh = h % 24;
  return hh ? `${d}d ${hh}h` : `${d}d`;
}

export default function IndicadoresPipelinePanel() {
  const projetos = useProducaoProjetos();
  const { concluidas, total, stageAvgs, cycleMs } = computeMetrics(projetos);
  const maxAvg = Math.max(...stageAvgs.map((s) => s.avgMs), 1);

  return (
    <Panel title="Indicadores do pipeline" right={<Gauge size={16} className="text-slate-500" />}>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <CheckCircle2 size={12} /> Concluídas
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-300">{concluidas}</p>
          <p className="text-[10px] text-slate-500">de {total} produções</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <Hourglass size={12} /> Ciclo médio
          </p>
          <p className="mt-1 text-2xl font-bold text-sky-300">{formatDuration(cycleMs)}</p>
          <p className="text-[10px] text-slate-500">rascunho → finalizado</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <Gauge size={12} /> Taxa conclusão
          </p>
          <p className="mt-1 text-2xl font-bold text-violet-300">
            {total > 0 ? Math.round((concluidas / total) * 100) : 0}%
          </p>
          <p className="text-[10px] text-slate-500">do volume total</p>
        </div>
      </div>

      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Tempo médio por etapa</p>
      <div className="space-y-2">
        {stageAvgs.map((s) => (
          <div key={s.etapa} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-xs font-medium text-slate-300">{s.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-sky-400/80"
                style={{ width: `${Math.min(100, (s.avgMs / maxAvg) * 100)}%` }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-xs font-semibold text-slate-200">
              {formatDuration(s.avgMs)}
            </span>
            <span className="w-14 shrink-0 text-right text-[10px] text-slate-500">
              {s.amostras} amostra{s.amostras === 1 ? '' : 's'}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-500">
        <Clock size={11} /> Calculado a partir do histórico de transições dos projetos.
      </p>
    </Panel>
  );
}