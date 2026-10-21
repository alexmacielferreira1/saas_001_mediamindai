import React, { useState, useEffect } from 'react';
import { Download, Plus, Search, ShieldCheck, Users, UserCog } from 'lucide-react';
import { listMemberships, updateMembershipRole, updateMembershipScreens } from '../../../../api/permissions';
import { ROLE_CATALOG } from '../../../lib/roleCatalog';
import { ALL_SUBTABS, isTotalAccess, getActiveSubtabs, toggleSubtab } from '../../../lib/roleSubtabs';
import { useAuth } from '../../../auth';
import { accessErrorMessage, isAccessDenied } from '../../../lib/accessErrors';
import EmployeeAccessRow from './EmployeeAccessRow';
import AcessoIAPanel from './AcessoIAPanel';

// Administração de Acessos e Telas: catálogo oficial de cargos (permissões
// padrão editáveis) + associação de funcionários a cargos + ajustes por pessoa.
const LOCAL_EMPLOYEES = [
  { id: 'local-alex', membershipId: 'local-alex', name: 'Alex Maciel Ferreira', email: 'alex@mediamind.ai', role: 'superadmin', extraScreens: [], restrictedScreens: [] },
  { id: 'local-marina', membershipId: 'local-marina', name: 'Marina Alves', email: 'marina@mediamind.ai', role: 'producer', extraScreens: [], restrictedScreens: [] },
  { id: 'local-rafael', membershipId: 'local-rafael', name: 'Rafael Lima', email: 'rafael@mediamind.ai', role: 'editor', extraScreens: [], restrictedScreens: [] },
  { id: 'local-juliana', membershipId: 'local-juliana', name: 'Juliana Costa', email: 'juliana@mediamind.ai', role: 'social_media', extraScreens: [], restrictedScreens: [] },
];

