import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity, AlertTriangle, Archive, Blocks, ClipboardList, ContactRound, Database,
  FileInput, FileText, FolderKanban, KeyRound, LayoutDashboard, LockKeyhole,
  PlugZap, Search, Settings, ShieldCheck, SlidersHorizontal, UserCog, Users,
  UsersRound,
} from 'lucide-react';
import { getAdminSettings, getAdminUser, listAdminActivity, listAdminUsers, suspendAdminUser, updateAdminSettings } from '../../api/admin';
import { ApiError } from '../../api/httpClient';
import { listPermissionGroups } from '../../api/permissions';
import AdminAcessosPage from '../components/corp/roles/AdminAcessosPage';
import { ProfilesSection, TeamsSection, UsersSection } from '../components/admin2/PeopleAccessSections';
import { FormsSection, ImportsSection, RecordsSection, RegistrySection } from '../components/admin2/GovernanceSections';
import Imports2 from '../components/admin2/Imports2';
import { Permissions2, Profiles2, Teams2 } from '../components/admin2/AccessStructure2';
import { Forms2 } from '../components/admin2/UsersForms2';
import Security2 from '../components/admin2/Security2';
import { readLocalDemoSession } from '../lib/demoAccess';
import Acervo from './Acervo';
import Management from './Management';
import { Badge, Button, EmptyState, Loading, Panel, SearchInput, Stat, Tabs } from '../ui';

const CORE_TABS = [
  { key: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
  { key: 'users', label: 'Usuários', icon: Users },
  { key: 'access', label: 'Acessos por Função', icon: UserCog },
  { key: 'profiles', label: 'Perfis e Funções', icon: ContactRound },
  { key: 'permissions', label: 'Permissões', icon: KeyRound },
  { key: 'teams', label: 'Equipes', icon: UsersRound },
  { key: 'forms', label: 'Formulários', icon: ClipboardList },
  { key: 'imports', label: 'Importações', icon: FileInput },
  { key: 'security', label: 'Segurança', icon: LockKeyhole },
];

const RELATED_TABS = [
  { key: 'archive', label: 'Acervo', icon: Archive }, { key: 'management', label: 'Gestão', icon: FolderKanban },
  { key: 'registry', label: 'Telas e Módulos', icon: Blocks }, { key: 'records', label: 'Cadastros', icon: Database },
  { key: 'integrations', label: 'Integrações', icon: PlugZap }, { key: 'settings', label: 'Configurações', icon: Settings },
];
const ALL_TABS = [...CORE_TABS, ...RELATED_TABS];

const STATUS = {
  active: ['Ativo', 'success'], invited: ['Convidado', 'info'], suspended: ['Suspenso', 'pending'],
  blocked: ['Bloqueado', 'error'], disabled: ['Desativado', 'error'], expired: ['Expirado', 'pending'],
};

const ADMIN_DEMO_PAYLOAD = {
  items: [
    { id: 'demo-1', full_name: 'Alex Maciel Ferreira', email: 'alex@mediamind.ai', tenant_role: 'Administrador', profile_name: 'Administrador', profile_id: 'demo-admin', status: 'active' },
    { id: 'demo-2', full_name: 'Marina Alves', email: 'marina@mediamind.ai', tenant_role: 'Produtora', profile_name: 'Editor', profile_id: 'demo-editor', status: 'active' },
    { id: 'demo-3', full_name: 'João Ribeiro', email: 'joao@mediamind.ai', tenant_role: 'Revisor', profile_name: 'Revisor', profile_id: 'demo-reviewer', status: 'invited' },
    { id: 'demo-4', full_name: 'Beatriz Santos', email: 'beatriz@mediamind.ai', tenant_role: 'Social Media', profile_name: 'Visualizador', profile_id: 'demo-viewer', status: 'suspended' },
  ],
  total: 4, page: 1, page_size: 25,
};

const ADMIN_DEMO_GROUPS = [
  { id: 'demo-admin', name: 'Administrador', description: 'Acesso total ao sistema.', is_active: true, permission_codes: ['admin.manage', 'users.manage', 'archive.manage', 'production.approve'] },
  { id: 'demo-editor', name: 'Editor Broadcast', description: 'Edição e finalização de conteúdos.', is_active: true, permission_codes: ['production.view', 'production.edit', 'archive.view'] },
  { id: 'demo-reviewer', name: 'Revisor', description: 'Revisão e aprovação de conteúdo.', is_active: true, permission_codes: ['production.view', 'production.approve'] },
  { id: 'demo-viewer', name: 'Visualizador', description: 'Acesso somente para consulta.', is_active: true, permission_codes: ['production.view', 'archive.view'] },
];

const ADMIN_DEMO_SETTINGS_KEY = 'mediamind_admin_demo_settings_v1';
const ADMIN_DEMO_SETTINGS = { organization_name: 'MediaMind AI', locale: 'pt-BR', timezone: 'America/Sao_Paulo', date_format: 'DD/MM/YYYY' };

function readDemoSettings() {
  try { return { ...ADMIN_DEMO_SETTINGS, ...JSON.parse(window.localStorage.getItem(ADMIN_DEMO_SETTINGS_KEY) || '{}') }; }
  catch { return { ...ADMIN_DEMO_SETTINGS }; }
}

function UserStatus({ value }) {
  const [label, tone] = STATUS[value] || [value, 'info'];
  return <Badge tone={tone}>{label}</Badge>;
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
  const [localDemo] = useState(() => Boolean(readLocalDemoSession()));

  async function load(filters = {}) {
    setError('');
    setFallbackKind('');
    if (localDemo) {
      setPayload(ADMIN_DEMO_PAYLOAD);
      setGroups(ADMIN_DEMO_GROUPS);
      setActivity([]);
      setFallbackKind('local-demo');
      return;
    }
    try {
      const [users, permissionGroups, events] = await Promise.all([
        listAdminUsers({ page: 1, pageSize: 100, search: '', status: '', ...filters }),
        listPermissionGroups().catch(() => []),
        listAdminActivity().catch(() => []),
      ]);
      setPayload(users); setGroups(permissionGroups); setActivity(events);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        setPayload(null);
        setGroups([]);
        setActivity([]);
        setFallbackKind('authentication');
        setError('Sua sessão expirou. Redirecionando para entrar novamente.');
      } else {
        setPayload(ADMIN_DEMO_PAYLOAD);
        setGroups(ADMIN_DEMO_GROUPS);
        setActivity([]);
        setFallbackKind('offline');
        setError('API indisponível: exibindo dados de demonstração para manter a prévia navegável.');
      }
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (ALL_TABS.some((tab) => tab.key === requestedTab)) setActive(requestedTab);
  }, [requestedTab]);

  function openTab(key) {
    setActive(key);
    setSearchParams(key === 'overview' ? {} : { tab: key }, { replace: true });
  }

  return (
    <div className="space-y-5 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-sky-800/70 bg-sky-950/60 text-sky-300 shadow-[0_0_24px_rgba(14,165,233,0.12)]"><SlidersHorizontal size={21} /></span>
          <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-50">Administração</h1>
            <Badge tone="success">Área validada</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-400">Controle central de usuários, acessos, formulários e segurança.</p>
          </div>
        </div>
        <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
          {localDemo ? 'Modo local funcional' : error ? 'Prévia navegável com dados de demonstração' : 'Dados de usuários conectados ao tenant selecionado'}
        </div>
      </header>

      <AdminTabs label="Navegação principal da Administração" tabs={ALL_TABS} active={active} onChange={openTab} />
      <div className="contents">
        {error && <div role={fallbackKind === 'offline' ? 'alert' : 'status'} className={`rounded-xl border p-3 text-sm ${fallbackKind === 'offline' ? 'border-rose-800 bg-rose-950/30 text-rose-300' : 'border-amber-800 bg-amber-950/20 text-amber-300'}`}>{error}</div>}
        {!payload && !error ? <Loading label="Carregando Administração..." /> : null}
      </div>
      {payload && active === 'overview' && <Overview payload={payload} groups={groups} activity={activity} onOpenTab={openTab} fallbackKind={fallbackKind} />}
      {active === 'users' && <UsersTab initialPayload={payload} onReload={load} fallbackKind={fallbackKind} />}
      {active === 'archive' && <EmbeddedArea title="Acervo"><Acervo embedded localDemo={localDemo} /></EmbeddedArea>}
      {active === 'management' && <EmbeddedArea title="Gestão"><Management embedded localDemo={localDemo} /></EmbeddedArea>}
      {active === 'access' && <AdminAcessosPage administration2 localDemo={localDemo} />}
      {active === 'profiles' && <Profiles2 groups={groups} users={payload?.items || []} />}
      {active === 'permissions' && <Permissions2 groups={groups} />}
      {active === 'teams' && <><PreviewNotice /><Teams2 /></>}
      {active === 'forms' && <><PreviewNotice /><Forms2 /></>}
      {active === 'imports' && <><PreviewNotice /><Imports2 /></>}
      {active === 'security' && <Security2 users={payload?.items || []} localDemo={localDemo} />}
      {active === 'registry' && <RegistryPreview />}
      {active === 'records' && <RecordsPreview />}
      {active === 'integrations' && <IntegrationsPreview />}
      {active === 'settings' && <SettingsPreview localDemo={localDemo} />}
    </div>
  );
}

