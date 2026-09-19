import React from 'react';
import { Building2, LayoutGrid, ChevronRight, LogOut, CheckCircle2 } from 'lucide-react';
import { useEmpresa } from '../lib/empresaContext';
import { useAuth } from '../auth';

const ICON_COLORS = [
  'bg-violet-500/20 text-violet-300',
  'bg-teal-500/20 text-teal-300',
  'bg-sky-500/20 text-sky-300',
  'bg-amber-500/20 text-amber-300',
  'bg-rose-500/20 text-rose-300',
  'bg-emerald-500/20 text-emerald-300',
];

export default function EmpresaSelector() {
  const { accessible, setCurrent, isAdmin } = useEmpresa();
  const { logout } = useAuth();

  function handleLogout() {
    logout();
    window.location.href = '/login';
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-100">Em qual empresa você vai trabalhar?</h1>
          <p className="mt-2 text-sm text-slate-400">
            Selecione a empresa para acessar seus funcionários, clientes e dados. Você pode trocar a qualquer momento.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {isAdmin && (
            <SelectorCard
              icon={<LayoutGrid size={20} />}
              color="bg-emerald-500/20 text-emerald-300"
              title="Todas as empresas"
              desc="Visão geral da plataforma"
              onClick={() => setCurrent('all')}
            />
          )}
          {accessible.map((e, i) => (
            <SelectorCard
              key={e.id}
              icon={<Building2 size={20} />}
              color={ICON_COLORS[i % ICON_COLORS.length]}
              title={e.nome}
              desc={e.descricao || e.nome}
              badge={e.status === 'ativa' ? 'Ativa' : e.status}
              plano={e.plano}
              onClick={() => setCurrent(e.id)}
            />
          ))}
        </div>

        {accessible.length === 0 && !isAdmin && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center text-sm text-slate-500">
            Você não tem nenhuma empresa vinculada. Solicite acesso ao administrador.
          </div>
        )}

        <div className="mt-8 flex justify-center">
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300">
            <LogOut size={15} /> Sair
          </button>
        </div>
      </div>
    </div>
  );
}

function SelectorCard({ icon, color, title, desc, badge, plano, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-left transition hover:border-sky-600/60 hover:bg-slate-900"
    >
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${color}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-100">{title}</p>
          {badge && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
              <CheckCircle2 size={10} /> {badge}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-slate-500">{desc}</p>
        {plano && <p className="mt-0.5 text-[11px] text-slate-600">{plano}</p>}
      </div>
      <ChevronRight size={18} className="shrink-0 text-slate-600 transition group-hover:text-sky-400" />
    </button>
  );
}