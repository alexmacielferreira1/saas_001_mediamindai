import React, { useMemo, useState } from 'react';
import { ArrowRight, Check, Download, Eye, RotateCcw, Undo2 } from 'lucide-react';
import { Badge } from '../../ui';
import {
  areaAccessFor, auditActionLabel, auditReference, isAdminRole, moduleAccessFor, ROLE_OPTIONS, roleLabel,
} from './accessModel';
import { AccessPill, Avatar2, Card2, Empty2, formatDateTime, Notice2, UnavailableButton } from './shared';
import { auditChangeFields } from '../../lib/auditChange';

const EXCEPTION_LABEL = { inherit: 'Herdar', allow: 'Permitir', deny: 'Negar' };

function ReasonField({ id, value, onChange }) {
  return (
    <label htmlFor={id} className="block text-sm font-medium text-slate-200">
      Motivo da alteração
      <textarea id={id} maxLength={500} rows={2} value={value} onChange={(event) => onChange(event.target.value)} placeholder="Descreva o motivo (obrigatório quando a revisão estiver disponível)" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500" />
      <span className="block text-right text-xs text-slate-500">{value.length}/500</span>
    </label>
  );
}

// Imagens de referência: "Administração de acessos e telas" e "Revisão de acesso".
export function AcessosTelas2({ people, errors, selectedId, onSelect, currentUserName }) {
  const [reason, setReason] = useState('');
  const person = people.find((item) => item.id === selectedId) || people[0] || null;
  if (!person) return <Card2 title="Acessos e telas"><Empty2 title="Nenhuma pessoa para configurar" description={errors.memberships || errors.users || 'Não há pessoas vinculadas a esta empresa.'} /></Card2>;
  const modules = moduleAccessFor(person.role);
  const areas = areaAccessFor(person.role, person.extra, person.restricted);
  return (
    <div className="space-y-4">
      <nav aria-label="Contexto" className="text-xs text-slate-500">MediaMind AI <span className="mx-1">/</span> Empresa selecionada <span className="mx-1">/</span> {roleLabel(person.role)} <span className="mx-1">/</span> <span className="text-slate-200">{person.name}</span></nav>
      <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <Card2>
            <div className="flex flex-col items-center gap-2 text-center"><Avatar2 name={person.name} size="lg" /><p className="text-lg font-semibold text-slate-50">{person.name}</p><p className="text-xs text-slate-400">{roleLabel(person.role)}{person.profileName ? ` · ${person.profileName}` : ''}</p></div>
            <div className="mt-3 border-t border-slate-800 pt-3"><UnavailableButton icon={Eye} className="w-full">Ver como</UnavailableButton></div>
          </Card2>
          <Card2 title="Pessoas">
            <label className="sr-only" htmlFor="acessos2-pessoa">Pessoa</label>
            <select id="acessos2-pessoa" value={person.id} onChange={(event) => onSelect(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-200">
              {people.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Card2>
        </div>
        <Card2 title="Telas e ações" description="Como cada recurso se comporta para este usuário, considerando a função e as exceções individuais.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="border-b border-slate-800 text-xs text-slate-400"><tr><th className="p-2">Recurso</th><th className="p-2">Função {roleLabel(person.role)}</th><th className="p-2">Exceção individual</th><th className="p-2">Acesso efetivo</th></tr></thead>
              <tbody>
                {modules.map((module) => (
                  <tr key={module.id} className="border-b border-slate-800/60">
                    <td className="p-2 text-slate-100">{module.label}</td>
                    <td className="p-2"><AccessPill allowed={module.allowed} /></td>
                    <td className="p-2"><select disabled title="Exceção por módulo ainda não disponível no servidor" aria-label={`Exceção para ${module.label}`} className="cursor-not-allowed rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-400 opacity-70"><option>Herdar</option></select></td>
                    <td className="p-2"><AccessPill allowed={module.allowed} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="mb-2 mt-5 text-sm font-semibold text-slate-200">Áreas da Produção</h3>
          {areas.full ? <Notice2>Administradores acessam todas as áreas da Produção.</Notice2> : areas.rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="border-b border-slate-800 text-xs text-slate-400"><tr><th className="p-2">Área</th><th className="p-2">Padrão da função</th><th className="p-2">Exceção individual</th><th className="p-2">Acesso efetivo</th></tr></thead>
                <tbody>
                  {areas.rows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-800/60">
                      <td className="p-2 text-slate-100">{row.label}</td>
                      <td className="p-2"><AccessPill allowed={row.fromRole} /></td>
                      <td className="p-2"><Badge tone={row.exception === 'allow' ? 'success' : row.exception === 'deny' ? 'error' : 'info'}>{EXCEPTION_LABEL[row.exception]}</Badge></td>
                      <td className="p-2"><AccessPill allowed={row.effective} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty2 title="Nenhuma área da Produção definida" description="A função não tem áreas padrão e não há exceções individuais." />}
          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-200">Legenda de exceções</p>
              <ul className="space-y-1.5 text-xs text-slate-400">
                <li><Badge tone="info">Herdar</Badge> Segue a permissão da função.</li>
                <li><Badge tone="success">Permitir</Badge> Concede acesso a este usuário.</li>
                <li><Badge tone="error">Negar</Badge> Revoga o acesso deste usuário.</li>
              </ul>
            </div>
            <div className="space-y-2">
              <Notice2 tone="amber">Exceções valem somente para {person.name}. Não alteram a função {roleLabel(person.role)} nem afetam outros usuários.</Notice2>
              <ReasonField id="acessos2-motivo" value={reason} onChange={setReason} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <UnavailableButton icon={RotateCcw}>Restaurar padrão</UnavailableButton>
            <div className="text-right"><UnavailableButton variant="primary" icon={Check}>Revisar alterações</UnavailableButton><p className="mt-1 text-xs text-slate-500">Alteração será atribuída a {currentUserName || 'você'}.</p></div>
          </div>
        </Card2>
      </div>
    </div>
  );
}

// Imagem de referência: "Gestão de acessos por perfil".
export function PerfisAcesso2({ people, groups, errors }) {
  const [roleId, setRoleId] = useState('editor');
  const [reason, setReason] = useState('');
  const counts = useMemo(() => people.reduce((acc, person) => ({ ...acc, [person.role]: (acc[person.role] || 0) + 1 }), {}), [people]);
  const affected = people.filter((person) => person.role === roleId);
  const preserved = affected.filter((person) => person.extra.length || person.restricted.length).length;
  const modules = moduleAccessFor(roleId);
  const catalog = ROLE_OPTIONS.filter((role) => counts[role.id]);
  const hierarchy = [['Produto', true], ['Empresa', true], ['Departamento', false], ['Função', true], ['Usuário', true]];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs text-slate-400">Produto<select disabled className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-300"><option>MediaMind AI</option></select></label>
        <label className="text-xs text-slate-400">Empresa<select disabled className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-300"><option>Empresa selecionada</option></select></label>
        <label className="text-xs text-slate-400">Departamento<select disabled title="Departamentos ainda não existem no servidor" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-500"><option>Não disponível</option></select></label>
        <label className="text-xs text-slate-400">Função<select aria-label="Função" value={roleId} onChange={(event) => setRoleId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100">{ROLE_OPTIONS.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}</select></label>
      </div>
      <Card2 title="Hierarquia de configuração" description="Ordem em que os acessos são herdados. Níveis apagados ainda não existem no servidor.">
        <ol className="flex flex-wrap items-center gap-2 text-sm">
          {hierarchy.map(([label, available], index) => (
            <li key={label} className="flex items-center gap-2">
              {index > 0 && <ArrowRight size={14} className="text-slate-600" aria-hidden="true" />}
              <span className={`rounded-lg border px-3 py-1.5 ${available ? 'border-sky-800 bg-sky-950/40 text-sky-200' : 'border-slate-800 text-slate-500'}`} title={available ? undefined : 'Ainda não disponível'}>{label}</span>
            </li>
          ))}
        </ol>
      </Card2>
      <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <Card2 title="Catálogo de cargos e funções" description="Funções em uso nesta empresa.">
          {catalog.length ? (
            <ul className="space-y-1.5">
              {catalog.map((role) => (
                <li key={role.id}><button type="button" onClick={() => setRoleId(role.id)} className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${roleId === role.id ? 'border-sky-600 bg-sky-950/40 text-sky-100' : 'border-slate-800 text-slate-300 hover:border-slate-600'}`}><span>{role.label}</span><span className="text-xs text-slate-400">{counts[role.id]} pessoa(s) · {moduleAccessFor(role.id).filter((m) => m.allowed).length} telas</span></button></li>
              ))}
            </ul>
          ) : <Empty2 title="Nenhuma função em uso" description={errors.memberships || errors.users || 'Nenhuma pessoa vinculada.'} />}
          <h3 className="mb-2 mt-4 text-sm font-semibold text-slate-200">Perfis de permissões cadastrados</h3>
          {groups.length ? <div className="flex flex-wrap gap-1.5">{groups.map((group) => <Badge key={group.id} tone={group.is_active ? 'info' : 'error'}>{group.name} · {group.permission_codes?.length || 0}</Badge>)}</div> : <p className="text-xs text-slate-500">{errors.groups || 'Nenhum perfil cadastrado.'}</p>}
        </Card2>
        <Card2 title={`Telas da função ${roleLabel(roleId)}`} description={isAdminRole(roleId) ? 'Administradores acessam todas as telas.' : 'Telas liberadas pela função (regra aplicada hoje no frontend).'}>
          <div className="flex flex-wrap gap-2">
            {modules.map((module) => <span key={module.id} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${module.allowed ? 'border-sky-600 bg-sky-500/15 text-sky-200' : 'border-slate-800 text-slate-500'}`}>{module.allowed && <Check size={13} aria-hidden="true" />}{module.label}</span>)}
          </div>
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <p className="text-sm font-semibold text-slate-200">Alcance da alteração</p>
            <p className="mt-1 text-sm text-slate-300">{affected.length} colaborador(es) · {preserved} com exceção individual preservada</p>
            {affected.length > 0 && <p className="mt-1 text-xs text-slate-500">{affected.map((person) => person.name).join(', ')}</p>}
          </div>
          <div className="mt-3"><ReasonField id="perfis2-motivo" value={reason} onChange={setReason} /></div>
          <div className="mt-2 flex justify-end"><UnavailableButton variant="primary" icon={Check}>Revisar alteração da função</UnavailableButton></div>
        </Card2>
      </div>
    </div>
  );
}

const PERIODS = [['all', 'Todo o período'], ['1', 'Hoje'], ['7', 'Últimos 7 dias'], ['30', 'Últimos 30 dias']];

// Imagem de referência: "Histórico de alterações no MediaMind".
export function Historico2({ audit, people, errors }) {
  const [period, setPeriod] = useState('all');
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const names = useMemo(() => Object.fromEntries(people.map((person) => [person.id, person.name])), [people]);
  const actions = [...new Set(audit.map((item) => item.action).filter(Boolean))];
  const actors = [...new Set(audit.map((item) => item.user_id).filter(Boolean))];
  const limit = period === 'all' ? null : Date.now() - Number(period) * 86400000;
  const rows = audit.filter((item) => (!actor || item.user_id === actor) && (!action || item.action === action)
    && (!limit || new Date(item.created_date).getTime() >= limit));
  const selected = rows.find((item) => item.id === selectedId) || rows[0] || null;
  const who = (id) => names[id] || (id ? 'Usuário não listado' : 'Sistema');
  const affected = (item) => {
    if (item.target_user_id) return who(item.target_user_id);
    return item.entity_type === 'User' ? who(item.entity_id) : item.entity_type || '—';
  };
  // Campos próprios da auditoria (before/after/reason/actor_role/correlation_id), quando existirem.
  const change = selected ? auditChangeFields(selected) : [];
  const hasValues = change.some(([label]) => label === 'Antes' || label === 'Depois');
  const select = 'rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-200';
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <Card2 title="Histórico de alterações" description="Registros de auditoria gravados pelo servidor. Não podem ser editados nem apagados pela interface." right={<UnavailableButton icon={Download}>Exportar</UnavailableButton>}>
        <div className="mb-3 flex flex-wrap gap-2">
          <select aria-label="Período" value={period} onChange={(event) => setPeriod(event.target.value)} className={select}>{PERIODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select aria-label="Responsável" value={actor} onChange={(event) => setActor(event.target.value)} className={select}><option value="">Todos os responsáveis</option>{actors.map((id) => <option key={id} value={id}>{who(id)}</option>)}</select>
          <select aria-label="Ação" value={action} onChange={(event) => setAction(event.target.value)} className={select}><option value="">Todas as ações</option>{actions.map((item) => <option key={item} value={item}>{auditActionLabel(item)}</option>)}</select>
        </div>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="border-b border-slate-800 text-xs text-slate-400"><tr><th className="p-2">Hora</th><th className="p-2">Responsável</th><th className="p-2">Alvo</th><th className="p-2">Ação</th><th className="p-2">Resultado</th></tr></thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id} onClick={() => setSelectedId(item.id)} className={`cursor-pointer border-b border-slate-800/60 ${selected?.id === item.id ? 'bg-sky-950/30' : 'hover:bg-slate-800/40'}`}>
                    <td className="whitespace-nowrap p-2 text-xs text-slate-400">{formatDateTime(item.created_date)}</td>
                    <td className="p-2 text-slate-200">{who(item.user_id)}</td>
                    <td className="p-2 text-slate-300">{affected(item)}</td>
                    <td className="p-2 text-slate-100"><button type="button" onClick={() => setSelectedId(item.id)} className="text-left hover:underline">{auditActionLabel(item.action)}</button></td>
                    <td className="p-2"><Badge tone="success">Registrado</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty2 title="Nenhum registro encontrado" description={errors.audit || 'Ajuste os filtros ou aguarde novas alterações.'} />}
      </Card2>
      <Card2 title="Detalhes da alteração">
        {selected ? (
          <dl className="space-y-2 text-sm">
            {[
              ['Responsável', who(selected.user_id)], ['Alvo', affected(selected)], ['Tipo', selected.entity_type || '—'],
              ['Ação', auditActionLabel(selected.action)],
              ...(change.some(([label]) => label === 'Motivo') ? [] : [['Motivo', 'Não informado']]),
              ...change,
              ['Horário', formatDateTime(selected.created_date)], ['Referência', auditReference(selected)],
            ].map(([label, value]) => <div key={label} className="flex justify-between gap-3 border-b border-slate-800/60 pb-1.5"><dt className="text-slate-500">{label}</dt><dd className="text-right text-slate-200">{value}</dd></div>)}
            {!hasValues && <p className="pt-1 text-xs text-slate-500">Valores anteriores e novos não foram registrados nesta entrada.</p>}
            <UnavailableButton icon={Undo2} className="w-full">Preparar reversão</UnavailableButton>
            <p className="text-xs text-slate-500">Reversão gera novo registro.</p>
          </dl>
        ) : <Empty2 title="Selecione um registro" />}
      </Card2>
    </div>
  );
}
