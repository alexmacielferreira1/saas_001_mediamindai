import React, { useState } from 'react';
import { LayoutDashboard, GraduationCap, ListChecks, Users, BookOpen } from 'lucide-react';
import RolePageShell from './RolePageShell';
import CorpPanel from '../CorpPanel';
import { StatCard, StatusBadge } from './RoleShared';
import { MOCK_CORP_PENDENCIES } from '../../../data';

const TONE = {
  pendente: 'bg-amber-500/15 text-amber-300',
  em_andamento: 'bg-sky-500/15 text-sky-300',
  concluido: 'bg-emerald-500/15 text-emerald-300',
};
const LABEL = { pendente: 'Pendente', em_andamento: 'Em andamento', concluido: 'Concluído' };

const AREAS = ['producao', 'redacao', 'design', 'assessoria', 'audiovisual', 'revistas', 'endomarketing'];
const AREA_LABEL = {
  producao: 'Produção', redacao: 'Redação', design: 'Design', assessoria: 'Assessoria',
  audiovisual: 'Audiovisual', revistas: 'Revistas', endomarketing: 'Endomarketing',
};

const GUIAS = [
  { id: 1, titulo: 'Como indexar uma mídia', area: 'audiovisual', duracao: '8 min' },
  { id: 2, titulo: 'Padrões de pauta', area: 'redacao', duracao: '12 min' },
  { id: 3, titulo: 'Briefing de gravação', area: 'producao', duracao: '10 min' },
  { id: 4, titulo: 'Versionamento de arte', area: 'design', duracao: '6 min' },
];

export default function EstagiarioPage() {
  const [sub, setSub] = useState('overview');
  const [area, setArea] = useState('producao');
  const ownTabs = [{ id: 'overview', name: 'Visão geral', Icon: LayoutDashboard }];

  const tarefas = MOCK_CORP_PENDENCIES[area] || [];
  const guiasArea = GUIAS.filter((g) => g.area === area);

  return (
    <RolePageShell roleId="estagiario" ownSubtabs={ownTabs} active={sub} onChange={setSub}>
      <div className="flex h-full flex-col gap-4 overflow-y-auto">
        {/* Seletor de área — estagiário multi-área */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-2.5">
          <span className="px-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Área:</span>
          {AREAS.map((a) => (
            <button
              key={a}
              onClick={() => setArea(a)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                area === a ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              {AREA_LABEL[a]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Tarefas na área" value={tarefas.length} tone="text-sky-300" />
          <StatCard label="Pendentes" value={tarefas.filter((t) => t.status === 'pendente').length} tone="text-amber-300" />
          <StatCard label="Concluídas" value={tarefas.filter((t) => t.status === 'concluido').length} tone="text-emerald-300" />
          <StatCard label="Guias disponíveis" value={guiasArea.length} tone="text-violet-300" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <CorpPanel title="Minhas tarefas" className="min-h-0">
            <div className="space-y-2">
              {tarefas.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{t.titulo}</p>
                    <p className="text-[11px] text-slate-500">{t.contexto}</p>
                  </div>
                  <StatusBadge status={t.status} map={TONE} labels={LABEL} />
                </div>
              ))}
              {tarefas.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Sem tarefas nesta área.</p>}
            </div>
          </CorpPanel>

          <CorpPanel title="Mentoria & guias" className="min-h-0">
            <div className="space-y-2">
              {guiasArea.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Nenhum guia nesta área ainda.</p>}
              {guiasArea.map((g) => (
                <div key={g.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <BookOpen size={14} className="text-violet-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-200">{g.titulo}</p>
                      <p className="text-[11px] text-slate-500">{g.duracao}</p>
                    </div>
                  </div>
                  <button type="button" disabled title="Ainda não disponível" className="rounded-md bg-sky-500 px-2.5 py-1 text-[10px] font-bold text-slate-950 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60">Estudar</button>
                </div>
              ))}
            </div>
          </CorpPanel>
        </div>
      </div>
    </RolePageShell>
  );
}