export default function AdminAcessosPage({ administration2 = false, localDemo = false }) {
  const { user: currentUser } = useAuth();
  const [, setBump] = useState(0);
  const [employees, setEmployees] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [accessError, setAccessError] = useState('');
  const [roleSearch, setRoleSearch] = useState('');
  const [area, setArea] = useState('Todas as áreas');
  const visibleRoles = ROLE_CATALOG.filter((role) => !roleSearch.trim() || `${role.name} ${role.description || ''}`.toLocaleLowerCase('pt-BR').includes(roleSearch.trim().toLocaleLowerCase('pt-BR')));

  // Lista memberships do tenant selecionado (admin autorizado pode listar). Mapeia para o
  // contrato do EmployeeAccessRow: role = cargo || role da plataforma.
  useEffect(() => {
    let alive = true;
    if (localDemo) {
      setEmployees(LOCAL_EMPLOYEES);
      setLoadingUsers(false);
      return () => { alive = false; };
    }
    listMemberships()
      .then((rows) => {
        if (!alive) return;
        setEmployees((rows || []).map((u) => ({
          id: u.user_id,
          membershipId: u.id,
          email: u.email,
          name: u.full_name || u.email,
          role: u.role || 'user',
          permissionGroupId: u.permission_group_id,
          extraScreens: u.extra_screens || [],
          restrictedScreens: u.restricted_screens || [],
        })));
      })
      .catch((error) => {
        if (!alive) return;
        setEmployees([]);
        if (isAccessDenied(error)) setAccessError(accessErrorMessage(error, 'Sem permissão para listar os funcionários desta empresa.'));
      })
      .finally(() => { if (alive) setLoadingUsers(false); });
    return () => { alive = false; };
  }, [localDemo]);

  // Liga/desliga uma guia do cargo — salva direto, sem modo de edição.
  function onToggle(cargoId, entry) {
    toggleSubtab(cargoId, entry);
    setBump((n) => n + 1);
  }

  async function onScreensChange(user, extraScreens, restrictedScreens) {
    setAccessError('');
    try {
      if (!localDemo) await updateMembershipScreens(user.membershipId, extraScreens, restrictedScreens);
      setEmployees((current) => current.map((item) => (
        item.membershipId === user.membershipId ? { ...item, extraScreens, restrictedScreens } : item
      )));
    } catch (error) {
      setAccessError(accessErrorMessage(error, 'Não foi possível alterar as telas. Tente novamente.'));
    }
  }

  async function onCopyAccess(user, source) {
    setAccessError('');
    let roleSaved = false;
    try {
      if (!localDemo) {
        await updateMembershipRole(user.membershipId, source.role);
        roleSaved = true;
        await updateMembershipScreens(user.membershipId, source.extraScreens || [], source.restrictedScreens || []);
      }
      setEmployees((current) => current.map((item) => (
        item.membershipId === user.membershipId
          ? { ...item, role: source.role, extraScreens: source.extraScreens || [], restrictedScreens: source.restrictedScreens || [] }
          : item
      )));
    } catch (error) {
      // Falha parcial: o cargo já foi gravado no servidor; as telas continuam as anteriores.
      if (roleSaved) {
        setEmployees((current) => current.map((item) => (
          item.membershipId === user.membershipId ? { ...item, role: source.role } : item
        )));
      }
      setAccessError(accessErrorMessage(error, 'Não foi possível copiar o acesso. Tente novamente.'));
    }
  }

  async function onRoleChange(user, role) {
    setAccessError('');
    try {
      if (!localDemo) await updateMembershipRole(user.membershipId, role);
      setEmployees((current) => current.map((item) => (
        item.membershipId === user.membershipId ? { ...item, role } : item
      )));
    } catch (error) {
      setAccessError(accessErrorMessage(error, 'Não foi possível alterar o cargo. Tente novamente.'));
    }
  }

  function exportMatrix() {
    const matrix = ROLE_CATALOG.map((role) => ({
      funcao: role.name,
      descricao: role.description,
      acesso_total: isTotalAccess(role.id),
      telas: isTotalAccess(role.id) ? ALL_SUBTABS.map((item) => item.name) : getActiveSubtabs(role.id),
    }));
    const blob = new Blob([JSON.stringify(matrix, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'matriz-acessos-mediamind.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-50">
            <UserCog size={22} className="text-sky-400" /> Acessos por Função
          </h2>
          <p className="text-sm text-slate-400">Defina o padrão de acesso por cargo, função e perfil operacional.</p>
        </div>
        {administration2 && <div className="flex flex-wrap gap-2">
          <button type="button" title="A criação será conectada ao cadastro de perfis" className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950"><Plus size={16}/> Nova função</button>
          <button type="button" onClick={exportMatrix} className="inline-flex items-center gap-2 rounded-lg border border-sky-700 px-4 py-2 text-sm font-semibold text-sky-300"><Download size={16}/> Exportar matriz</button>
        </div>}
      </div>

      {administration2 && <div className="grid gap-3 md:grid-cols-[1.5fr_.7fr_.7fr]">
        <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/50 px-3"><Search size={16} className="text-slate-500"/><input value={roleSearch} onChange={(event) => setRoleSearch(event.target.value)} placeholder="Buscar função, área ou permissão..." className="w-full bg-transparent py-2.5 text-sm text-slate-200 outline-none"/></label>
        <select aria-label="Área" value={area} onChange={(event) => setArea(event.target.value)} className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 text-sm text-slate-300"><option>Todas as áreas</option><option>Produção</option><option>Editorial</option><option>Administração</option></select>
        <select aria-label="Status" className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 text-sm text-slate-300"><option>Todos os status</option><option>Ativos</option></select>
      </div>}

      {/* Catálogo de cargos & funções */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
          <ShieldCheck size={15} className="text-sky-400" />
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">Catálogo de cargos & funções</h3>
          </div>
          <span className="text-xs text-slate-500">{visibleRoles.length} funções</span>
        </div>
        <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
          Cada cargo parte das guias correspondentes já acesas; as demais ficam desligadas. Ative ou desligue guias clicando nos chips — o padrão é salvo automaticamente.
        </p>
        <div className="grid gap-2 lg:grid-cols-2">
          {visibleRoles.map((c) => {
            const isAll = isTotalAccess(c.id);
            const active = isAll ? null : (getActiveSubtabs(c.id) || []);
            return (
              <div key={c.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 transition hover:border-sky-900">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-100">{c.name}</p>
                    {c.description && <p className="text-[11px] text-slate-500">{c.description}</p>}
                  </div>
                  {isAll ? (
                    <span className="shrink-0 text-xs font-semibold text-sky-300">{ALL_SUBTABS.length} acessos ›</span>
                  ) : (
                    <span className="shrink-0 text-xs font-semibold text-sky-300">{active.length} acessos ›</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_SUBTABS.map((g) => {
                    const ids = [g.id, ...(g.aliases || [])];
                    const on = isAll || ids.some((id) => active.includes(id));
                    return (
                      <button
                        key={g.id}
                        disabled={isAll}
                        onClick={() => onToggle(c.id, g)}
                        className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition ${on ? 'bg-sky-500 text-slate-950' : 'border border-slate-700 bg-slate-950/40 text-slate-400 hover:bg-slate-800'} ${isAll ? 'cursor-not-allowed' : ''}`}
                      >
                        {g.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Funcionários & acessos por pessoa */}
      <div className={administration2 ? 'grid gap-4 xl:grid-cols-2' : ''}>
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Users size={15} className="text-sky-400" />
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">Funcionários & acessos por pessoa</h3>
        </div>
        <div className="space-y-2">
          {accessError && <p className="text-sm text-rose-400">{accessError}</p>}
          {loadingUsers ? (
            <p className="text-sm text-slate-500">Carregando funcionários…</p>
          ) : employees.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum funcionário cadastrado. Convide usuários pela plataforma para gerenciar acessos.</p>
          ) : (
            employees.map((u) => (
              <EmployeeAccessRow key={u.id} user={u} isSelf={u.id === currentUser?.id} peers={employees} onRoleChange={onRoleChange} onScreensChange={onScreensChange} onCopyAccess={onCopyAccess} />
            ))
          )}
        </div>
        <p className="mt-3 text-[11px] text-slate-500">{localDemo ? 'Prévia local: os ajustes permanecem nesta sessão.' : 'Funcionários e ajustes individuais vêm dos vínculos da empresa selecionada.'}</p>
      </section>

      <AcessoIAPanel />
      </div>
    </div>
  );
}
