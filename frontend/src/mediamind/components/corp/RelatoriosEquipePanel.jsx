import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { Panel } from '../shared';
import {
  MOCK_CORP_PRODUCTIONS, MOCK_CORP_EDITS, MOCK_CORP_RELEASES,
  MOCK_CORP_DESIGNS, MOCK_CORP_ARTICLES, MOCK_CORP_CAMPAIGNS,
} from '../../data';

// Relatórios — volume de produção por equipe, consolidando os dados dos
// diferentes perfis/usuários do Corp. Cada barra empilha o que está em
// andamento vs. concluído, dando a carga atual de cada time num só olhar.
function buildEquipes() {
  const mk = (name, list, isDone) => {
    let em_andamento = 0, concluido = 0;
    list.forEach((x) => { if (isDone(x)) concluido++; else em_andamento++; });
    return { name, em_andamento, concluido, total: em_andamento + concluido };
  };
  return [
    mk('Produção', MOCK_CORP_PRODUCTIONS, (x) => ['publicado', 'aprovado'].includes(x.status)),
    mk('Edição', MOCK_CORP_EDITS, (x) => ['Concluído', 'Entregue', 'Render final'].includes(x.status)),
    mk('Assessoria', MOCK_CORP_RELEASES, (x) => x.status === 'publicado'),
    mk('Design', MOCK_CORP_DESIGNS, (x) => x.status === 'entregue'),
    mk('Redação', MOCK_CORP_ARTICLES, (x) => x.status === 'publicado'),
    mk('Endomarketing', MOCK_CORP_CAMPAIGNS, (x) => ['concluida', 'encerrada'].includes(x.status)),
  ];
}

const tooltipStyle = { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 };

export default function RelatoriosEquipePanel() {
  const equipes = buildEquipes();
  const total = equipes.reduce((s, e) => s + e.total, 0);
  const totalAndamento = equipes.reduce((s, e) => s + e.em_andamento, 0);
  const totalConcluido = equipes.reduce((s, e) => s + e.concluido, 0);

  return (
    <Panel title="Volume de produção por equipe" action={<BarChart3 size={14} className="text-sky-400" />}>
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-slate-950/50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Total</p>
          <p className="text-lg font-bold text-slate-100">{total}</p>
        </div>
        <div className="rounded-lg bg-slate-950/50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Em andamento</p>
          <p className="text-lg font-bold text-sky-300">{totalAndamento}</p>
        </div>
        <div className="rounded-lg bg-slate-950/50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Concluído</p>
          <p className="text-lg font-bold text-emerald-300">{totalConcluido}</p>
        </div>
      </div>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={equipes} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} interval={0} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
            <Tooltip cursor={{ fill: '#1e293b55' }} contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="em_andamento" name="Em andamento" stackId="v" fill="#38bdf8" radius={[4, 4, 0, 0]} />
            <Bar dataKey="concluido" name="Concluído" stackId="v" fill="#34d399" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}