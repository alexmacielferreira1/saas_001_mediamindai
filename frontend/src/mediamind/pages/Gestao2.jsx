import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { History, KeyRound, LayoutDashboard, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../auth';
import { Equipe2, VisaoGeralEquipe2 } from '../components/acessos2/GestaoEquipe2';
import { AcessosTelas2, Historico2, PerfisAcesso2 } from '../components/acessos2/GestaoAcessos2';
import { DataSeal, Notice2, PageHeader2, TabNav2 } from '../components/acessos2/shared';
import { useAcessosData } from '../components/acessos2/useTelas2Data';

export const GESTAO2_TABS = [
  { key: 'visao', label: 'Visão geral', icon: LayoutDashboard },
  { key: 'equipe', label: 'Equipe', icon: Users },
  { key: 'acessos', label: 'Acessos e telas', icon: KeyRound },
  { key: 'perfis', label: 'Acessos por função', icon: ShieldCheck },
  { key: 'historico', label: 'Histórico', icon: History },
];

// Telas 2 · Gestão de equipe e acessos (prévia em paralelo à Administração atual).
export default function Gestao2() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const active = GESTAO2_TABS.some((tab) => tab.key === requested) ? requested : 'visao';
  const [personId, setPersonId] = useState(null);
  const { user } = useAuth();
  const data = useAcessosData();
  const errorList = Object.values(data.errors);

  function openTab(key) {
    setParams(key === 'visao' ? {} : { tab: key }, { replace: true });
  }
  function managePerson(person) {
    setPersonId(person.id);
    openTab('acessos');
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader2 kicker="Administração · Telas 2" title="Gestão" description="Gerencie sua equipe, acessos e acompanhe as atividades no MediaMind." right={<DataSeal state={data.status} />} />
      <TabNav2 label="Navegação da Gestão 2" tabs={GESTAO2_TABS} active={active} onChange={openTab} />
      {errorList.length > 0 && <Notice2 tone="amber">{[...new Set(errorList)].join(' ')}</Notice2>}
      {data.status === 'loading' && !data.people.length ? <p className="text-sm text-slate-400">Carregando dados reais…</p> : null}
      {active === 'visao' && <VisaoGeralEquipe2 people={data.people} audit={data.audit} errors={data.errors} onOpenPerson={managePerson} />}
      {active === 'equipe' && <Equipe2 people={data.people} errors={data.errors} onManage={managePerson} currentUserName={user?.name} />}
      {active === 'acessos' && <AcessosTelas2 people={data.people} errors={data.errors} selectedId={personId} onSelect={setPersonId} currentUserName={user?.name} />}
      {active === 'perfis' && <PerfisAcesso2 people={data.people} groups={data.groups} errors={data.errors} />}
      {active === 'historico' && <Historico2 audit={data.audit} people={data.people} errors={data.errors} />}
    </div>
  );
}
