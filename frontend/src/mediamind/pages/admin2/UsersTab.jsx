import { useEffect, useMemo, useState } from 'react';
import { LockKeyhole, Search, Users } from 'lucide-react';
import {
  getAdminUser, listAdminUsers, reactivateAdminUser, revokeAdminUserSessions, suspendAdminUser,
} from '../../../api/admin';
import { UsersSection } from '../../components/admin2/PeopleAccessSections';
import { InfoRow, MetricTile, PageLead, TagList } from '../../components/admin2/ui/AdminBlocks';
import { tenantRoleLabel } from '../../lib/tenantRoleLabels';
import { Badge, Button, EmptyState, Panel, SearchInput, Tabs } from '../../ui';

const STATUS = {
  active: ['Ativo', 'success'],
  invited: ['Convidado', 'info'],
  suspended: ['Suspenso', 'pending'],
  blocked: ['Bloqueado', 'error'],
  disabled: ['Desativado', 'error'],
  expired: ['Expirado', 'pending'],
};

const VIEWS = [{ key: 'reference', label: 'Referência' }, { key: 'previous', label: 'Versão anterior' }];

const DETAIL_TABS = [
  ['overview', 'Visão Geral'], ['access', 'Acesso'], ['roles', 'Funções'], ['teams', 'Equipes'],
  ['modules', 'Módulos'], ['permissions', 'Permissões'], ['security', 'Segurança'],
  ['activity', 'Atividade'], ['history', 'Histórico'],
].map(([key, label]) => ({ key, label }));

const RESERVED_DETAIL_TABS = { teams: 'Equipes 2', activity: 'Atividade 2', history: 'Histórico 2' };

function UserStatus({ value }) {
  const [label, tone] = STATUS[value] || [value, 'info'];
  return <Badge tone={tone}>{label}</Badge>;
}

export default function UsersTab({ initialPayload, onReload, fallbackKind, initialStatus = '' }) {
  const [view, setView] = useState('reference');
  const users = initialPayload?.items || [];
  async function suspend(user) {
    if (!window.confirm(`Suspender ${user.full_name || user.email} nesta empresa? As sessões abertas nela serão encerradas.`)) return;
    const updated = await suspendAdminUser(user.id, 'Suspensão confirmada pelo administrador.');
    await onReload();
    return updated;
  }
  async function reactivate(user) {
    if (!window.confirm(`Reativar ${user.full_name || user.email} nesta empresa?`)) return;
    const updated = await reactivateAdminUser(user.id, 'Reativação confirmada pelo administrador.');
    await onReload();
    return updated;
  }
  async function revokeSessions(user) {
    if (!window.confirm(`Encerrar as sessões de ${user.full_name || user.email} nesta empresa?`)) return;
    return revokeAdminUserSessions(user.id, 'Encerramento de sessões confirmado pelo administrador.');
  }
  return (
    <div className="space-y-4">
      <PageLead title="Usuários" description="Contas, convites, perfis e atividade de acesso." />
      <Tabs tabs={VIEWS} active={view} onChange={setView} />
      {view === 'previous' ? (
        <LegacyUsersTab initialPayload={initialPayload} onReload={onReload} fallbackKind={fallbackKind} />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <Panel title="Convites pendentes">
              <p className="text-sm text-slate-400">
                {users.filter((user) => user.status === 'invited').length} convite(s) aguardando aceite.
              </p>
            </Panel>
            <Panel title="Acessos expirando">
              <p className="text-sm text-slate-500">Validade ainda não integrada ao contrato da lista.</p>
            </Panel>
          </div>
          <UsersSection
            users={users}
            total={initialPayload?.total || 0}
            initialStatus={initialStatus}
            demoMode={Boolean(fallbackKind)}
            loadUser={fallbackKind ? undefined : getAdminUser}
            onSuspend={suspend}
            onReactivate={reactivate}
            onRevokeSessions={revokeSessions}
          />
        </>
      )}
    </div>
  );
}

