import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Minus, RotateCcw } from 'lucide-react';
import { ROLE_CATALOG, getCargoDefaultTabs } from '../../../lib/roleCatalog';
import { CORP_SCREENS } from '../../../lib/corpTabs';

// Linha de funcionário com seletor de cargo e personalização de acessos por
// pessoa (3 estados por tela: padrão do cargo → incluir → remover).
export default function EmployeeAccessRow({ user, isSelf, peers = [], onRoleChange, onScreensChange, onCopyAccess }) {
  const [open, setOpen] = useState(false);
  const access = { extraTabs: user.extraScreens || [], removedTabs: user.restrictedScreens || [] };
  const cargoId = user.role;
  const def = getCargoDefaultTabs(cargoId);
  const isAll = def === null;
  const defaultSet = new Set(isAll ? CORP_SCREENS.map((s) => s.id) : (def || []));
  const extraSet = new Set(access.extraTabs || []);
  const removedSet = new Set(access.removedTabs || []);

  const effective = CORP_SCREENS.filter((s) => {
    if (isAll) return !removedSet.has(s.id);
    return (defaultSet.has(s.id) || extraSet.has(s.id)) && !removedSet.has(s.id);
  });

  function changeRole(e) {
    onRoleChange?.(user, e.target.value);
  }

  function cycle(id) {
    const next = { ...access, role: cargoId };
    if (isAll) {
      // admin: alterna só removido ↔ padrão
      if (removedSet.has(id)) next.removedTabs = (next.removedTabs || []).filter((t) => t !== id);
      else { next.removedTabs = [...(next.removedTabs || []), id]; next.extraTabs = (next.extraTabs || []).filter((t) => t !== id); }
    } else if (extraSet.has(id)) {
      next.extraTabs = (next.extraTabs || []).filter((t) => t !== id);
      next.removedTabs = [...(next.removedTabs || []), id];
    } else if (removedSet.has(id)) {
      next.removedTabs = (next.removedTabs || []).filter((t) => t !== id);
    } else {
      next.extraTabs = [...(next.extraTabs || []), id];
      next.removedTabs = (next.removedTabs || []).filter((t) => t !== id);
    }
    onScreensChange?.(user, next.extraTabs || [], next.removedTabs || []);
  }

  function resetOverrides() {
    onScreensChange?.(user, [], []);
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-violet-500 text-sm font-bold text-slate-950">{user.name?.[0] || '?'}</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-100">
            {user.name}
            {isSelf && <span className="ml-1.5 rounded bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-bold text-sky-300">VOCÊ</span>}
          </p>
          <p className="text-[11px] text-slate-500">{user.email}</p>
        </div>
        <div className="hidden text-right text-[11px] text-slate-500 sm:block">{effective.length} telas</div>
        <select
          value={cargoId}
          onChange={changeRole}
          disabled={isSelf}
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 disabled:opacity-50"
          title={isSelf ? 'Você não pode alterar seu próprio cargo na sessão atual' : 'Cargo do funcionário'}
        >
          {ROLE_CATALOG.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button onClick={() => setOpen((o) => !o)} className="rounded-md border border-slate-700 p-1.5 text-slate-400 hover:bg-slate-800">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-800 px-3 py-3">
          {isAll ? (
            <p className="text-[11px] text-slate-500">Cargo com acesso total — ajustes por pessoa não se aplicam.</p>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Personalizar acessos</p>
                <button onClick={resetOverrides} className="flex items-center gap-1 rounded-md border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400 hover:bg-slate-800">
                  <RotateCcw size={11} /> Restabelecer padrão
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CORP_SCREENS.map((s) => {
                  const isExtra = extraSet.has(s.id);
                  const isRemoved = removedSet.has(s.id);
                  const isDefaultOn = isAll || defaultSet.has(s.id);
                  const cls = isRemoved
                    ? 'border border-rose-700/50 bg-rose-500/10 text-rose-300'
                    : isExtra
                      ? 'bg-emerald-500 text-slate-950'
                      : isDefaultOn
                        ? 'bg-sky-500/20 text-sky-300'
                        : 'border border-slate-700 text-slate-500 hover:bg-slate-800';
                  return (
                    <button
                      key={s.id}
                      onClick={() => cycle(s.id)}
                      className={`rounded px-2 py-1 text-[10px] font-medium transition ${cls}`}
                      title={isRemoved ? 'Removida (clique p/ voltar ao padrão)' : isExtra ? 'Incluída (clique p/ remover)' : 'Padrão (clique p/ incluir)'}
                    >
                      {isRemoved ? <Minus size={9} className="mr-0.5 inline" /> : isExtra ? <Plus size={9} className="mr-0.5 inline" /> : null}
                      {s.name}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[10px] text-slate-500">
                Clique para alternar: <span className="text-sky-300">padrão do cargo</span> → <span className="text-emerald-300">incluir</span> → <span className="text-rose-300">remover</span>.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Copiar acesso de:</span>
                <select
                  value=""
                  onChange={(e) => {
                    const other = peers.find((u) => String(u.id) === e.target.value);
                    if (other) {
                      onCopyAccess?.(user, other);
                    }
                  }}
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300"
                  title="Substitui o acesso atual pelo do colega selecionado"
                >
                  <option value="">Selecione um colega…</option>
                  {peers.filter((u) => u.id !== user.id).map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-600">Substitui o acesso atual; dá pra editar depois.</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