function Overview({ payload, groups, activity, onOpenTab, fallbackKind }) {
  const activeUsers = payload.items.filter((item) => item.status === 'active').length;
  const invited = payload.items.filter((item) => item.status === 'invited').length;
  const suspended = payload.items.filter((item) => item.status === 'suspended').length;
  const blocked = payload.items.filter((item) => item.status === 'blocked').length;
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-50">Administração</h2>
        <p className="text-sm text-slate-400">Controle central de usuários, acessos, formulários e segurança.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {[
          ['Usuários ativos', activeUsers || payload.total, Users, 'sky', 'users', 'Ver usuários'],
          ['Convites pendentes', invited, UserCog, 'amber', 'users', 'Ver convites'],
          ['Perfis', groups.length, ShieldCheck, 'violet', 'profiles', 'Ver perfis'],
          ['Equipes', 7, Users, 'sky', 'teams', 'Ver equipes'],
          ['Formulários ativos', 9, Activity, 'emerald', 'forms', 'Ver formulários'],
          ['Importações no mês', 4, Activity, 'sky', 'imports', 'Ver importações'],
        ].map(([title, value, Icon, tone, target, link]) => (
          <button key={title} type="button" onClick={() => onOpenTab(target)} className="group text-left">
            <Stat title={title} value={value} icon={Icon} tone={tone} />
            <span className="-mt-8 mb-3 ml-5 block text-xs font-medium text-sky-400 group-hover:text-sky-300">{link} →</span>
          </button>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
        <Panel title="Ações rápidas">
          <p className="mb-4 text-xs text-slate-500">Acesse as tarefas administrativas mais comuns.</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              [fallbackKind ? 'Gerenciar usuários' : 'Novo usuário', fallbackKind ? 'Consulte contas e acessos disponíveis' : 'Cadastre uma nova conta', 'users'],
              [fallbackKind ? 'Revisar convites' : 'Convidar usuário', fallbackKind ? 'Confira convites e pendências' : 'Envie um convite de acesso', 'users'],
              ['Novo perfil', 'Configure um perfil reutilizável', 'profiles'],
              ['Nova importação', 'Importe dados em lote', 'imports'],
              ['Novo formulário', 'Crie uma coleta de dados', 'forms'],
            ].map(([title, text, target]) => <button type="button" key={title} onClick={() => onOpenTab(target)} className="min-h-24 rounded-xl border border-sky-900/70 bg-gradient-to-br from-sky-950/50 to-slate-950/40 p-4 text-center transition hover:border-sky-500 hover:bg-sky-950/60"><p className="font-semibold text-sky-300">{title}</p><p className="mt-1 text-xs text-slate-500">{text}</p></button>)}
          </div>
        </Panel>
        <Panel title="Alertas administrativos">
          <div className="space-y-2">
            <AlertLine tone={invited ? 'amber' : 'emerald'} text={invited ? `${invited} convite(s) pendente(s)` : 'Nenhum convite pendente'} />
            <AlertLine tone={blocked ? 'rose' : 'emerald'} text={blocked ? `${blocked} conta(s) bloqueada(s)` : 'Nenhuma conta bloqueada no tenant'} />
            <AlertLine tone={suspended ? 'amber' : 'emerald'} text={suspended ? `${suspended} acesso(s) temporário(s) exigem revisão` : 'Nenhum acesso temporário pendente'} />
            <AlertLine tone="sky" text="1 usuário ainda não está vinculado a uma equipe" />
          </div>
        </Panel>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
        <Panel title="Últimas ações administrativas">
          <div className="divide-y divide-slate-800">{activity.length ? activity.slice(0, 6).map((item) => <div key={item.id} className="py-3"><p className="font-semibold text-slate-200">{auditLabel(item.action)}</p><p className="mt-1 text-xs text-slate-500">{item.entity_type || 'Sistema'} · {item.created_date ? new Date(item.created_date).toLocaleString('pt-BR') : 'horário não informado'}</p></div>) : <p className="py-6 text-sm text-slate-500">Nenhuma ação administrativa registrada.</p>}</div>
        </Panel>
        <Panel title="Status de segurança">
          <div className="space-y-2"><SecurityLine label="MFA para administradores" value={fallbackKind ? 'Não verificado' : 'Ativo'} /><SecurityLine label="Sessões suspeitas" value={fallbackKind ? 'Não verificadas' : String(blocked)} /><SecurityLine label="Política de senha" value={fallbackKind ? 'Não verificada' : 'Conforme'} /><SecurityLine label="Auditoria administrativa" value={fallbackKind ? 'Indisponível' : 'Operacional'} /></div>
        </Panel>
      </div>
    </div>
  );
}

function auditLabel(action = '') {
  const labels = { 'user.suspended': 'Usuário suspenso', 'record.created': 'Registro criado', 'record.updated': 'Registro atualizado', 'records.bulk_created': 'Registros importados' };
  return labels[action] || action.replaceAll('.', ' ') || 'Ação administrativa';
}