// Versão anterior da lista (subguia "Versão anterior"): preservada até a lista nova cobrir tudo.
function LegacyUsersTab({ initialPayload, onReload, fallbackKind }) {
  const [payload, setPayload] = useState(initialPayload);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const visible = useMemo(() => payload?.items || [], [payload]);
  const invited = visible.filter((user) => user.status === 'invited');

  useEffect(() => {
    if (initialPayload) setPayload(initialPayload);
  }, [initialPayload]);

  async function applyFilters(event) {
    event.preventDefault();
    if (fallbackKind) {
      const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
      setPayload({
        ...initialPayload,
        items: (initialPayload?.items || []).filter((user) => (
          (!status || user.status === status)
          && (!normalizedSearch || `${user.full_name} ${user.email}`.toLocaleLowerCase('pt-BR').includes(normalizedSearch))
        )),
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

  if (selected) {
    return <UserDetail user={selected} onChange={setSelected} onBack={() => setSelected(null)} onReload={onReload} />;
  }
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-50">Usuários</h2>
        <p className="text-sm text-slate-400">Contas, convites, perfis e atividade de acesso.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricTile compact label="Ativos" value={visible.filter((user) => user.status === 'active').length} tone="emerald" />
        <MetricTile compact label="Convites" value={invited.length} tone="amber" />
        <MetricTile compact label="Suspensos" value={visible.filter((user) => user.status === 'suspended').length} tone="rose" />
        <MetricTile compact label="Bloqueados" value={visible.filter((user) => user.status === 'blocked').length} tone="rose" />
        <MetricTile compact label="Total" value={payload?.total || 0} tone="sky" />
      </div>
      {fallbackKind && (
        <div role="status" className="rounded-lg border border-amber-800/60 bg-amber-950/20 px-3 py-2 text-xs text-amber-300">
          A busca e os detalhes funcionam localmente nesta demonstração. Alterações de conta exigem conexão com o backend.
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <Panel title="Usuários do tenant" right={<Badge tone="info">{payload?.total || 0} registros</Badge>}>
          <form onSubmit={applyFilters} className="mb-4 flex flex-wrap gap-2">
            <SearchInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar nome ou e-mail"
              className="min-w-64 flex-1"
            />
            <select
              aria-label="Filtrar por status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-300"
            >
              <option value="">Todos os estados</option>
              <option value="active">Ativos</option>
              <option value="suspended">Suspensos</option>
              <option value="blocked">Bloqueados</option>
            </select>
            <Button type="submit" loading={loading} icon={<Search size={15} />}>Filtrar</Button>
          </form>
          {visible.length === 0 ? (
            <EmptyState icon={Users} title="Nenhum usuário encontrado" description="Ajuste os filtros ou confira o tenant selecionado." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-800 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Usuário</th>
                    <th className="px-3 py-2">Função</th>
                    <th className="px-3 py-2">Perfil</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((user) => (
                    <tr key={user.id} className="border-b border-slate-800/70">
                      <td className="px-3 py-3">
                        <p className="font-medium text-slate-200">{user.full_name || user.email}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </td>
                      <td className="px-3 py-3 text-slate-400">{user.tenant_role}</td>
                      <td className="px-3 py-3 text-slate-400">{user.profile_name || 'Sem perfil'}</td>
                      <td className="px-3 py-3"><UserStatus value={user.status} /></td>
                      <td className="px-3 py-3 text-right">
                        <Button
                          aria-label={`Ver ${user.full_name || user.email}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => openUser(user.id)}
                        >
                          Ver detalhe
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <aside className="space-y-4">
          <Panel title="Convites pendentes">
            <div className="space-y-2">
              {invited.slice(0, 4).map((user) => (
                <button
                  type="button"
                  key={user.id}
                  onClick={() => openUser(user.id)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-left hover:border-sky-700"
                >
                  <p className="text-sm font-medium text-slate-200">{user.full_name || user.email}</p>
                  <p className="mt-1 text-xs text-slate-500">{user.email}</p>
                </button>
              ))}
              {!invited.length && <p className="text-sm text-slate-500">Nenhum convite aguardando aceite.</p>}
            </div>
          </Panel>
          <Panel title="Acessos expirando">
            <EmptyState
              icon={LockKeyhole}
              title="Validade ainda não integrada"
              description="O backend ainda não fornece datas de expiração para esta lista."
            />
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function UserDetail({ user, onChange, onBack, onReload }) {
  const [working, setWorking] = useState(false);
  const [detailTab, setDetailTab] = useState('overview');
  const [notice, setNotice] = useState('');
  const name = user.full_name || user.email;
  async function act(question, action) {
    if (!window.confirm(question)) return;
    setWorking(true); setNotice('');
    try { await action(); } catch (error) { setNotice(error?.message || 'Não foi possível concluir a ação.'); } finally { setWorking(false); }
  }
  const suspend = () => act(`Suspender ${name} nesta empresa? As sessões abertas nela serão encerradas.`, async () => {
    onChange(await suspendAdminUser(user.id, 'Suspensão confirmada pelo administrador.'));
    onReload();
  });
  const reactivate = () => act(`Reativar ${name} nesta empresa?`, async () => {
    onChange(await reactivateAdminUser(user.id, 'Reativação confirmada pelo administrador.'));
    onReload();
  });
  const revokeSessions = () => act(`Encerrar as sessões de ${name} nesta empresa?`, async () => {
    const { revoked_sessions: count } = await revokeAdminUserSessions(user.id, 'Encerramento de sessões confirmado pelo administrador.');
    setNotice(count ? `${count} sessão(ões) encerrada(s).` : 'Nenhuma sessão aberta nesta empresa.');
  });
  const accessSummary = (
    <>Função <strong className="text-slate-200">{user.tenant_role}</strong></>
  );
  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack}>← Voltar para usuários</Button>
      <Panel right={<UserStatus value={user.status} />}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-50">{name}</h2>
            <p className="text-sm text-slate-400">{user.email}</p>
            <p className="mt-2 text-xs text-slate-500">
              Função: {tenantRoleLabel(user.tenant_role)} · Perfil: {user.profile_name || 'não atribuído'}
            </p>
            {user.is_demo && <p className="mt-2 text-xs text-amber-300">Detalhe de demonstração — nenhuma alteração será enviada.</p>}
          </div>
          {!user.is_demo && (
            <div className="flex flex-wrap gap-2">
              {user.status === 'active' && (
                <>
                  <Button variant="ghost" loading={working} onClick={revokeSessions}>Encerrar sessões</Button>
                  <Button variant="danger" loading={working} onClick={suspend}>Suspender usuário</Button>
                </>
              )}
              {user.status === 'suspended' && <Button loading={working} onClick={reactivate}>Reativar usuário</Button>}
            </div>
          )}
        </div>
        {notice && <p role="status" className="mt-3 text-xs text-sky-200">{notice}</p>}
      </Panel>
      <Tabs tabs={DETAIL_TABS} active={detailTab} onChange={setDetailTab} />
      {detailTab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Conta">
            <dl className="space-y-2 text-sm">
              <InfoRow label="Estado"><UserStatus value={user.status} /></InfoRow>
              <InfoRow label="Criado em">
                {user.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : 'Não informado'}
              </InfoRow>
            </dl>
          </Panel>
          <Panel title="Vínculo atual">
            <p className="text-sm text-slate-400">
              {accessSummary}{user.profile_name ? ` com perfil ${user.profile_name}` : ' sem perfil adicional'}.
            </p>
          </Panel>
        </div>
      )}
      {['access', 'roles', 'permissions'].includes(detailTab) && (
        <Panel title="Acesso efetivo">
          <p className="text-sm text-slate-400">
            {accessSummary}{user.profile_name ? ` · Perfil ${user.profile_name}` : ' · Sem perfil adicional'}.
          </p>
          <p className="mt-2 text-xs text-amber-300">
            A separação entre gestor do canal, gestor do acervo e demais responsáveis ainda será definida.
          </p>
        </Panel>
      )}
      {detailTab === 'modules' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Telas adicionais">
            {user.extra_screens?.length ? <TagList items={user.extra_screens} /> : <p className="text-sm text-slate-500">Nenhuma tela extra liberada.</p>}
          </Panel>
          <Panel title="Telas restritas">
            {user.restricted_screens?.length ? <TagList items={user.restricted_screens} /> : <p className="text-sm text-slate-500">Nenhuma tela restrita.</p>}
          </Panel>
        </div>
      )}
      {detailTab === 'security' && (
        <Panel title="Segurança da conta">
          <dl className="space-y-3 text-sm">
            <InfoRow label="Estado"><UserStatus value={user.status} /></InfoRow>
            <InfoRow label="Tentativas falhas">{user.failed_login_attempts}</InfoRow>
            <InfoRow label="Bloqueio">
              {user.locked_until ? `Até ${new Date(user.locked_until).toLocaleString('pt-BR')}` : 'Sem bloqueio ativo'}
            </InfoRow>
          </dl>
        </Panel>
      )}
      {RESERVED_DETAIL_TABS[detailTab] && (
        <Panel title={RESERVED_DETAIL_TABS[detailTab]}>
          <EmptyState
            icon={LockKeyhole}
            title="Área em preparação"
            description="A estrutura foi reservada para revisão, mas nenhuma ação fictícia foi habilitada. Ela será conectada ao backend no próximo lote."
          />
        </Panel>
      )}
    </div>
  );
}
