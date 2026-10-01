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
      setError('Não foi possível carregar a Administração. Confira a API e tente novamente.');
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
          Dados de usuários conectados ao tenant selecionado
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
      {!['overview', 'users', 'archive', 'management', 'access', 'profiles', 'permissions'].includes(active) && <Preparing tab={ALL_TABS.find((tab) => tab.key === active)?.label} />}
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
        <Panel title="Ações administrativas">
          <p className="mb-4 text-xs text-slate-500">Atalhos para as áreas reais já conectadas nesta prévia.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[['Usuários 2', 'Contas, estados e detalhes', 'users'], ['Acervo 2', 'Mídias e bibliotecas', 'archive'], ['Gestão 2', 'Relatórios e operação', 'management']].map(([title, text, target]) => <button type="button" key={title} onClick={() => onOpenTab(target)} className="rounded-xl border border-sky-900/70 bg-sky-950/20 p-4 text-left transition hover:border-sky-500"><p className="font-semibold text-sky-300">{title}</p><p className="mt-1 text-xs text-slate-500">{text}</p></button>)}
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
  if (!groups.length) return <Panel title="Perfis e Funções 2"><EmptyState icon={UserCog} title="Nenhum perfil cadastrado" description="Crie os primeiros grupos na Administração atual para visualizá-los aqui." /></Panel>;
  const current = selected || groups[0];
  const linked = users.filter((user) => user.profile_id === current.id);
  return <div className="space-y-4"><div><h2 className="text-xl font-bold text-slate-50">Perfis e Funções 2</h2><p className="text-sm text-slate-400">Perfis reais do tenant e suas permissões efetivas.</p></div><div className="grid gap-4 xl:grid-cols-[0.75fr_1.5fr]"><Panel title={`Perfis cadastrados · ${groups.length}`}><div className="space-y-2">{groups.map((group) => <button type="button" key={group.id} onClick={() => setSelected(group)} className={`w-full rounded-xl border p-4 text-left ${current.id === group.id ? 'border-sky-500 bg-sky-950/30' : 'border-slate-800 bg-slate-950/40 hover:border-sky-800'}`}><div className="flex justify-between"><p className="font-semibold text-slate-100">{group.name}</p><Badge tone={group.is_active ? 'success' : 'error'}>{group.is_active ? 'Ativo' : 'Inativo'}</Badge></div><p className="mt-1 text-xs text-slate-500">{group.description || 'Sem descrição'}</p><p className="mt-2 text-xs text-sky-400">{group.permission_codes.length} permissões</p></button>)}</div></Panel><div className="space-y-4"><Panel title={current.name} right={<Badge tone="info">{linked.length} usuário(s)</Badge>}><p className="text-sm text-slate-400">{current.description || 'Perfil sem descrição.'}</p></Panel><Panel title="Permissões liberadas"><div className="flex flex-wrap gap-2">{current.permission_codes.length ? current.permission_codes.map((code) => <Badge key={code} tone="success">{code}</Badge>) : <span className="text-sm text-slate-500">Nenhuma permissão explícita.</span>}</div></Panel><Panel title="Usuários vinculados"><div className="space-y-2">{linked.length ? linked.map((user) => <div key={user.id} className="rounded-lg border border-slate-800 px-3 py-2"><p className="text-sm text-slate-200">{user.full_name || user.email}</p><p className="text-xs text-slate-500">{user.email}</p></div>) : <p className="text-sm text-slate-500">Nenhum usuário vinculado.</p>}</div></Panel></div></div></div>;
}

function PermissionsTab({ groups }) {
  const codes = [...new Set(groups.flatMap((group) => group.permission_codes))].sort();
  return <div className="space-y-4"><div><h2 className="text-xl font-bold text-slate-50">Permissões 2</h2><p className="text-sm text-slate-400">Matriz real de permissões por perfil.</p></div><Panel title="Matriz de permissões"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-slate-800 text-xs uppercase text-slate-500"><tr><th className="p-3">Permissão</th>{groups.map((group) => <th key={group.id} className="p-3">{group.name}</th>)}</tr></thead><tbody>{codes.map((code) => <tr key={code} className="border-b border-slate-800/60"><td className="p-3 font-medium text-slate-200">{code}</td>{groups.map((group) => <td key={group.id} className="p-3"><Badge tone={group.permission_codes.includes(code) ? 'success' : 'error'}>{group.permission_codes.includes(code) ? 'Permitido' : 'Negado'}</Badge></td>)}</tr>)}</tbody></table>{!codes.length && <p className="py-8 text-center text-sm text-slate-500">Nenhuma permissão cadastrada.</p>}</div></Panel></div>;
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
