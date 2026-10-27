import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';
import { listAdminActivity, listAdminUsers } from '../../api/admin';
import { ApiError } from '../../api/httpClient';
import { listPermissionGroups } from '../../api/permissions';
import { accessErrorMessage } from '../lib/accessErrors';
import AdminAcessosPage from '../components/corp/roles/AdminAcessosPage';
import Imports2 from '../components/admin2/Imports2';
import { Permissions2, Profiles2, Teams2 } from '../components/admin2/AccessStructure2';
import { Forms2 } from '../components/admin2/UsersForms2';
import Security2 from '../components/admin2/Security2';
import { AdminTabs, EmbeddedArea, PreviewNotice } from '../components/admin2/ui/AdminBlocks';
import { readLocalDemoSession } from '../lib/demoAccess';
import { getDemoPermissionGroups, getDemoUsers } from '../lib/demoCatalog';
import Acervo from './Acervo';
import Management from './Management';
import OverviewTab from './admin2/OverviewTab';
import UsersTab from './admin2/UsersTab';
import { IntegrationsTab, RecordsTab, RegistryTab } from './admin2/CatalogTabs';
import SettingsTab from './admin2/SettingsTab';
import { ALL_TABS, DEMO_DATA_TABS } from './admin2/tabs';
import { Badge, Loading } from '../ui';

function getAdminDemoPayload() {
  const items = getDemoUsers();
  return { items, total: items.length, page: 1, page_size: 25 };
}

const EMPTY_PAYLOAD = { items: [], total: 0, page: 1, page_size: 25 };

function dataSealLabel({ localDemo, fallbackKind, error }) {
  if (localDemo) return 'Modo local funcional · demonstração explícita';
  if (fallbackKind === 'unavailable') return 'Dados reais indisponíveis';
  if (fallbackKind === 'forbidden') return 'Acesso restrito';
  if (error) return 'Sessão real indisponível';
  return 'Dados reais do tenant selecionado';
}

export default function Administration2() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const initialTab = ALL_TABS.some((tab) => tab.key === requestedTab) ? requestedTab : 'overview';
  const [active, setActive] = useState(initialTab);
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');
  const [fallbackKind, setFallbackKind] = useState('');
  const [groups, setGroups] = useState([]);
  const [activity, setActivity] = useState([]);
  const [activityAvailable, setActivityAvailable] = useState(true);
  const [groupsAvailable, setGroupsAvailable] = useState(true);
  const [localDemo] = useState(() => Boolean(readLocalDemoSession()));

  function fail(nextPayload, kind, message) {
    setPayload(nextPayload);
    setGroups([]);
    setActivity([]);
    setFallbackKind(kind);
    setError(message);
  }

  async function load(filters = {}) {
    setError('');
    setFallbackKind('');
    if (localDemo) {
      setPayload(getAdminDemoPayload());
      setGroups(getDemoPermissionGroups());
      setActivity([]);
      setFallbackKind('local-demo');
      return;
    }
    try {
      const [users, permissionGroups, events] = await Promise.all([
        listAdminUsers({ page: 1, pageSize: 100, search: '', status: '', ...filters }),
        listPermissionGroups().catch(() => null),
        listAdminActivity().catch(() => null),
      ]);
      setPayload(users); setGroups(permissionGroups || []); setActivity(events || []);
      setGroupsAvailable(permissionGroups !== null);
      setActivityAvailable(events !== null);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        fail(null, 'authentication', 'Sua sessão expirou. Redirecionando para entrar novamente.');
      } else if (reason instanceof ApiError && reason.status === 403) {
        fail(EMPTY_PAYLOAD, 'forbidden', accessErrorMessage(reason, 'Sem permissão para consultar os dados administrativos deste tenant.'));
      } else {
        fail(EMPTY_PAYLOAD, 'unavailable', 'Dados administrativos indisponíveis. Nenhum dado de demonstração foi usado.');
      }
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (ALL_TABS.some((tab) => tab.key === requestedTab)) setActive(requestedTab);
  }, [requestedTab]);

  // Filtros extras (ex.: { status: 'blocked' }) vão para a URL e são lidos pela guia aberta.
  function openTab(key, filters = {}) {
    setActive(key);
    setSearchParams(key === 'overview' ? {} : { tab: key, ...filters }, { replace: true });
  }

  const users = payload?.items || [];
  return (
    <div className="space-y-5 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-sky-800/70 bg-sky-950/60 text-sky-300 shadow-[0_0_24px_rgba(14,165,233,0.12)]">
            <SlidersHorizontal size={21} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-50">Administração</h1>
              <Badge tone="success">Área validada</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Controle central de usuários, acessos, formulários e segurança.{' '}
              <Link to="/telas2" className="ml-1 text-xs text-sky-400 hover:text-sky-300 hover:underline">Telas 2 (prévia)</Link>
            </p>
          </div>
        </div>
        {!DEMO_DATA_TABS.has(active) && (
          <div data-testid="admin-data-seal" className="rounded-xl border border-emerald-800/60 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
            {dataSealLabel({ localDemo, fallbackKind, error })}
          </div>
        )}
      </header>

      <AdminTabs label="Navegação principal da Administração" tabs={ALL_TABS} active={active} onChange={openTab} />
      <div className="contents">
        {error && (
          <div
            role={fallbackKind === 'unavailable' ? 'alert' : 'status'}
            className={`rounded-xl border p-3 text-sm ${fallbackKind === 'unavailable' ? 'border-rose-800 bg-rose-950/30 text-rose-300' : 'border-amber-800 bg-amber-950/20 text-amber-300'}`}
          >
            {error}
          </div>
        )}
        {!payload && !error ? <Loading label="Carregando Administração..." /> : null}
      </div>
      {payload && active === 'overview' && (
        <OverviewTab
          payload={payload}
          groups={groups}
          groupsAvailable={groupsAvailable}
          activity={activity}
          activityAvailable={activityAvailable}
          onOpenTab={openTab}
          fallbackKind={fallbackKind}
        />
      )}
      {active === 'users' && (
        <UsersTab initialPayload={payload} onReload={load} fallbackKind={fallbackKind} initialStatus={searchParams.get('status') || ''} />
      )}
      {active === 'archive' && <EmbeddedArea title="Acervo"><Acervo embedded localDemo={localDemo} /></EmbeddedArea>}
      {active === 'management' && <EmbeddedArea title="Gestão"><Management embedded localDemo={localDemo} /></EmbeddedArea>}
      {active === 'access' && <AdminAcessosPage administration2 localDemo={localDemo} />}
      {active === 'profiles' && <Profiles2 groups={groups} users={users} available={groupsAvailable} />}
      {active === 'permissions' && <Permissions2 groups={groups} available={groupsAvailable} />}
      {active === 'teams' && <><PreviewNotice /><Teams2 /></>}
      {active === 'forms' && <><PreviewNotice /><Forms2 /></>}
      {active === 'imports' && <><PreviewNotice /><Imports2 /></>}
      {active === 'security' && <Security2 users={users} localDemo={localDemo} />}
      {active === 'registry' && <RegistryTab />}
      {active === 'records' && <RecordsTab />}
      {active === 'integrations' && <IntegrationsTab />}
      {active === 'settings' && <SettingsTab localDemo={localDemo} />}
    </div>
  );
}
