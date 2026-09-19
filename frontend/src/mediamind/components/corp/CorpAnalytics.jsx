import React from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { MOCK_CORP_ANALYTICS } from '../../data';

export default function CorpAnalytics() {
  const a = MOCK_CORP_ANALYTICS;
  const chartData = a.serie_visualizacoes.map((v, i) => ({ x: i, v }));

  const stats = [
    { label: 'Visualizações', value: a.visualizacoes, delta: '+18.7%' },
    { label: 'Watch Time', value: a.watch_time, delta: '+22.4%' },
    { label: 'Inscritos', value: a.inscritos, delta: '+15.2%' },
    { label: 'Comentários', value: a.comentarios.toLocaleString('pt-BR'), delta: '+12.1%' },
  ];

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Analytics & Relatórios</p>

      <div className="mb-3 grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-800 bg-slate-950/40 px-2.5 py-2">
            <p className="text-[9px] uppercase text-slate-500">{s.label}</p>
            <p className="text-sm font-bold text-slate-100">{s.value}</p>
            <p className="flex items-center gap-0.5 text-[9px] font-medium text-emerald-400">
              <TrendingUp size={9} /> {s.delta}
            </p>
          </div>
        ))}
      </div>

      <div className="h-16 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <Line type="monotone" dataKey="v" stroke="#38bdf8" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex-1 overflow-y-auto">
        <p className="mb-1.5 text-[9px] font-semibold uppercase text-slate-500">Top Programas</p>
        <div className="space-y-1.5">
          {a.top_programas.map((p) => (
            <div key={p.name} className="flex items-center gap-2">
              <span className="w-24 shrink-0 truncate text-[10px] text-slate-400">{p.name}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-sky-500" style={{ width: `${p.value}%` }} />
              </div>
              <span className="w-8 shrink-0 text-right text-[10px] font-mono text-slate-500">{p.value}K</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}