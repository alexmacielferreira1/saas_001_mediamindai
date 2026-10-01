import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity, AlertTriangle, LayoutDashboard, LockKeyhole, Search, ShieldCheck,
  UserCog, Users,
} from 'lucide-react';
import { getAdminUser, listAdminActivity, listAdminUsers, suspendAdminUser } from '../../api/admin';
import { listPermissionGroups } from '../../api/permissions';
import AdminAcessosPage from '../components/corp/roles/AdminAcessosPage';
import Acervo from './Acervo';
import Management from './Management';
import { Badge, Button, EmptyState, Loading, Panel, SearchInput, Stat, Tabs } from '../ui';

const CORE_TABS = [
  { key: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
  { key: 'users', label: 'Usuários', icon: Users },
  { key: 'access', label: 'Acessos por Função', icon: UserCog },
  { key: 'profiles', label: 'Perfis e Funções' },
  { key: 'permissions', label: 'Permissões' },
  { key: 'teams', label: 'Equipes' },
  { key: 'forms', label: 'Formulários' },
  { key: 'imports', label: 'Importações' },
  { key: 'security', label: 'Segurança', icon: LockKeyhole },
];

const RELATED_TABS = [
  { key: 'archive', label: 'Acervo 2' }, { key: 'management', label: 'Gestão 2' },
  { key: 'registry', label: 'Telas e Módulos 2' }, { key: 'records', label: 'Cadastros 2' },
  { key: 'integrations', label: 'Integrações 2' }, { key: 'settings', label: 'Configurações 2' },
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
  const [groups, setGroups] = useState([]);
  const [activity, setActivity] = useState([]);

  async function load(filters = {}) {
    setError('');
    try {
      const [users, permissionGroups, events] = await Promise.all([
        listAdminUsers({ page: 1, pageSize: 100, search: '', status: '', ...filters }),
        listPermissionGroups().catch(() => []),
        listAdminActivity().catch(() => []),
      ]);
      setPayload(users); setGroups(permissionGroups); setActivity(events);
    } catch {
      setPayload(ADMIN_DEMO_PAYLOAD);
      setGroups(ADMIN_DEMO_GROUPS);
      setActivity([]);
      setError('API indisponível: exibindo dados de demonstração para manter a prévia navegável.');
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
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-50">Administração 2</h1>
            <Badge tone="violet">Prévia paralela</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-400">Nova área para revisão, sem substituir a Administração atual.</p>
        </div>
        <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
          {error ? 'Prévia navegável com dados de demonstração' : 'Dados de usuários conectados ao tenant selecionado'}
        </div>
      </header>

      <AdminTabs label="Navegação principal da Administração 2" tabs={CORE_TABS} active={active} onChange={openTab} />
      <AdminTabs label="Áreas relacionadas" tabs={RELATED_TABS} active={active} onChange={openTab} compact />
      {error && <div role="alert" className="rounded-xl border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-300">{error}</div>}
      {!payload && !error ? <Loading label="Carregando Administração 2..." /> : null}
      {payload && active === 'overview' && <Overview payload={payload} groups={groups} activity={activity} onOpenTab={openTab} />}
      {active === 'users' && <UsersTab initialPayload={payload} onReload={load} />}
      {active === 'archive' && <EmbeddedArea title="Acervo 2"><Acervo /></EmbeddedArea>}
      {active === 'management' && <EmbeddedArea title="Gestão 2"><Management /></EmbeddedArea>}
      {active === 'access' && <AdminAcessosPage />}
      {active === 'profiles' && <ProfilesTab groups={groups} users={payload?.items || []} />}
      {active === 'permissions' && <PermissionsTab groups={groups} />}
      {active === 'teams' && <TeamsPreview />}
      {active === 'forms' && <FormsPreview />}
      {active === 'imports' && <ImportsPreview />}
      {active === 'security' && <SecurityPreview users={payload?.items || []} />}
      {!['overview', 'users', 'archive', 'management', 'access', 'profiles', 'permissions', 'teams', 'forms', 'imports', 'security'].includes(active) && <Preparing tab={ALL_TABS.find((tab) => tab.key === active)?.label} />}
    </div>
  );
}

function Overview({ payload, groups, activity, onOpenTab }) {
  const activeUsers = payload.items.filter((item) => item.status === 'active').length;
  const invited = payload.items.filter((item) => item.status === 'invited').length;
  const suspended = payload.items.filter((item) => item.status === 'suspended').length;
  const blocked = payload.items.filter((item) => item.status === 'blocked').length;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <button type="button" onClick={() => onOpenTab('users')} className="text-left"><Stat title="Usuários no tenant" value={payload.total} icon={Users} tone="sky" /></button>
        <Stat title="Usuários ativos" value={activeUsers} icon={ShieldCheck} tone="emerald" />
        <Stat title="Convites pendentes" value={invited} icon={UserCog} tone="sky" />
        <Stat title="Suspensos" value={suspended} icon={AlertTriangle} tone="amber" />
        <Stat title="Bloqueados" value={blocked} icon={LockKeyhole} tone="rose" />
        <Stat title="Perfis" value={groups.length} icon={Activity} tone="violet" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
        <Panel title="Ações rápidas">
          <p className="mb-4 text-xs text-slate-500">Acesse as tarefas administrativas mais comuns.</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ['Novo usuário', 'Cadastre uma conta', 'users'],
              ['Convidar usuário', 'Gerencie convites', 'users'],
              ['Novo perfil', 'Configure acessos', 'profiles'],
              ['Nova importação', 'Importe dados em lote', 'imports'],
              ['Novo formulário', 'Colete informações', 'forms'],
            ].map(([title, text, target]) => <button type="button" key={title} onClick={() => onOpenTab(target)} className="min-h-24 rounded-xl border border-sky-900/70 bg-sky-950/20 p-4 text-left transition hover:border-sky-500 hover:bg-sky-950/40"><p className="font-semibold text-sky-300">{title}</p><p className="mt-1 text-xs text-slate-500">{text}</p></button>)}
          </div>
        </Panel>
        <Panel title="Alertas administrativos">
          <div className="space-y-2">
            <AlertLine tone={blocked ? 'rose' : 'emerald'} text={blocked ? `${blocked} conta(s) bloqueada(s)` : 'Nenhuma conta bloqueada no tenant'} />
            <AlertLine tone={suspended ? 'amber' : 'emerald'} text={suspended ? `${suspended} conta(s) suspensa(s)` : 'Nenhuma conta suspensa no tenant'} />
            <AlertLine tone="sky" text="Perfis de gestores aguardam definição de escopo" />
          </div>
        </Panel>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
        <Panel title="Últimas ações administrativas">
          <div className="divide-y divide-slate-800">{activity.length ? activity.slice(0, 6).map((item) => <div key={item.id} className="py-3"><p className="font-semibold text-slate-200">{auditLabel(item.action)}</p><p className="mt-1 text-xs text-slate-500">{item.entity_type || 'Sistema'} · {item.created_date ? new Date(item.created_date).toLocaleString('pt-BR') : 'horário não informado'}</p></div>) : <p className="py-6 text-sm text-slate-500">Nenhuma ação administrativa registrada.</p>}</div>
        </Panel>
        <Panel title="Status de segurança">
          <div className="space-y-2"><SecurityLine label="Auditoria administrativa" value="Operacional" /><SecurityLine label="Contas bloqueadas" value={String(blocked)} /><SecurityLine label="MFA para administradores" value="Não integrado" /><SecurityLine label="Política de senha" value="Não integrada" /></div>
        </Panel>
      </div>
    </div>
  );
}

