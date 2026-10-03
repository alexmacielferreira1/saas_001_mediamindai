import { useEffect, useMemo, useRef, useState } from 'react';
import { ContextDetailLayout, SelectableItem, UnavailableAction } from './ContextDetailLayout';
import { MediaIdentity } from './MediaIdentity';

const statusLabels = { active: 'Ativo', invited: 'Convite pendente', suspended: 'Suspenso', blocked: 'Bloqueado' };

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '—';
}

function Status({ value }) {
  const colors = value === 'active' ? 'border-emerald-800 bg-emerald-950 text-emerald-300' : value === 'invited' ? 'border-amber-800 bg-amber-950 text-amber-300' : 'border-rose-800 bg-rose-950 text-rose-300';
  return <span className={`rounded-full border px-2 py-1 text-xs ${colors}`}>{statusLabels[value] || value}</span>;
}

export function UsersSection({ users = [], total = 0, demoMode = false, onSuspend, loadUser }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [overrides, setOverrides] = useState({});
  const originRefs = useRef({});
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    return users.map((user) => ({ ...user, ...overrides[user.id] })).filter((user) => (!status || user.status === status) && (!normalized || `${user.full_name} ${user.email} ${user.tenant_role}`.toLocaleLowerCase('pt-BR').includes(normalized)));
  }, [overrides, query, status, users]);
  const selected = visible.find((user) => user.id === selectedId) || null;
  useEffect(() => { if (selectedId && !visible.some((user) => user.id === selectedId)) setSelectedId(null); }, [selectedId, visible]);

  async function selectUser(user) {
    setSelectedId(user.id);
    if (!loadUser) return;
    const detail = await loadUser(user.id);
    if (detail) setOverrides((current) => ({ ...current, [user.id]: detail }));
  }

  async function suspendUser(user) {
    const updated = await onSuspend?.(user);
    if (updated) setOverrides((current) => ({ ...current, [user.id]: updated }));
  }

  const metrics = [
    ['Ativos', users.filter((item) => item.status === 'active').length],
    ['Convites', users.filter((item) => item.status === 'invited').length],
    ['Suspensos', users.filter((item) => item.status === 'suspended').length],
    ['Bloqueados', users.filter((item) => item.status === 'blocked').length],
    ['Total', total],
  ];

  const master = (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{metrics.map(([label, value]) => <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/55 p-3"><p className="text-xs text-slate-500">{label}</p><strong className="mt-1 block text-xl text-slate-100">{value}</strong></div>)}</div>
      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-800 bg-slate-950/45 p-3">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, e-mail ou função" className="min-w-64 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200" />
        <select aria-label="Filtrar usuários por status" value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-300"><option value="">Todos os status</option><option value="active">Ativos</option><option value="invited">Convites</option><option value="suspended">Suspensos</option><option value="blocked">Bloqueados</option></select>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/35">
        <table aria-label="Usuários do tenant" className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-900/80 text-xs text-slate-400"><tr><th className="p-3">Usuário</th><th className="p-3">Função</th><th className="p-3">Perfil</th><th className="p-3">Equipe / Setor</th><th className="p-3">Status</th><th className="p-3">Ações</th></tr></thead>
          <tbody>{visible.map((user) => <tr key={user.id} className={`border-b border-slate-800/70 ${selectedId === user.id ? 'bg-sky-950/30' : ''}`}><td className="p-3"><div className="flex items-center gap-2"><MediaIdentity src={user.avatar_url} alt={user.avatar_url ? user.full_name : ''} initials={initials(user.full_name || user.email)} /><span><strong className="block text-slate-100">{user.full_name || user.email}</strong><span className="text-xs text-slate-500">{user.email}</span></span></div></td><td className="p-3 text-slate-300">{user.tenant_role || '—'}</td><td className="p-3 text-slate-300">{user.profile_name || 'Sem perfil'}</td><td className="p-3 text-slate-500">{user.team_name || 'Não integrado'}</td><td className="p-3"><Status value={user.status} /></td><td className="p-3"><SelectableItem ref={(node) => { originRefs.current[user.id] = node; }} selected={selectedId === user.id} onSelect={() => selectUser(user)} aria-label={`Ver ${user.full_name || user.email}`} className="rounded-lg border border-sky-800 px-3 py-1.5 text-xs text-sky-300">Ver detalhe</SelectableItem></td></tr>)}</tbody>
        </table>
        {!visible.length && <p className="p-8 text-center text-sm text-slate-500">Nenhum usuário encontrado com estes filtros.</p>}
      </div>
    </div>
  );

  return <ContextDetailLayout master={master} detailTitle={selected?.full_name || selected?.email || 'Usuário'} isOpen={Boolean(selected)} onClose={() => setSelectedId(null)} originRef={{ current: selectedId ? originRefs.current[selectedId] : null }} detail={selected && <UserContextDetail user={selected} demoMode={demoMode} onSuspend={suspendUser} />} />;
}

function UserContextDetail({ user, demoMode, onSuspend }) {
  const [tab, setTab] = useState('Visão Geral');
  const tabs = ['Visão Geral', 'Acesso', 'Funções', 'Equipes', 'Módulos', 'Permissões', 'Segurança', 'Atividade', 'Histórico'];
  let content = <p className="mt-3 text-sm text-slate-500">Esta guia preserva o contexto do usuário. Os dados serão exibidos quando o contrato correspondente estiver disponível.</p>;
  if (tab === 'Visão Geral') content = <dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between gap-3"><dt className="text-slate-500">Função</dt><dd>{user.tenant_role || '—'}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Perfil</dt><dd>{user.profile_name || 'Sem perfil'}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Status</dt><dd><Status value={user.status} /></dd></div></dl>;
  if (tab === 'Módulos') content = <div className="mt-3 grid gap-3"><div><h4 className="text-sm font-medium text-slate-300">Telas adicionais</h4>{user.extra_screens?.length ? <p className="text-sm text-slate-400">{user.extra_screens.join(', ')}</p> : <p className="text-sm text-slate-500">Nenhuma tela extra liberada.</p>}</div><div><h4 className="text-sm font-medium text-slate-300">Telas restritas</h4>{user.restricted_screens?.length ? <p className="text-sm text-slate-400">{user.restricted_screens.join(', ')}</p> : <p className="text-sm text-slate-500">Nenhuma tela restrita.</p>}</div></div>;
  if (tab === 'Segurança') content = <dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between gap-3"><dt className="text-slate-500">Tentativas falhas</dt><dd>{user.failed_login_attempts ?? 0}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Bloqueio</dt><dd>{user.locked_until ? `Até ${new Date(user.locked_until).toLocaleString('pt-BR')}` : 'Sem bloqueio ativo'}</dd></div></dl>;
  return <div className="space-y-4"><div className="flex items-center gap-3"><MediaIdentity src={user.avatar_url} alt={user.avatar_url ? user.full_name : ''} initials={initials(user.full_name || user.email)} className="h-14 w-14" /><div><p className="text-xl font-bold text-slate-50">{user.full_name || user.email}</p><p className="text-sm text-slate-400">{user.email}</p></div></div><div className="flex gap-1 overflow-x-auto pb-1">{tabs.map((name) => <button key={name} type="button" onClick={() => setTab(name)} className={`shrink-0 rounded-lg px-2 py-1.5 text-xs ${tab === name ? 'bg-sky-500 text-slate-950' : 'bg-slate-900 text-slate-400'}`}>{name}</button>)}</div><section className="rounded-xl border border-slate-800 bg-slate-950/45 p-4"><h3 className="font-semibold text-slate-100">{tab}</h3>{content}</section>{user.status === 'active' && !demoMode && onSuspend ? <button type="button" onClick={() => onSuspend(user)} className="rounded-lg border border-rose-700 px-3 py-2 text-sm text-rose-300">Suspender usuário</button> : demoMode ? <p className="text-xs text-amber-300">Detalhe de demonstração — alterações reais de conta permanecem indisponíveis.</p> : null}</div>;
}

export function ProfilesSection({ groups = [], users = [] }) {
  const [profileId, setProfileId] = useState(groups[0]?.id || null);
  const [linkedUserId, setLinkedUserId] = useState(null);
  useEffect(() => { if (!profileId && groups[0]) setProfileId(groups[0].id); }, [groups, profileId]);
  const current = groups.find((group) => group.id === profileId) || groups[0];
  const linked = current ? users.filter((user) => user.profile_id === current.id) : [];
  const linkedUser = linked.find((user) => user.id === linkedUserId);
  if (!current) return <div className="grid gap-4 lg:grid-cols-2"><section className="rounded-xl border border-slate-800 p-6"><h3 className="font-semibold text-slate-100">Módulos liberados</h3><p className="mt-2 text-sm text-slate-500">Nenhum perfil cadastrado.</p></section><section className="rounded-xl border border-slate-800 p-6"><h3 className="font-semibold text-slate-100">Matriz resumida de permissões</h3><p className="mt-2 text-sm text-slate-500">Selecione ou cadastre um perfil para consultar a matriz.</p></section></div>;
  return <ContextDetailLayout isOpen detailTitle={linkedUser ? linkedUser.full_name : current.name} onClose={() => {}} master={<div className="space-y-2">{groups.map((group) => <SelectableItem key={group.id} selected={group.id === current.id} onSelect={() => { setProfileId(group.id); setLinkedUserId(null); }} className={`w-full rounded-xl border p-4 text-left ${group.id === current.id ? 'border-sky-500 bg-sky-950/30' : 'border-slate-800 bg-slate-950/40'}`}><strong className="block">{group.name}</strong><span className="text-xs text-slate-500">{group.permission_codes?.length || 0} permissões</span></SelectableItem>)}</div>} detail={linkedUser ? <div className="space-y-4"><p className="text-xl font-bold">{linkedUser.full_name}</p><p className="text-sm text-slate-400">{linkedUser.email}</p><button type="button" onClick={() => setLinkedUserId(null)} className="rounded-lg border border-sky-800 px-3 py-2 text-sm text-sky-300">Voltar ao perfil</button></div> : <div className="space-y-4"><p className="text-xl font-bold">{current.name}</p><p className="text-sm text-slate-400">{current.description || 'Sem descrição'}</p><div className="flex flex-wrap gap-2">{(current.permission_codes || []).map((code) => <span key={code} className="rounded-full border border-emerald-800 px-2 py-1 text-xs text-emerald-300">{code}</span>)}</div><section><h3 className="mb-2 font-semibold">Usuários vinculados</h3>{linked.length ? linked.map((user) => <button key={user.id} type="button" aria-label={`Abrir usuário ${user.full_name || user.email}`} onClick={() => setLinkedUserId(user.id)} className="mb-2 w-full rounded-lg border border-slate-800 p-3 text-left"><strong className="block text-sm">{user.full_name || user.email}</strong><span className="text-xs text-slate-500">{user.email}</span></button>) : <p className="text-sm text-slate-500">Nenhum usuário vinculado.</p>}</section><UnavailableAction reason="A edição exige endpoint administrativo específico.">Editar perfil</UnavailableAction></div>} />;
}

const teams = [
  { id: 'audiovisual', name: 'Audiovisual', description: 'Produção e edição de conteúdo audiovisual.', lead: 'Rafael Lima', members: [{ id: 'r1', name: 'Rafael Lima', email: 'rafael@empresa.com', role: 'Coordenador' }, { id: 'm1', name: 'Marina Souza', email: 'marina@empresa.com', role: 'Videomaker' }] },
  { id: 'jornalismo', name: 'Jornalismo', description: 'Reportagem e conteúdo editorial.', lead: 'Carlos Mendes', members: [{ id: 'c1', name: 'Carlos Mendes', email: 'carlos@empresa.com', role: 'Coordenador' }] },
];

export function TeamsSection() {
  const [teamId, setTeamId] = useState('audiovisual');
  const [memberId, setMemberId] = useState(null);
  const team = teams.find((item) => item.id === teamId) || teams[0];
  const member = team.members.find((item) => item.id === memberId);
  return <ContextDetailLayout isOpen detailTitle={member ? member.name : team.name} onClose={() => {}} master={<div className="space-y-2">{teams.map((item) => <SelectableItem key={item.id} selected={item.id === team.id} onSelect={() => { setTeamId(item.id); setMemberId(null); }} className={`w-full rounded-xl border p-4 text-left ${item.id === team.id ? 'border-sky-500 bg-sky-950/30' : 'border-slate-800 bg-slate-950/40'}`}><strong className="block">{item.name}</strong><span className="text-xs text-slate-500">{item.members.length} membros · Responsável: {item.lead}</span></SelectableItem>)}</div>} detail={member ? <div className="space-y-4"><p className="text-xl font-bold">{member.name}</p><p className="text-sm text-slate-400">{member.email} · {member.role}</p><button type="button" onClick={() => setMemberId(null)} className="rounded-lg border border-sky-800 px-3 py-2 text-sm text-sky-300">Voltar à equipe</button></div> : <div className="space-y-4"><p className="text-xl font-bold">{team.name}</p><p className="text-sm text-slate-400">{team.description}</p><div className="grid gap-2 sm:grid-cols-2"><div className="rounded-lg border border-slate-800 p-3"><span className="text-xs text-slate-500">Responsável</span><strong className="block">{team.lead}</strong></div><div className="rounded-lg border border-slate-800 p-3"><span className="text-xs text-slate-500">Membros</span><strong className="block">{team.members.length}</strong></div></div><section><h3 className="mb-2 font-semibold">Membros da equipe</h3>{team.members.map((item) => <button key={item.id} type="button" aria-label={`Abrir membro ${item.name}`} onClick={() => setMemberId(item.id)} className="mb-2 w-full rounded-lg border border-slate-800 p-3 text-left"><strong className="block text-sm">{item.name}</strong><span className="text-xs text-slate-500">{item.role}</span></button>)}</section><p className="text-xs text-amber-300">Dados de demonstração visual; gestão de equipes exige backend próprio.</p></div>} />;
}
