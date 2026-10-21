import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, KeyRound, LayoutDashboard, RefreshCw } from 'lucide-react';
import { useAuth } from '../auth';
import { IAConsumo2, IAProvedores2, IAVisaoGeral2 } from '../components/acessos2/IA2';
import { AIConfigLink, DataSeal, Notice2, PageHeader2, TabNav2 } from '../components/acessos2/shared';
import { useAIUsageReport } from '../components/acessos2/useTelas2Data';

export const IA2_TABS = [
  { key: 'visao', label: 'Visão geral', icon: LayoutDashboard },
  { key: 'provedores', label: 'Provedores e chaves', icon: KeyRound },
  { key: 'consumo', label: 'Consumo', icon: BarChart3 },
];

const PERIODS = [[1, 'Último dia'], [7, '7 dias'], [30, '30 dias'], [31, '31 dias']];

function ReportView({ active, days }) {
  const usage = useAIUsageReport(days);
  return (
    <>
      <div className="flex justify-end"><button type="button" onClick={usage.reload} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-sky-600"><RefreshCw size={14} aria-hidden="true" />Atualizar</button></div>
      <div className="flex justify-end"><DataSeal state={usage.status} /></div>
      {active === 'visao' && <IAVisaoGeral2 {...usage} />}
      {active === 'provedores' && <IAProvedores2 {...usage} />}
      {active === 'consumo' && <IAConsumo2 {...usage} />}
    </>
  );
}

// Telas 2 · APIs e IA (somente leitura; configuração em /configuracoes/ia).
export default function APIsIA2() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const active = IA2_TABS.some((tab) => tab.key === requested) ? requested : 'visao';
  const [days, setDays] = useState(30);
  const { user } = useAuth();
  const allowed = ['admin', 'superadmin'].includes(String(user?.role || '').toLowerCase());
  return (
    <div className="space-y-5 pb-8">
      <PageHeader2
        breadcrumb={['Acervo', 'Sistema', 'Monitoramento', 'APIs e IA']}
        title="APIs e IA"
        description="Provedores, consumo e custos estimados das integrações de IA."
        right={<label className="text-xs text-slate-400">Período<select aria-label="Período" value={days} onChange={(event) => setDays(Number(event.target.value))} className="ml-2 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-200">{PERIODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
      />
      <TabNav2 label="Navegação de APIs e IA" tabs={IA2_TABS} active={active} onChange={(key) => setParams(key === 'visao' ? {} : { tab: key }, { replace: true })} />
      <Notice2>Somente leitura. Para cadastrar provedores, chaves, limites e preços: <AIConfigLink /></Notice2>
      {allowed ? <ReportView active={active} days={days} /> : <Notice2 tone="amber">Acesso restrito a administradores. A permissão também é validada no servidor.</Notice2>}
    </div>
  );
}