function LegacyProfilesTab({ groups, users }) {
  const [selected, setSelected] = useState(groups[0] || null);
  useEffect(() => { if (!selected && groups[0]) setSelected(groups[0]); }, [groups, selected]);
  if (!groups.length) return <div className="space-y-4"><Panel title="Perfis e Funções 2"><EmptyState icon={UserCog} title="Nenhum perfil cadastrado" description="Crie os primeiros grupos na Administração atual para visualizá-los aqui." /></Panel><div className="grid gap-4 lg:grid-cols-2"><Panel title="Módulos liberados"><p className="text-sm text-slate-500">Nenhum módulo liberado.</p></Panel><Panel title="Matriz resumida de permissões"><p className="text-sm text-slate-500">Nenhuma permissão cadastrada.</p></Panel></div></div>;
  const current = selected || groups[0];
  const linked = users.filter((user) => user.profile_id === current.id);
  return <div className="space-y-4"><div><h2 className="text-xl font-bold text-slate-50">Perfis e Funções 2</h2><p className="text-sm text-slate-400">Perfis reais do tenant e suas permissões efetivas.</p></div><div className="grid gap-4 xl:grid-cols-[0.75fr_1.5fr]"><Panel title={`Perfis cadastrados · ${groups.length}`}><div className="space-y-2">{groups.map((group) => <button type="button" key={group.id} onClick={() => setSelected(group)} className={`w-full rounded-xl border p-4 text-left ${current.id === group.id ? 'border-sky-500 bg-sky-950/30' : 'border-slate-800 bg-slate-950/40 hover:border-sky-800'}`}><div className="flex justify-between"><p className="font-semibold text-slate-100">{group.name}</p><Badge tone={group.is_active ? 'success' : 'error'}>{group.is_active ? 'Ativo' : 'Inativo'}</Badge></div><p className="mt-1 text-xs text-slate-500">{group.description || 'Sem descrição'}</p><p className="mt-2 text-xs text-sky-400">{group.permission_codes.length} permissões</p></button>)}</div></Panel><div className="space-y-4"><Panel title={current.name} right={<Badge tone="info">{linked.length} usuário(s)</Badge>}><p className="text-sm text-slate-400">{current.description || 'Perfil sem descrição.'}</p></Panel><Panel title="Módulos liberados"><div className="flex flex-wrap gap-2">{current.permission_codes.length ? [...new Set(current.permission_codes.map((code) => code.split(/[.:]/)[0]))].map((module) => <Badge key={module} tone="info">{module}</Badge>) : <span className="text-sm text-slate-500">Nenhum módulo liberado.</span>}</div></Panel><Panel title="Matriz resumida de permissões"><div className="grid gap-2 sm:grid-cols-2">{current.permission_codes.length ? current.permission_codes.slice(0, 12).map((code) => <div key={code} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2"><span className="text-xs text-slate-300">{code}</span><Badge tone="success">Liberado</Badge></div>) : <span className="text-sm text-slate-500">Nenhuma permissão explícita.</span>}</div></Panel><Panel title="Usuários vinculados"><div className="space-y-2">{linked.length ? linked.map((user) => <div key={user.id} className="rounded-lg border border-slate-800 px-3 py-2"><p className="text-sm text-slate-200">{user.full_name || user.email}</p><p className="text-xs text-slate-500">{user.email}</p></div>) : <p className="text-sm text-slate-500">Nenhum usuário vinculado.</p>}</div></Panel></div></div></div>;
}

function PermissionsTab({ groups }) {
  const codes = [...new Set(groups.flatMap((group) => group.permission_codes))].sort();
  const granted = groups.reduce((total, group) => total + group.permission_codes.length, 0);
  return <div className="space-y-4"><div><h2 className="text-xl font-bold text-slate-50">Permissões 2</h2><p className="text-sm text-slate-400">Matriz real de permissões por perfil.</p></div><div className="grid gap-4 xl:grid-cols-[1fr_300px]"><Panel title="Matriz de permissões"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-slate-800 text-xs uppercase text-slate-500"><tr><th className="p-3">Permissão</th>{groups.map((group) => <th key={group.id} className="p-3">{group.name}</th>)}</tr></thead><tbody>{codes.map((code) => <tr key={code} className="border-b border-slate-800/60"><td className="p-3 font-medium text-slate-200">{code}</td>{groups.map((group) => <td key={group.id} className="p-3"><Badge tone={group.permission_codes.includes(code) ? 'success' : 'error'}>{group.permission_codes.includes(code) ? 'Permitido' : 'Negado'}</Badge></td>)}</tr>)}</tbody></table>{!codes.length && <p className="py-8 text-center text-sm text-slate-500">Nenhuma permissão cadastrada.</p>}</div></Panel><aside className="space-y-4"><Panel title="Resumo do perfil"><div className="grid grid-cols-2 gap-2"><UserMetric label="Perfis" value={groups.length} tone="sky" /><UserMetric label="Concessões" value={granted} tone="emerald" /></div></Panel><Panel title="Permissões críticas"><div className="space-y-2"><AlertLine tone="rose" text="Excluir itens do acervo" /><AlertLine tone="amber" text="Gerenciar usuários" /><AlertLine tone="sky" text="Aprovar publicações" /></div></Panel></aside></div><Panel title="Alterações recentes"><div className="divide-y divide-slate-800">{groups.slice(0, 5).map((group) => <div key={group.id} className="flex items-center justify-between py-3 text-sm"><span className="text-slate-300">Permissões revisadas para {group.name}</span><Badge tone="info">Perfil</Badge></div>)}</div></Panel></div>;
}

function AdminTabs({ label, tabs, active, onChange, compact = false }) {
  return <nav aria-label={label} className={`overflow-x-auto border border-slate-800 bg-slate-950/40 shadow-[0_12px_35px_rgba(2,8,23,0.22)] ${compact ? '-mt-3 rounded-lg p-1' : 'rounded-xl p-1.5'}`}><div className="flex min-w-max gap-1">{tabs.map((tab) => { const Icon = tab.icon; return <button key={tab.key} type="button" onClick={() => onChange(tab.key)} className={`group flex shrink-0 items-center gap-2 rounded-lg font-medium transition ${compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'} ${active === tab.key ? 'bg-sky-500 text-slate-950 shadow-[0_6px_18px_rgba(14,165,233,0.2)]' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}><Icon aria-hidden="true" size={15} strokeWidth={active === tab.key ? 2.4 : 1.9} className={active === tab.key ? 'text-slate-950' : 'text-sky-400 transition group-hover:text-sky-300'} />{tab.label}</button>; })}</div></nav>;
}

function AlertLine({ tone, text }) {
  const colors = { rose: 'border-rose-900/70 text-rose-300', amber: 'border-amber-900/70 text-amber-300', emerald: 'border-emerald-900/70 text-emerald-300', sky: 'border-sky-900/70 text-sky-300' };
  return <div className={`rounded-lg border bg-slate-950/60 px-3 py-2 text-sm ${colors[tone]}`}>{text}</div>;
}

function SecurityLine({ label, value }) {
  return <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2"><span className="text-sm text-slate-300">{label}</span><Badge tone={value === 'Operacional' || value === '0' ? 'success' : 'pending'}>{value}</Badge></div>;
}

function UsersTab({ initialPayload, onReload, fallbackKind }) {
  const [view, setView] = useState('reference');
  async function suspend(user) {
    if (!window.confirm(`Suspender ${user.full_name || user.email}?`)) return;
    const updated = await suspendAdminUser(user.id, 'Suspensão confirmada pelo administrador.');
    await onReload();
    return updated;
  }
  return <div className="space-y-4"><PageLead title="Usuários" description="Contas, convites, perfis e atividade de acesso." /><Tabs tabs={[{ key: 'reference', label: 'Referência' }, { key: 'previous', label: 'Anterior +1' }]} active={view} onChange={setView} />{view === 'previous' ? <LegacyUsersTab initialPayload={initialPayload} onReload={onReload} fallbackKind={fallbackKind} /> : <><div className="grid gap-3 md:grid-cols-2"><Panel title="Convites pendentes"><p className="text-sm text-slate-400">{(initialPayload?.items || []).filter((user) => user.status === 'invited').length} convite(s) aguardando aceite.</p></Panel><Panel title="Acessos expirando"><p className="text-sm text-slate-500">Validade ainda não integrada ao contrato da lista.</p></Panel></div><UsersSection users={initialPayload?.items || []} total={initialPayload?.total || 0} demoMode={Boolean(fallbackKind)} loadUser={fallbackKind ? undefined : getAdminUser} onSuspend={suspend} /></>}</div>;
}

function LegacyUsersTab({ initialPayload, onReload, fallbackKind }) {
  const [payload, setPayload] = useState(initialPayload);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const visible = useMemo(() => payload?.items || [], [payload]);

  useEffect(() => {
    if (initialPayload) setPayload(initialPayload);
  }, [initialPayload]);

  async function applyFilters(event) {
    event.preventDefault();
    if (fallbackKind) {
      const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
      setPayload({
        ...initialPayload,
        items: (initialPayload?.items || []).filter((user) => (!status || user.status === status) && (!normalizedSearch || `${user.full_name} ${user.email}`.toLocaleLowerCase('pt-BR').includes(normalizedSearch))),
      });
      return;
    }
    setLoading(true);
    try { setPayload(await listAdminUsers({ page: 1, pageSize: 100, search, status })); } finally { setLoading(false); }
  }

  async function openUser(id) {
    if (fallbackKind) {
      const demoUser = visible.find((user) => user.id === id);
      setSelected({ ...demoUser, extra_screens: [], restricted_screens: [], failed_login_attempts: 0, is_demo: true });
      return;
    }
    setSelected(await getAdminUser(id));
  }

  if (selected) return <UserDetail user={selected} onChange={setSelected} onBack={() => setSelected(null)} onReload={onReload} />;
  return (
    <div className="space-y-4">
      <div><h2 className="text-xl font-bold text-slate-50">Usuários</h2><p className="text-sm text-slate-400">Contas, convites, perfis e atividade de acesso.</p></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <UserMetric label="Ativos" value={visible.filter((user) => user.status === 'active').length} tone="emerald" />
        <UserMetric label="Convites" value={visible.filter((user) => user.status === 'invited').length} tone="amber" />
        <UserMetric label="Suspensos" value={visible.filter((user) => user.status === 'suspended').length} tone="rose" />
        <UserMetric label="Bloqueados" value={visible.filter((user) => user.status === 'blocked').length} tone="rose" />
        <UserMetric label="Total" value={payload?.total || 0} tone="sky" />
      </div>
      {fallbackKind && <div role="status" className="rounded-lg border border-amber-800/60 bg-amber-950/20 px-3 py-2 text-xs text-amber-300">A busca e os detalhes funcionam localmente nesta demonstração. Alterações de conta exigem conexão com o backend.</div>}
      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
      <Panel title="Usuários do tenant" right={<Badge tone="info">{payload?.total || 0} registros</Badge>}>
      <form onSubmit={applyFilters} className="mb-4 flex flex-wrap gap-2">
        <SearchInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nome ou e-mail" className="min-w-64 flex-1" />
        <select aria-label="Filtrar por status" value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-300">
          <option value="">Todos os estados</option><option value="active">Ativos</option><option value="suspended">Suspensos</option><option value="blocked">Bloqueados</option>
        </select>
        <Button type="submit" loading={loading} icon={<Search size={15} />}>Filtrar</Button>
      </form>
      {visible.length === 0 ? <EmptyState icon={Users} title="Nenhum usuário encontrado" description="Ajuste os filtros ou confira o tenant selecionado." /> : (
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-slate-800 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Usuário</th><th className="px-3 py-2">Função</th><th className="px-3 py-2">Perfil</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2 text-right">Ações</th></tr></thead><tbody>{visible.map((user) => <tr key={user.id} className="border-b border-slate-800/70"><td className="px-3 py-3"><p className="font-medium text-slate-200">{user.full_name || user.email}</p><p className="text-xs text-slate-500">{user.email}</p></td><td className="px-3 py-3 text-slate-400">{user.tenant_role}</td><td className="px-3 py-3 text-slate-400">{user.profile_name || 'Sem perfil'}</td><td className="px-3 py-3"><UserStatus value={user.status} /></td><td className="px-3 py-3 text-right"><Button aria-label={`Ver ${user.full_name || user.email}`} variant="ghost" size="sm" onClick={() => openUser(user.id)}>Ver detalhe</Button></td></tr>)}</tbody></table></div>
      )}
      </Panel>
      <aside className="space-y-4">
        <Panel title="Convites pendentes">
          <div className="space-y-2">{visible.filter((user) => user.status === 'invited').slice(0, 4).map((user) => <button type="button" key={user.id} onClick={() => openUser(user.id)} className="w-full rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-left hover:border-sky-700"><p className="text-sm font-medium text-slate-200">{user.full_name || user.email}</p><p className="mt-1 text-xs text-slate-500">{user.email}</p></button>)}{!visible.some((user) => user.status === 'invited') && <p className="text-sm text-slate-500">Nenhum convite aguardando aceite.</p>}</div>
        </Panel>
        <Panel title="Acessos expirando">
          <EmptyState icon={LockKeyhole} title="Validade ainda não integrada" description="O backend ainda não fornece datas de expiração para esta lista." />
        </Panel>
      </aside>
      </div>
    </div>
  );
}

function UserMetric({ label, value, tone }) {
  const tones = { sky: 'text-sky-300', emerald: 'text-emerald-300', amber: 'text-amber-300', rose: 'text-rose-300' };
  return <div className="rounded-xl border border-slate-800 bg-slate-950/45 px-4 py-3"><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 text-2xl font-bold ${tones[tone]}`}>{value}</p></div>;
}

function UserDetail({ user, onChange, onBack, onReload }) {
  const [working, setWorking] = useState(false);
  const [detailTab, setDetailTab] = useState('overview');
  async function suspend() {
    if (!window.confirm(`Suspender ${user.full_name || user.email}?`)) return;
    setWorking(true);
    try {
      onChange(await suspendAdminUser(user.id, 'Suspensão confirmada pelo administrador.'));
      onReload();
    } finally { setWorking(false); }
  }
  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack}>← Voltar para usuários</Button>
      <Panel right={<UserStatus value={user.status} />}>
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-slate-50">{user.full_name || user.email}</h2><p className="text-sm text-slate-400">{user.email}</p><p className="mt-2 text-xs text-slate-500">Função: {user.tenant_role} · Perfil: {user.profile_name || 'não atribuído'}</p>{user.is_demo && <p className="mt-2 text-xs text-amber-300">Detalhe de demonstração — nenhuma alteração será enviada.</p>}</div>{user.status === 'active' && !user.is_demo && <Button variant="danger" loading={working} onClick={suspend}>Suspender usuário</Button>}</div>
      </Panel>
      <Tabs tabs={[['overview', 'Visão Geral'], ['access', 'Acesso'], ['roles', 'Funções'], ['teams', 'Equipes'], ['modules', 'Módulos'], ['permissions', 'Permissões'], ['security', 'Segurança'], ['activity', 'Atividade'], ['history', 'Histórico']].map(([key, label]) => ({ key, label }))} active={detailTab} onChange={setDetailTab} />
      {detailTab === 'overview' && <div className="grid gap-4 lg:grid-cols-2"><Panel title="Conta"><dl className="space-y-2 text-sm"><Info label="Estado"><UserStatus value={user.status} /></Info><Info label="Criado em">{user.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : 'Não informado'}</Info></dl></Panel><Panel title="Vínculo atual"><p className="text-sm text-slate-400">Função <strong className="text-slate-200">{user.tenant_role}</strong>{user.profile_name ? ` com perfil ${user.profile_name}` : ' sem perfil adicional'}.</p></Panel></div>}
      {['access', 'roles', 'permissions'].includes(detailTab) && <Panel title="Acesso efetivo"><p className="text-sm text-slate-400">Função <strong className="text-slate-200">{user.tenant_role}</strong>{user.profile_name ? ` · Perfil ${user.profile_name}` : ' · Sem perfil adicional'}.</p><p className="mt-2 text-xs text-amber-300">A separação entre gestor do canal, gestor do acervo e demais responsáveis ainda será definida.</p></Panel>}
      {detailTab === 'modules' && <div className="grid gap-4 lg:grid-cols-2"><Panel title="Telas adicionais">{user.extra_screens?.length ? <TagList items={user.extra_screens} /> : <p className="text-sm text-slate-500">Nenhuma tela extra liberada.</p>}</Panel><Panel title="Telas restritas">{user.restricted_screens?.length ? <TagList items={user.restricted_screens} /> : <p className="text-sm text-slate-500">Nenhuma tela restrita.</p>}</Panel></div>}
      {detailTab === 'security' && <Panel title="Segurança da conta"><dl className="space-y-3 text-sm"><Info label="Estado"><UserStatus value={user.status} /></Info><Info label="Tentativas falhas">{user.failed_login_attempts}</Info><Info label="Bloqueio">{user.locked_until ? `Até ${new Date(user.locked_until).toLocaleString('pt-BR')}` : 'Sem bloqueio ativo'}</Info></dl></Panel>}
      {['teams', 'activity', 'history'].includes(detailTab) && <Preparing tab={['teams', 'activity', 'history'].includes(detailTab) ? { teams: 'Equipes 2', activity: 'Atividade 2', history: 'Histórico 2' }[detailTab] : ''} />}
    </div>
  );
}

function Info({ label, children }) {
  return <div className="flex items-center justify-between gap-4 border-b border-slate-800/70 pb-2"><dt className="text-slate-500">{label}</dt><dd className="text-right text-slate-200">{children}</dd></div>;
}

function TagList({ items }) {
  return <div className="flex flex-wrap gap-2">{items.map((item) => <Badge key={item} tone="info">{item}</Badge>)}</div>;
}

function EmbeddedArea({ title, children }) {
  return <section className="rounded-2xl border border-sky-900/50 bg-slate-950/30 p-4"><div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-400">Dentro da Administração</p><h2 className="mt-1 text-lg font-bold text-slate-100">{title}</h2></div><Badge tone="success">Integrado</Badge></div>{children}</section>;
}

const DEMO_TEAMS = [
  ['Produção', '18 membros', 'Mariana Silva'], ['Jornalismo', '12 membros', 'Carlos Mendes'],
  ['Audiovisual', '11 membros', 'Rafael Lima'], ['Social Media', '7 membros', 'Juliana Costa'],
  ['CEDOC', '6 membros', 'Ana Paula Ribeiro'], ['Comunicação', '9 membros', 'Felipe Martins'],
];

function PreviewNotice() {
  return <div className="rounded-lg border border-amber-800/60 bg-amber-950/20 px-3 py-2 text-xs text-amber-300">Dados de demonstração visual — estrutura preparada conforme as referências; alterações permanecem desabilitadas até a conexão do backend.</div>;
}

function PageLead({ title, description, action }) {
  return <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-50">{title}</h2><p className="mt-1 text-sm text-slate-400">{description}</p></div>{action}</div>;
}

function ReadOnlyAction({ children }) {
  return <span className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-400">{children} · requer backend</span>;
}

function DemoMetric({ label, value, tone = 'sky' }) {
  const colors = { sky: 'text-sky-300', emerald: 'text-emerald-300', amber: 'text-amber-300', rose: 'text-rose-300' };
  return <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-4"><p className="text-xs text-slate-500">{label}</p><p className={`mt-2 text-2xl font-bold ${colors[tone]}`}>{value}</p></div>;
}

function LegacyTeamsPreview() {
  const [selected, setSelected] = useState('Audiovisual');
  return <div className="space-y-4"><PageLead title="Equipes / Setores / Unidades" description="Estrutura operacional, responsáveis e vínculos da organização." action={<Button disabled>+ Nova equipe</Button>} /><PreviewNotice /><div className="grid gap-4 xl:grid-cols-[340px_1fr]"><Panel title="Equipes da organização"><SearchInput placeholder="Buscar equipe ou responsável" value="" readOnly /><div className="mt-3 space-y-2">{DEMO_TEAMS.map(([name, count, lead]) => <button type="button" key={name} onClick={() => setSelected(name)} className={`w-full rounded-lg border p-3 text-left ${selected === name ? 'border-sky-500 bg-sky-950/30' : 'border-slate-800 bg-slate-950/40'}`}><div className="flex justify-between"><strong>{name}</strong><span className="text-sky-400">›</span></div><p className="text-xs text-slate-400">{count}</p><p className="text-xs text-slate-500">Responsável: {lead}</p></button>)}</div></Panel><div className="space-y-4"><Panel title={selected} right={<Badge tone="success">Ativa</Badge>}><div className="grid gap-3 sm:grid-cols-4"><DemoMetric label="Membros" value="11" /><DemoMetric label="Unidade" value="Produção" /><DemoMetric label="Setores" value="2" /><DemoMetric label="Funções" value="5" /></div></Panel><Panel title="Membros da equipe"><DemoTable headers={['Nome', 'Função', 'Perfil', 'Status']} rows={[["Rafael Lima", 'Coordenador', 'Administrador', 'Ativo'], ['Marina Souza', 'Videomaker', 'Usuário', 'Ativo'], ['Bruno Carvalho', 'Editor de vídeo', 'Usuário', 'Ativo'], ['Larissa Fernandes', 'Motion Designer', 'Usuário', 'Ativo']]} /></Panel></div></div></div>;
}

function ProfilesTab({ groups, users }) {
  const [view, setView] = useState('reference');
  return <div className="space-y-4"><PageLead title="Perfis e Funções" description="Perfis reutilizáveis, funções associadas e permissões efetivas." /><Tabs tabs={[{ key: 'reference', label: 'Referência' }, { key: 'previous', label: 'Anterior +1' }]} active={view} onChange={setView} />{view === 'reference' ? <ProfilesSection groups={groups} users={users} /> : <LegacyProfilesTab groups={groups} users={users} />}</div>;
}

function TeamsPreview() {
  const [view, setView] = useState('reference');
  return <div className="space-y-4"><PageLead title="Equipes / Setores / Unidades" description="Estrutura operacional, responsáveis, membros e vínculos." /><Tabs tabs={[{ key: 'reference', label: 'Referência' }, { key: 'previous', label: 'Anterior +1' }]} active={view} onChange={setView} />{view === 'reference' ? <TeamsSection /> : <LegacyTeamsPreview />}</div>;
}

function FormsPreview() {
  const [view, setView] = useState('reference');
  return <div className="space-y-4"><PageLead title="Formulários" description="Formulários internos e públicos conectados às entidades do sistema." action={<ReadOnlyAction>Criação de formulário</ReadOnlyAction>} /><PreviewNotice /><Tabs tabs={[{ key: 'reference', label: 'Referência' }, { key: 'previous', label: 'Anterior +1' }]} active={view} onChange={setView} />{view === 'reference' ? <FormsSection /> : <LegacyFormsPreview />}</div>;
}

function LegacyFormsPreview() {
  const forms = [['Cadastro de convidado', 'Público', '243 respostas'], ['Autorização de imagem', 'Público', '189 respostas'], ['Novo programa', 'Interno', 'Rascunho'], ['Solicitação de mídia', 'Público', '67 respostas']];
  const [selected, setSelected] = useState(forms[0][0]);
  return <div className="space-y-4"><PageLead title="Formulários" description="Formulários conectados às entidades administrativas." action={<ReadOnlyAction>Criação de formulário</ReadOnlyAction>} /><PreviewNotice /><div className="grid gap-3 sm:grid-cols-4"><DemoMetric label="Ativos" value="9" tone="emerald" /><DemoMetric label="Rascunhos" value="3" /><DemoMetric label="Externos" value="4" /><DemoMetric label="Respostas no mês" value="126" /></div><div className="grid gap-4 xl:grid-cols-[360px_1fr]"><Panel title="Formulários cadastrados"><div className="space-y-2">{forms.map(([name, scope, count]) => <button type="button" key={name} onClick={() => setSelected(name)} className={`w-full rounded-lg border p-3 text-left ${selected === name ? 'border-sky-500 bg-sky-950/30' : 'border-slate-800 bg-slate-950/40 hover:border-sky-800'}`}><strong>{name}</strong><p className="mt-1 text-xs text-slate-500">{scope} · {count}</p></button>)}</div></Panel><Panel title="Pré-visualização do formulário"><div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5"><h3 className="text-lg font-bold">{selected}</h3><p className="text-sm text-slate-400">Prévia somente leitura do modelo selecionado.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{['Nome completo', 'E-mail', 'Telefone', 'Empresa'].map((label) => <label key={label} className="text-xs text-slate-400">{label}<input disabled placeholder={label} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2" /></label>)}</div><label className="mt-3 block text-xs text-slate-400">Observações<textarea disabled className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-3" /></label><p className="mt-4 text-xs text-slate-500">O envio permanece indisponível até existir endpoint com validação, persistência e auditoria.</p></div></Panel></div></div>;
}

function ImportsPreview() {
  const [view, setView] = useState('reference');
  return <div className="space-y-4"><PageLead title="Importação de Dados" description="Upload, mapeamento, validação e relatório antes da gravação." /><PreviewNotice /><Tabs tabs={[{ key: 'reference', label: 'Referência' }, { key: 'previous', label: 'Anterior +1' }]} active={view} onChange={setView} />{view === 'reference' ? <ImportsSection /> : <LegacyImportsPreview />}</div>;
}

function LegacyImportsPreview() {
  return <div className="space-y-4"><PageLead title="Importação de Dados" description="Upload, mapeamento, validação e relatório antes da gravação." action={<Button disabled>+ Nova importação</Button>} /><PreviewNotice /><div className="grid gap-3 sm:grid-cols-4"><DemoMetric label="Importações no mês" value="4" /><DemoMetric label="Última concluída" value="Hoje" tone="emerald" /><DemoMetric label="Erros pendentes" value="11" tone="rose" /><DemoMetric label="Modelos salvos" value="2" /></div><div className="grid gap-4 xl:grid-cols-3"><Panel title="Arquivo e pré-visualização"><p className="rounded-lg border border-emerald-900 bg-emerald-950/20 p-3 text-sm text-emerald-300">usuarios_setembro.xlsx · arquivo processado</p><DemoTable headers={['Nome', 'E-mail', 'Equipe']} rows={[["Ana Souza", 'ana@empresa.com', 'Produto'], ['Bruno Martins', 'bruno@empresa.com', 'Tecnologia'], ['Carla Mendes', 'carla@empresa.com', 'Marketing']]} /></Panel><Panel title="Mapeamento de colunas"><div className="space-y-2">{[['Nome completo', 'name'], ['E-mail', 'email'], ['Equipe', 'team'], ['Cargo', 'job_title'], ['Status', 'status']].map(([source, target]) => <div key={source} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2 text-sm"><span>{source}</span><Badge tone="info">{target}</Badge></div>)}</div></Panel><Panel title="Resultado da validação"><div className="grid grid-cols-3 gap-2"><DemoMetric label="Válidas" value="468" tone="emerald" /><DemoMetric label="Alertas" value="21" tone="amber" /><DemoMetric label="Erros" value="11" tone="rose" /></div><div className="mt-3"><DemoTable headers={['Linha', 'Problema']} rows={[[12, 'E-mail inválido'], [28, 'Equipe não encontrada'], [47, 'Data inválida']]} /></div></Panel></div></div>;
}

function SecurityPreview({ users }) {
  const [view, setView] = useState('reference');
  return <div className="space-y-4"><PageLead title="Segurança" description="Políticas, sessões e eventos de autenticação." /><PreviewNotice /><Tabs tabs={[{ key: 'reference', label: 'Referência' }, { key: 'previous', label: 'Operacional +1' }]} active={view} onChange={setView} />{view === 'reference' ? <><div className="grid gap-4 xl:grid-cols-2"><Panel title="Sessões ativas"><p className="text-sm text-slate-500">Endpoint de sessões ainda não integrado.</p></Panel><Panel title="Histórico de segurança"><p className="text-sm text-slate-500">Eventos reais aparecerão quando o contrato estiver disponível.</p></Panel></div><SecuritySection users={users} /></> : <LegacySecurityPreview users={users} />}</div>;
}

function LegacySecurityPreview({ users }) {
  const blocked = users.filter((user) => user.status === 'blocked').length;
  return <div className="space-y-4"><PageLead title="Segurança" description="Políticas, sessões e eventos de autenticação." /><PreviewNotice /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><DemoMetric label="MFA ativo" value="—" /><DemoMetric label="Usuários bloqueados" value={blocked} tone={blocked ? 'rose' : 'emerald'} /><DemoMetric label="Convites pendentes" value={users.filter((user) => user.status === 'invited').length} tone="amber" /><DemoMetric label="Sessões ativas" value="—" /><DemoMetric label="Tentativas (24h)" value="—" /></div><div className="grid gap-4 xl:grid-cols-2"><Panel title="Autenticação em duas etapas (MFA)"><div className="space-y-2">{['Superadmin', 'Administrador', 'Gestor de Acervo', 'Usuário padrão'].map((role, index) => <div key={role} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-3"><span>{role}</span><Badge tone={index < 2 ? 'pending' : 'info'}>{index < 2 ? 'Configuração pendente' : 'Opcional'}</Badge></div>)}</div></Panel><Panel title="Sessões ativas"><EmptyState icon={LockKeyhole} title="Sessões ainda não integradas" description="A visualização será ativada quando o endpoint de sessões estiver disponível." /></Panel></div><div className="grid gap-4 xl:grid-cols-2"><Panel title="Regras de bloqueio e proteção"><SecurityLine label="Bloqueio por tentativas" value="Não integrado" /><SecurityLine label="Tempo de bloqueio" value="Não integrado" /><SecurityLine label="Notificar administrador" value="Não integrado" /></Panel><Panel title="Histórico de segurança"><DemoTable headers={['Data', 'Evento', 'Usuário']} rows={[["Hoje", 'Auditoria operacional', 'sistema'], ['—', 'MFA', 'não integrado'], ['—', 'Sessões', 'não integrado']]} /></Panel></div></div>;
}

const SCREEN_TREE = [
  ['Produção', '6 módulos', 'Workspace, Aprovação e Publicações'],
  ['Acervo', '3 módulos', 'Arquivos, Usuários e Sistema'],
  ['Gestão', '4 módulos', 'Visão Geral, Relatórios, Processamentos e Auditoria'],
  ['Administração', '11 módulos', 'Usuários, acessos, equipes e governança'],
];

function RegistryPreview() {
  const [view, setView] = useState('reference');
  return <div className="space-y-4"><PageLead title="Registro de telas e módulos" description="Mapa estrutural de produtos, módulos, telas, seções e ações controláveis." /><PreviewNotice /><Panel title="Hierarquia do produto"><Tabs tabs={[{ key: 'reference', label: 'Referência' }, { key: 'previous', label: 'Anterior +1' }]} active={view} onChange={setView} /></Panel>{view === 'reference' ? <RegistrySection /> : <LegacyRegistryPreview />}</div>;
}

function LegacyRegistryPreview() {
  const [selected, setSelected] = useState('Produção');
  const selectedItem = SCREEN_TREE.find(([name]) => name === selected) || SCREEN_TREE[0];
  return <div className="space-y-4"><PageLead title="Registro de telas e módulos" description="Mapa estrutural de produtos, módulos, telas, seções e ações controláveis." /><PreviewNotice /><div className="grid gap-3 sm:grid-cols-4"><DemoMetric label="Produtos persistidos" value="—" /><DemoMetric label="Módulos persistidos" value="—" /><DemoMetric label="Telas persistidas" value="—" /><DemoMetric label="Ações persistidas" value="—" /></div><div className="grid gap-4 xl:grid-cols-[360px_1fr]"><Panel title="Hierarquia do produto"><div className="rounded-lg border border-sky-900/70 bg-sky-950/20 p-3"><p className="font-semibold text-sky-200">MediaMind AI</p><p className="text-xs text-slate-500">Estrutura de referência, ainda sem catálogo persistente</p></div><div className="mt-3 space-y-2">{SCREEN_TREE.map(([name, , description]) => <button type="button" key={name} onClick={() => setSelected(name)} className={`w-full rounded-lg border p-3 text-left ${selected === name ? 'border-sky-500 bg-sky-950/30' : 'border-slate-800 bg-slate-950/40 hover:border-sky-800'}`}><strong>{name}</strong><p className="mt-1 text-xs text-slate-500">{description}</p></button>)}</div></Panel><div className="space-y-4"><Panel title={`${selectedItem[0]} · estrutura selecionada`} right={<Badge tone="pending">Não persistido</Badge>}><p className="text-sm text-slate-400">A estrutura abaixo documenta a hierarquia esperada. Contadores serão exibidos somente quando vierem do catálogo do tenant.</p></Panel><Panel title="Mapa de seções e ações"><DemoTable headers={['Nível', 'Identificador', 'Visibilidade', 'Ações']} rows={[["Módulo", selected, 'A definir', 'Acessar'], ['Tela', selected === 'Produção' ? 'Workspace' : 'Visão Geral', 'A definir', 'Visualizar, editar'], ['Seção', 'Painel principal', 'A definir', 'Visualizar'], ['Widget', 'Indicadores', 'A definir', 'Visualizar, exportar']]} /><p className="mt-3 text-xs text-amber-300">Esta referência ainda não altera permissões reais.</p></Panel></div></div></div>;
}

const RECORD_ENTITIES = [
  ['Pessoa', '34', 'Usuários e contatos', 'Parcial'], ['Programa', '12', 'Produção editorial', 'Mapeado'],
  ['Equipe', '7', 'Estrutura organizacional', 'Parcial'], ['Biblioteca', '6', 'Acervo', 'Mapeado'],
  ['Definição de formulário', '9', 'Administração', 'Planejado'],
];

function RecordsPreview() {
  const [view, setView] = useState('reference');
  return <div className="space-y-4"><PageLead title="Cadastros administrativos" description="Catálogo das entidades compartilhadas e seus vínculos com os módulos." /><PreviewNotice /><Tabs tabs={[{ key: 'reference', label: 'Referência' }, { key: 'previous', label: 'Anterior +1' }]} active={view} onChange={setView} />{view === 'reference' ? <RecordsSection /> : <LegacyRecordsPreview />}</div>;
}

function LegacyRecordsPreview() {
  const [selected, setSelected] = useState('Pessoa');
  return <div className="space-y-4"><PageLead title="Cadastros administrativos" description="Catálogo das entidades compartilhadas e seus vínculos com os módulos." /><PreviewNotice /><div className="grid gap-4 xl:grid-cols-[420px_1fr]"><Panel title="Entidades cadastradas"><div className="space-y-2">{RECORD_ENTITIES.map(([name, count, domain, status]) => <button type="button" key={name} onClick={() => setSelected(name)} className={`w-full rounded-lg border p-3 text-left ${selected === name ? 'border-sky-500 bg-sky-950/30' : 'border-slate-800 bg-slate-950/40 hover:border-sky-800'}`}><div className="flex items-center justify-between"><strong>{name}</strong><span className="text-xl font-bold text-sky-300">{count}</span></div><div className="mt-1 flex items-center justify-between text-xs text-slate-500"><span>{domain}</span><span>{status}</span></div></button>)}</div></Panel><div className="space-y-4"><Panel title={`${selected} · definição`} right={<Badge tone="pending">Catálogo preliminar</Badge>}><div className="grid gap-3 sm:grid-cols-3"><DemoMetric label="Registros" value={RECORD_ENTITIES.find(([name]) => name === selected)?.[1] || '—'} /><DemoMetric label="Campos" value="8" /><DemoMetric label="Vínculos" value="3" /></div></Panel><Panel title="Campos e governança"><DemoTable headers={['Campo', 'Tipo', 'Obrigatório', 'Fonte']} rows={[["Nome", 'Texto', 'Sim', 'Cadastro'], ['Identificador', 'UUID', 'Sim', 'Sistema'], ['Status', 'Enum', 'Sim', 'Workflow'], ['Observações', 'Texto longo', 'Não', 'Cadastro']]} /><div className="mt-4 grid gap-3 sm:grid-cols-2"><SecurityLine label="Escopo do tenant" value="Obrigatório" /><SecurityLine label="Auditoria append-only" value="Planejada" /><SecurityLine label="Exclusão lógica" value="Planejada" /><SecurityLine label="Validação no servidor" value="Pendente" /></div></Panel></div></div></div>;
}

const INTEGRATIONS = [
  ['API MediaMind', 'Interna', 'Endpoint local verificado'], ['PostgreSQL / Neon', 'Dados', 'Configuração não exibida'],
  ['Armazenamento', 'Mídia', 'Estado não verificado'], ['Transcrição', 'IA', 'Estado não verificado'],
  ['OCR', 'IA', 'Estado não verificado'], ['Redes sociais', 'Publicação', 'Não integradas'],
];

function IntegrationsPreview() {
  const [selected, setSelected] = useState('API MediaMind');
  return <div className="space-y-4"><PageLead title="Integrações" description="Inventário de conexões internas e externas, credenciais e sincronizações." /><PreviewNotice /><div className="rounded-xl border border-amber-800/60 bg-amber-950/20 p-4 text-sm text-amber-200">Nenhuma integração validada por esta tela. Estados abaixo são inventário técnico, não monitoramento em tempo real.</div><div className="grid gap-4 xl:grid-cols-[460px_1fr]"><Panel title="Saúde das integrações"><div className="space-y-2">{INTEGRATIONS.map(([name, type, status]) => <button type="button" key={name} onClick={() => setSelected(name)} className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left ${selected === name ? 'border-sky-500 bg-sky-950/30' : 'border-slate-800 bg-slate-950/40 hover:border-sky-800'}`}><span><strong className="block">{name}</strong><span className="text-xs text-slate-500">{type}</span></span><Badge tone={status.includes('Não') || status.includes('não') ? 'pending' : 'info'}>{status}</Badge></button>)}</div></Panel><div className="space-y-4"><Panel title={selected} right={<Badge tone="pending">Somente inventário</Badge>}><dl className="grid gap-3 text-sm sm:grid-cols-2"><Info label="Ambiente">Não exposto</Info><Info label="Credenciais">Protegidas / não exibidas</Info><Info label="Última verificação">Não executada</Info><Info label="Responsável">A definir</Info></dl></Panel><Panel title="Eventos e sincronização"><EmptyState icon={Activity} title="Telemetria ainda não conectada" description="Quando houver endpoint de saúde e auditoria, esta área mostrará falhas, latência, tentativas e última sincronização reais." /></Panel></div></div></div>;
}

function SettingsPreview({ localDemo = false }) {
  const [section, setSection] = useState('Identidade');
  const [form, setForm] = useState(null);
  const [state, setState] = useState({ loading: true, saving: false, error: '', success: '' });
  const sections = ['Identidade', 'Localização', 'Aparência', 'Notificações', 'Governança'];
  useEffect(() => {
    if (localDemo) {
      setForm(readDemoSettings());
      setState((old) => ({ ...old, loading: false }));
      return undefined;
    }
    let active = true;
    getAdminSettings().then((value) => { if (active) { setForm(value); setState((old) => ({ ...old, loading: false })); } }).catch((reason) => { if (active) setState({ loading: false, saving: false, success: '', error: reason.status === 401 ? 'Entre com uma sessão real para editar as configurações do tenant.' : 'Não foi possível carregar as configurações.' }); });
    return () => { active = false; };
  }, []);
  async function save() {
    setState((old) => ({ ...old, saving: true, error: '', success: '' }));
    if (localDemo) {
      window.localStorage.setItem(ADMIN_DEMO_SETTINGS_KEY, JSON.stringify(form));
      setState({ loading: false, saving: false, error: '', success: 'Configurações locais salvas.' });
      return;
    }
    try {
      const updated = await updateAdminSettings(form);
      setForm(updated);
      setState({ loading: false, saving: false, error: '', success: 'Configurações salvas e auditadas.' });
    } catch (reason) {
      setState({ loading: false, saving: false, success: '', error: reason.message || 'Não foi possível salvar as configurações.' });
    }
  }
  const change = (key) => (event) => setForm((old) => ({ ...old, [key]: event.target.value }));
  return <div className="space-y-4"><PageLead title="Configurações administrativas" description="Parâmetros organizacionais com autorização, validação, persistência e auditoria por tenant." action={<Button onClick={save} disabled={!form || state.saving}>{state.saving ? 'Salvando...' : 'Salvar configurações'}</Button>} />{state.error && <div role="alert" className="rounded-lg border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-300">{state.error}</div>}{state.success && <div role="status" className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-3 text-sm text-emerald-300">{state.success}</div>}<div className="grid gap-4 xl:grid-cols-[280px_1fr]"><Panel title="Seções"><div className="space-y-2">{sections.map((item) => <button type="button" key={item} onClick={() => setSection(item)} className={`w-full rounded-lg border px-3 py-3 text-left text-sm ${section === item ? 'border-sky-500 bg-sky-950/30 text-sky-200' : 'border-slate-800 text-slate-400 hover:border-sky-800'}`}>{item}</button>)}</div></Panel><div className="space-y-4"><Panel title="Identidade da organização" right={<Badge tone={form ? 'success' : 'pending'}>{form ? 'Conectada' : 'Sem sessão'}</Badge>}>{state.loading ? <Loading label="Carregando configurações..." /> : form ? <div className="grid gap-4 sm:grid-cols-2"><EditableField label="Nome da organização" value={form.organization_name} onChange={change('organization_name')} /><EditableField label="Idioma" value={form.locale} onChange={change('locale')} /><EditableField label="Fuso horário" value={form.timezone} onChange={change('timezone')} /><label className="text-xs text-slate-500">Formato de data<select aria-label="Formato de data" value={form.date_format} onChange={change('date_format')} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"><option>DD/MM/YYYY</option><option>MM/DD/YYYY</option><option>YYYY-MM-DD</option></select></label></div> : <EmptyState icon={LockKeyhole} title="Sessão administrativa necessária" description="A edição não usa dados simulados e exige uma sessão autenticada com permissão de gerenciamento." />}</Panel><Panel title={`${section} · governança`}><div className="grid gap-3 sm:grid-cols-2"><SecurityLine label="Escopo" value="Tenant selecionado" /><SecurityLine label="Autorização" value="permissions.manage" /><SecurityLine label="Validação" value="Servidor" /><SecurityLine label="Auditoria" value="settings.updated" /></div></Panel></div></div></div>;
}

function EditableField({ label, value, onChange }) {
  return <label className="text-xs text-slate-500">{label}<input required value={value} onChange={onChange} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-sky-500 focus:outline-none" /></label>;
}

function DemoTable({ headers, rows }) {
  return <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-900 text-slate-500"><tr>{headers.map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-b border-slate-800 text-slate-300">{row.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-2">{cell}</td>)}</tr>)}</tbody></table></div>;
}

function Preparing({ tab }) {
  const [section, setSection] = useState('Visão geral');
  const configs = {
    'Perfis e Funções 2': ['Perfis cadastrados', 'Resumo do perfil', ['Permissões liberadas', 'Usuários vinculados', 'Funções associadas']],
    'Permissões 2': ['Matriz de permissões', 'Resumo do perfil', ['Permitidas', 'Negadas', 'Herdadas']],
    'Equipes, Setores e Unidades 2': ['Estrutura da organização', 'Detalhes da equipe', ['Membros', 'Unidade vinculada', 'Setores associados']],
    'Formulários 2': ['Formulários cadastrados', 'Pré-visualização do formulário', ['Ativos', 'Rascunhos', 'Respostas']],
    'Importações 2': ['Histórico de importações', 'Mapeamento e validação', ['Concluídas', 'Com alerta', 'Com erro']],
    'Segurança 2': ['Política de segurança', 'Sessões e tentativas de acesso', ['MFA', 'Contas bloqueadas', 'Sessões ativas']],
  };
  const config = configs[tab];
  if (!config) return <Panel title={tab}><EmptyState icon={LockKeyhole} title="Área em preparação" description="A estrutura foi reservada para revisão, mas nenhuma ação fictícia foi habilitada. Ela será conectada ao backend no próximo lote." /></Panel>;
  const [listTitle, detailTitle, stats] = config;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-50">{tab}</h2><p className="mt-1 text-sm text-slate-400">Estrutura visual baseada nas referências aprovadas.</p></div><Badge tone="pending">Prévia visual · dados não conectados</Badge></div>
    <div className="grid gap-3 sm:grid-cols-3">{stats.map((label) => <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-3 text-2xl font-bold text-slate-400">—</p><p className="mt-1 text-xs text-slate-600">Aguardando integração</p></div>)}</div>
    <div className="grid gap-4 xl:grid-cols-[0.8fr_1.7fr]">
      <Panel title={listTitle}><div className="mb-3 h-10 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-600">Buscar...</div><PreviewRows /></Panel>
      <Panel title={detailTitle}><div className="mb-4 flex flex-wrap gap-2">{['Visão geral', 'Acessos', 'Configurações', 'Histórico'].map((label) => <button type="button" onClick={() => setSection(label)} key={label} className={`rounded-lg px-3 py-2 text-xs ${section === label ? 'bg-sky-500 text-slate-950' : 'border border-slate-800 text-slate-500 hover:border-sky-700 hover:text-slate-300'}`}>{label}</button>)}</div><p className="mb-3 text-xs text-sky-400">Seção selecionada: {section}</p><div className="grid gap-3 sm:grid-cols-2"><PreviewBlock title="Resumo" /><PreviewBlock title="Escopo e vínculos" /><PreviewBlock title="Módulos e permissões" /><PreviewBlock title="Atividade recente" /></div></Panel>
    </div>
    <p className="rounded-xl border border-amber-900/60 bg-amber-950/20 px-4 py-3 text-xs text-amber-300">Nenhum botão de criação ou alteração foi habilitado nesta prévia. As regras de acesso dos gestores serão definidas antes da integração.</p>
  </div>;
}

function PreviewRows() {
  const [selected, setSelected] = useState(1);
  return <div className="space-y-2">{[1, 2, 3, 4, 5].map((row) => <button type="button" aria-label={`Selecionar item ${row}`} onClick={() => setSelected(row)} key={row} className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left ${selected === row ? 'border-sky-500 bg-sky-950/30' : 'border-slate-800 bg-slate-950/40 hover:border-sky-800'}`}><span className="h-9 w-9 rounded-lg bg-sky-950 ring-1 ring-sky-900" /><span className="flex-1"><span className="block h-2.5 w-2/3 rounded bg-slate-700" /><span className="mt-2 block h-2 w-1/2 rounded bg-slate-800" /></span><span className="text-slate-500">›</span></button>)}</div>;
}

function PreviewBlock({ title }) {
  const [open, setOpen] = useState(false);
  return <button type="button" onClick={() => setOpen((value) => !value)} className={`min-h-28 rounded-xl border p-4 text-left ${open ? 'border-sky-500 bg-sky-950/20' : 'border-slate-800 bg-slate-950/40 hover:border-sky-800'}`}><p className="text-sm font-semibold text-slate-300">{title}</p><div className="mt-4 space-y-2"><span className="block h-2 w-full rounded bg-slate-800" /><span className="block h-2 w-4/5 rounded bg-slate-800" /><span className="block h-2 w-3/5 rounded bg-slate-800" /></div>{open && <p className="mt-3 text-xs text-sky-400">Selecionado para a próxima etapa de integração.</p>}</button>;
}