function auditLabel(action = '') {
  const labels = { 'user.suspended': 'Usuário suspenso', 'record.created': 'Registro criado', 'record.updated': 'Registro atualizado', 'records.bulk_created': 'Registros importados' };
  return labels[action] || action.replaceAll('.', ' ') || 'Ação administrativa';
}

function ProfilesTab({ groups, users }) {
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
  return <nav aria-label={label} className={`overflow-x-auto border border-slate-800 bg-slate-950/40 ${compact ? '-mt-3 rounded-lg p-1' : 'rounded-xl p-1.5'}`}><div className="flex min-w-max gap-1">{tabs.map((tab) => { const Icon = tab.icon; return <button key={tab.key} type="button" onClick={() => onChange(tab.key)} className={`flex shrink-0 items-center gap-2 rounded-lg font-medium transition ${compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'} ${active === tab.key ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}>{Icon && <Icon size={15} />}{tab.label}</button>; })}</div></nav>;
}

function AlertLine({ tone, text }) {
  const colors = { rose: 'border-rose-900/70 text-rose-300', amber: 'border-amber-900/70 text-amber-300', emerald: 'border-emerald-900/70 text-emerald-300', sky: 'border-sky-900/70 text-sky-300' };
  return <div className={`rounded-lg border bg-slate-950/60 px-3 py-2 text-sm ${colors[tone]}`}>{text}</div>;
}

function SecurityLine({ label, value }) {
  return <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2"><span className="text-sm text-slate-300">{label}</span><Badge tone={value === 'Operacional' || value === '0' ? 'success' : 'pending'}>{value}</Badge></div>;
}

function UsersTab({ initialPayload, onReload }) {
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
    setLoading(true);
    try { setPayload(await listAdminUsers({ page: 1, pageSize: 100, search, status })); } finally { setLoading(false); }
  }

  async function openUser(id) {
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
          <div className="space-y-2"><AlertLine tone="amber" text="3 acessos temporários vencem nesta semana" /><AlertLine tone="sky" text="Revise perfis com escopo temporário" /></div>
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
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-slate-50">{user.full_name || user.email}</h2><p className="text-sm text-slate-400">{user.email}</p><p className="mt-2 text-xs text-slate-500">Função: {user.tenant_role} · Perfil: {user.profile_name || 'não atribuído'}</p></div>{user.status === 'active' && <Button variant="danger" loading={working} onClick={suspend}>Suspender usuário</Button>}</div>
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
  return <section className="rounded-2xl border border-sky-900/50 bg-slate-950/30 p-4"><div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-400">Dentro da Administração 2</p><h2 className="mt-1 text-lg font-bold text-slate-100">{title}</h2></div><Badge tone="violet">Prévia 2</Badge></div>{children}</section>;
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

function DemoMetric({ label, value, tone = 'sky' }) {
  const colors = { sky: 'text-sky-300', emerald: 'text-emerald-300', amber: 'text-amber-300', rose: 'text-rose-300' };
  return <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-4"><p className="text-xs text-slate-500">{label}</p><p className={`mt-2 text-2xl font-bold ${colors[tone]}`}>{value}</p></div>;
}

function TeamsPreview() {
  const [selected, setSelected] = useState('Audiovisual');
  return <div className="space-y-4"><PageLead title="Equipes / Setores / Unidades" description="Estrutura operacional, responsáveis e vínculos da organização." action={<Button disabled>+ Nova equipe</Button>} /><PreviewNotice /><div className="grid gap-4 xl:grid-cols-[340px_1fr]"><Panel title="Equipes da organização"><SearchInput placeholder="Buscar equipe ou responsável" value="" readOnly /><div className="mt-3 space-y-2">{DEMO_TEAMS.map(([name, count, lead]) => <button type="button" key={name} onClick={() => setSelected(name)} className={`w-full rounded-lg border p-3 text-left ${selected === name ? 'border-sky-500 bg-sky-950/30' : 'border-slate-800 bg-slate-950/40'}`}><div className="flex justify-between"><strong>{name}</strong><span className="text-sky-400">›</span></div><p className="text-xs text-slate-400">{count}</p><p className="text-xs text-slate-500">Responsável: {lead}</p></button>)}</div></Panel><div className="space-y-4"><Panel title={selected} right={<Badge tone="success">Ativa</Badge>}><div className="grid gap-3 sm:grid-cols-4"><DemoMetric label="Membros" value="11" /><DemoMetric label="Unidade" value="Produção" /><DemoMetric label="Setores" value="2" /><DemoMetric label="Funções" value="5" /></div></Panel><Panel title="Membros da equipe"><DemoTable headers={['Nome', 'Função', 'Perfil', 'Status']} rows={[["Rafael Lima", 'Coordenador', 'Administrador', 'Ativo'], ['Marina Souza', 'Videomaker', 'Usuário', 'Ativo'], ['Bruno Carvalho', 'Editor de vídeo', 'Usuário', 'Ativo'], ['Larissa Fernandes', 'Motion Designer', 'Usuário', 'Ativo']]} /></Panel></div></div></div>;
}

function FormsPreview() {
  const forms = [['Cadastro de convidado', 'Público', '243 respostas'], ['Autorização de imagem', 'Público', '189 respostas'], ['Novo programa', 'Interno', 'Rascunho'], ['Solicitação de mídia', 'Público', '67 respostas']];
  return <div className="space-y-4"><PageLead title="Formulários" description="Formulários conectados às entidades administrativas." action={<Button disabled>+ Novo formulário</Button>} /><PreviewNotice /><div className="grid gap-3 sm:grid-cols-4"><DemoMetric label="Ativos" value="9" tone="emerald" /><DemoMetric label="Rascunhos" value="3" /><DemoMetric label="Externos" value="4" /><DemoMetric label="Respostas no mês" value="126" /></div><div className="grid gap-4 xl:grid-cols-[360px_1fr]"><Panel title="Formulários cadastrados"><div className="space-y-2">{forms.map(([name, scope, count], index) => <button key={name} className={`w-full rounded-lg border p-3 text-left ${index === 0 ? 'border-sky-500 bg-sky-950/30' : 'border-slate-800 bg-slate-950/40'}`}><strong>{name}</strong><p className="mt-1 text-xs text-slate-500">{scope} · {count}</p></button>)}</div></Panel><Panel title="Pré-visualização do formulário"><div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5"><h3 className="text-lg font-bold">Cadastro de convidado</h3><p className="text-sm text-slate-400">Preencha seus dados para participar do evento.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{['Nome completo', 'E-mail', 'Telefone', 'Empresa'].map((label) => <label key={label} className="text-xs text-slate-400">{label}<input disabled placeholder={label} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2" /></label>)}</div><label className="mt-3 block text-xs text-slate-400">Observações<textarea disabled className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-3" /></label><Button disabled className="mt-4 w-full">Enviar formulário</Button></div></Panel></div></div>;
}

function ImportsPreview() {
  return <div className="space-y-4"><PageLead title="Importação de Dados" description="Upload, mapeamento, validação e relatório antes da gravação." action={<Button disabled>+ Nova importação</Button>} /><PreviewNotice /><div className="grid gap-3 sm:grid-cols-4"><DemoMetric label="Importações no mês" value="4" /><DemoMetric label="Última concluída" value="Hoje" tone="emerald" /><DemoMetric label="Erros pendentes" value="11" tone="rose" /><DemoMetric label="Modelos salvos" value="2" /></div><div className="grid gap-4 xl:grid-cols-3"><Panel title="Arquivo e pré-visualização"><p className="rounded-lg border border-emerald-900 bg-emerald-950/20 p-3 text-sm text-emerald-300">usuarios_setembro.xlsx · arquivo processado</p><DemoTable headers={['Nome', 'E-mail', 'Equipe']} rows={[["Ana Souza", 'ana@empresa.com', 'Produto'], ['Bruno Martins', 'bruno@empresa.com', 'Tecnologia'], ['Carla Mendes', 'carla@empresa.com', 'Marketing']]} /></Panel><Panel title="Mapeamento de colunas"><div className="space-y-2">{[['Nome completo', 'name'], ['E-mail', 'email'], ['Equipe', 'team'], ['Cargo', 'job_title'], ['Status', 'status']].map(([source, target]) => <div key={source} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2 text-sm"><span>{source}</span><Badge tone="info">{target}</Badge></div>)}</div></Panel><Panel title="Resultado da validação"><div className="grid grid-cols-3 gap-2"><DemoMetric label="Válidas" value="468" tone="emerald" /><DemoMetric label="Alertas" value="21" tone="amber" /><DemoMetric label="Erros" value="11" tone="rose" /></div><div className="mt-3"><DemoTable headers={['Linha', 'Problema']} rows={[[12, 'E-mail inválido'], [28, 'Equipe não encontrada'], [47, 'Data inválida']]} /></div></Panel></div></div>;
}

function SecurityPreview({ users }) {
  const blocked = users.filter((user) => user.status === 'blocked').length;
  return <div className="space-y-4"><PageLead title="Segurança" description="Políticas, sessões e eventos de autenticação." /><PreviewNotice /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><DemoMetric label="MFA ativo" value="—" /><DemoMetric label="Usuários bloqueados" value={blocked} tone={blocked ? 'rose' : 'emerald'} /><DemoMetric label="Convites pendentes" value={users.filter((user) => user.status === 'invited').length} tone="amber" /><DemoMetric label="Sessões ativas" value="—" /><DemoMetric label="Tentativas (24h)" value="—" /></div><div className="grid gap-4 xl:grid-cols-2"><Panel title="Autenticação em duas etapas (MFA)"><div className="space-y-2">{['Superadmin', 'Administrador', 'Gestor de Acervo', 'Usuário padrão'].map((role, index) => <div key={role} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-3"><span>{role}</span><Badge tone={index < 2 ? 'pending' : 'info'}>{index < 2 ? 'Configuração pendente' : 'Opcional'}</Badge></div>)}</div></Panel><Panel title="Sessões ativas"><EmptyState icon={LockKeyhole} title="Sessões ainda não integradas" description="A visualização será ativada quando o endpoint de sessões estiver disponível." /></Panel></div><div className="grid gap-4 xl:grid-cols-2"><Panel title="Regras de bloqueio e proteção"><SecurityLine label="Bloqueio por tentativas" value="Não integrado" /><SecurityLine label="Tempo de bloqueio" value="Não integrado" /><SecurityLine label="Notificar administrador" value="Não integrado" /></Panel><Panel title="Histórico de segurança"><DemoTable headers={['Data', 'Evento', 'Usuário']} rows={[["Hoje", 'Auditoria operacional', 'sistema'], ['—', 'MFA', 'não integrado'], ['—', 'Sessões', 'não integrado']]} /></Panel></div></div>;
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
