import React, { useMemo, useState } from 'react';
import { AlertTriangle, ClipboardCheck, Eye, History, Settings, UserCheck, UserX, Users, X } from 'lucide-react';
import { Badge } from '../../ui';
import { areaAccessFor, auditActionLabel, moduleAccessFor, roleLabel } from './accessModel';
import { AccessPill, Avatar2, Card2, Empty2, formatDateTime, Metric2, Notice2, UnavailableButton } from './shared';

const STATUS = {
  active: ['Ativo', 'success'], invited: ['Convidado', 'info'], suspended: ['Suspenso', 'pending'],
  blocked: ['Bloqueado', 'error'], disabled: ['Desativado', 'error'], expired: ['Expirado', 'pending'],
};

export function PersonStatus({ value }) {
  const [label, tone] = STATUS[value] || [value || '—', 'info'];
  return <Badge tone={tone}>{label}</Badge>;
}

function isToday(value) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

// Imagem de referência: "Painel de gestão da equipe".
export function VisaoGeralEquipe2({ people, audit, errors, onOpenPerson }) {
  const active = people.filter((person) => person.status === 'active').length;
  const invited = people.filter((person) => person.status === 'invited');
  const suspended = people.filter((person) => ['suspended', 'blocked'].includes(person.status));
  const withExceptions = people.filter((person) => person.extra.length || person.restricted.length);
  const today = audit.filter((item) => isToday(item.created_date)).length;
  const attention = [
    ...invited.map((person) => ({ id: `inv-${person.id}`, person, text: 'Convite ainda não aceito', tone: 'amber' })),
    ...suspended.map((person) => ({ id: `sus-${person.id}`, person, text: 'Acesso suspenso ou bloqueado', tone: 'rose' })),
    ...people.filter((person) => !person.profileName && person.status === 'active').map((person) => ({ id: `prof-${person.id}`, person, text: 'Sem perfil de permissões vinculado', tone: 'sky' })),
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="rounded-lg border border-slate-800 px-3 py-2 text-xs text-slate-400">Hoje · {new Date().toLocaleDateString('pt-BR')}</span>
        <UnavailableButton icon={Eye}>Ver como usuário</UnavailableButton>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric2 label="Colaboradores ativos" value={errors.users && errors.memberships ? '—' : active} icon={Users} tone="sky" hint={`${people.length} pessoa(s) vinculada(s) à empresa`} />
        <Metric2 label="Convites pendentes" value={invited.length} icon={UserCheck} tone="amber" />
        <Metric2 label="Suspensos ou bloqueados" value={suspended.length} icon={UserX} tone="rose" />
        <Metric2 label="Alterações registradas hoje" value={errors.audit ? '—' : today} icon={History} tone="violet" hint={`${withExceptions.length} pessoa(s) com exceção individual`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card2 title="Equipe e entregas" description="Pessoas da empresa selecionada e seus acessos.">
          {people.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-slate-800 text-xs text-slate-500"><tr><th className="p-2">Pessoa</th><th className="p-2">Função</th><th className="p-2">Status</th><th className="p-2">Último acesso</th><th className="p-2">Ações</th></tr></thead>
                <tbody>
                  {people.map((person) => (
                    <tr key={person.id} className="border-b border-slate-800/60">
                      <td className="p-2"><div className="flex items-center gap-2"><Avatar2 name={person.name} size="sm" /><span className="font-medium text-slate-100">{person.name}</span></div></td>
                      <td className="p-2 text-slate-300">{roleLabel(person.role)}</td>
                      <td className="p-2"><PersonStatus value={person.status} /></td>
                      <td className="p-2 text-xs text-slate-400">{formatDateTime(person.lastAccess)}</td>
                      <td className="p-2"><button type="button" onClick={() => onOpenPerson(person)} className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:border-sky-600 hover:text-sky-300">Ver acessos</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty2 title="Nenhuma pessoa encontrada" description={errors.users || 'Não há usuários vinculados a esta empresa.'} />}
        </Card2>
        <Card2 title="Atenção do gestor" description="Itens reais que pedem revisão.">
          {attention.length ? (
            <ul className="space-y-2">
              {attention.slice(0, 8).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
                  <div className="flex items-center gap-2"><AlertTriangle size={14} className={item.tone === 'rose' ? 'text-rose-300' : item.tone === 'amber' ? 'text-amber-300' : 'text-sky-300'} aria-hidden="true" /><div><p className="text-sm text-slate-200">{item.text}</p><p className="text-xs text-slate-500">{item.person.name}</p></div></div>
                  <button type="button" onClick={() => onOpenPerson(item.person)} className="text-xs font-medium text-sky-300 hover:underline">Abrir</button>
                </li>
              ))}
            </ul>
          ) : <Empty2 title="Nada pendente" description="Nenhum convite, suspensão ou pessoa sem perfil." />}
        </Card2>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card2 title="Esteira da equipe" description="Rascunhos, edição, aprovação e finalizados por pessoa.">
          <Empty2 title="Indicadores por pessoa ainda não disponíveis" description="O servidor ainda não relaciona tarefas e entregas a cada colaborador. Nenhum número foi estimado." />
        </Card2>
        <Card2 title="Últimas alterações" description="Registros de auditoria do servidor.">
          {audit.length ? (
            <ul className="divide-y divide-slate-800">
              {audit.slice(0, 5).map((item) => <li key={item.id} className="flex justify-between gap-3 py-2 text-sm"><span className="text-slate-200">{auditActionLabel(item.action)}</span><span className="text-xs text-slate-500">{formatDateTime(item.created_date)}</span></li>)}
            </ul>
          ) : <Empty2 title="Nenhum registro" description={errors.audit || 'Ainda não há alterações registradas.'} />}
        </Card2>
      </div>
      <p className="text-center text-xs text-slate-500">Somente pessoas da empresa selecionada · dados do servidor</p>
    </div>
  );
}

// Imagem de referência: "Gestão de equipe e acessos" (tabela + painel "Ver como usuário").
export function Equipe2({ people, errors, onManage, currentUserName }) {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [viewing, setViewing] = useState(null);
  const roles = useMemo(() => [...new Set(people.map((person) => person.role).filter(Boolean))], [people]);
  const filtered = people.filter((person) => (!role || person.role === role)
    && [person.name, person.email, roleLabel(person.role), person.profileName].join(' ').toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <Card2 title="Minha equipe" description="Visualize e gerencie os membros da sua equipe.">
        <div className="mb-3 flex flex-wrap gap-2">
          <input type="search" aria-label="Buscar pessoa" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar pessoa, cargo ou perfil…" className="min-w-[220px] flex-1 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500" />
          <select aria-label="Filtrar por função" value={role} onChange={(event) => setRole(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-200">
            <option value="">Todas as funções</option>
            {roles.map((item) => <option key={item} value={item}>{roleLabel(item)}</option>)}
          </select>
        </div>
        {filtered.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-800 text-xs text-slate-500"><tr><th className="p-2">Nome</th><th className="p-2">Cargo</th><th className="p-2">Perfil</th><th className="p-2">Status</th><th className="p-2">Ações</th></tr></thead>
              <tbody>
                {filtered.map((person) => (
                  <tr key={person.id} className="border-b border-slate-800/60">
                    <td className="p-2"><div className="flex items-center gap-2"><Avatar2 name={person.name} size="sm" /><div><p className="font-medium text-slate-100">{person.name}</p><p className="text-xs text-slate-500">{person.email}</p></div></div></td>
                    <td className="p-2 text-slate-300">{roleLabel(person.role)}</td>
                    <td className="p-2 text-slate-400">{person.profileName || '—'}</td>
                    <td className="p-2"><PersonStatus value={person.status} /></td>
                    <td className="p-2"><div className="flex gap-2">
                      <button type="button" onClick={() => setViewing(person)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:border-sky-600"><Eye size={13} aria-hidden="true" />Ver como</button>
                      <button type="button" onClick={() => onManage(person)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:border-sky-600"><Settings size={13} aria-hidden="true" />Gerenciar acessos</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty2 title="Nenhuma pessoa encontrada" description={errors.users || errors.memberships || 'Ajuste a busca ou o filtro.'} />}
      </Card2>
      {viewing ? <VerComoPanel person={viewing} onClose={() => setViewing(null)} currentUserName={currentUserName} /> : (
        <Card2 title="Ver como usuário" description="Escolha uma pessoa para conferir as telas que ela acessa.">
          <Empty2 title="Nenhuma pessoa selecionada" description="Use “Ver como” na tabela." />
        </Card2>
      )}
    </div>
  );
}

function VerComoPanel({ person, onClose, currentUserName }) {
  const modules = moduleAccessFor(person.role).filter((module) => module.allowed);
  const areas = areaAccessFor(person.role, person.extra, person.restricted);
  return (
    <aside aria-label="Ver como usuário" className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/80 p-4">
      <div className="flex items-start justify-between gap-2">
        <div><h2 className="text-lg font-semibold text-slate-50">Ver como usuário</h2><p className="text-xs text-slate-400">Confira os acessos do colaborador mantendo sua identidade de gestor.</p></div>
        <button type="button" onClick={onClose} aria-label="Fechar painel" className="rounded-lg p-1 text-slate-400 hover:bg-slate-800"><X size={16} /></button>
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3"><Avatar2 name={person.name} /><div><p className="font-semibold text-slate-100">{person.name}</p><p className="text-xs text-slate-400">{roleLabel(person.role)}</p></div></div>
      <div className="rounded-lg border border-slate-800 p-3">
        <p className="mb-2 text-sm font-semibold text-slate-200">Telas disponíveis</p>
        <div className="flex flex-wrap gap-1.5">{modules.length ? modules.map((module) => <span key={module.id} className="rounded-lg bg-sky-500 px-2.5 py-1 text-xs font-medium text-slate-950">{module.label}</span>) : <span className="text-xs text-slate-500">Nenhuma tela de módulo liberada para esta função.</span>}</div>
      </div>
      <div className="rounded-lg border border-slate-800 p-3">
        <p className="mb-2 text-sm font-semibold text-slate-200">Origem dos acessos</p>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between"><span className="text-slate-400">Função</span><Badge tone="info">{roleLabel(person.role)}</Badge></div>
          <div className="flex items-center justify-between"><span className="text-slate-400">Perfil de permissões</span><Badge tone="info">{person.profileName || 'Nenhum'}</Badge></div>
          {areas.full ? <p className="text-slate-400">Acesso total às áreas da Produção (administrador).</p> : areas.rows.filter((row) => row.exception !== 'inherit').map((row) => <div key={row.id} className="flex items-center justify-between"><span className="text-slate-400">Exceção individual</span><AccessPill allowed={row.exception === 'allow'} label={row.label} /></div>)}
        </div>
      </div>
      <Notice2>Visualização respeita os acessos do colaborador e sua autoridade de gestor.</Notice2>
      <p className="text-xs text-slate-400">Você continua identificado como {currentUserName || 'você mesmo'}.</p>
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300">Cancelar</button><UnavailableButton variant="primary" icon={ClipboardCheck}>Abrir visualização</UnavailableButton></div>
    </aside>
  );
}
