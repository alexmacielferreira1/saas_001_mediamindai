import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Search, Bell, Settings,
  LogOut, ChevronRight, PanelLeftClose, PanelLeftOpen, Sparkles,
  Home, Layers, Film, Calendar, Send, ShieldCheck, UserCog, BarChart3, LayoutDashboard, FileText, Clapperboard, Scissors, CheckCircle2, Flag, Share2, PanelsTopLeft,
} from 'lucide-react';
import { useAuth } from './auth';
import { useEmpresa } from './lib/empresaContext';
import EmpresaSwitcher from './components/EmpresaSwitcher';
import CommandPalette from './components/CommandPalette';
import QuickActionsButton from './components/QuickActionsButton';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';

export const NAV_GROUPS = [
  {
    group: 'Principal',
    items: [
      { to: '/', label: 'Início', icon: Home, end: true },
    ],
  },
  {
    group: 'Produção',
    items: [
      { to: '/corp?tab=producao&sub=overview', label: 'Visão geral', icon: LayoutDashboard, sub: 'overview' },
      { to: '/corp?tab=producao&sub=ingest', label: 'Ingest', icon: Layers, sub: 'ingest' },
      { to: '/corp?tab=producao&sub=workspace2', label: 'Workspace 2', icon: PanelsTopLeft, sub: 'workspace2' },
      { to: '/roteiro2', label: 'Roteiro 2', icon: FileText },
      { to: '/corp?tab=producao&sub=rascunhos', label: 'Rascunhos', icon: FileText, sub: 'rascunhos' },
      { to: '/corp?tab=producao&sub=agendamentos', label: 'Agendamentos', icon: Calendar, sub: 'agendamentos' },
      { to: '/corp?tab=producao&sub=gravacoes', label: 'Gravações', icon: Clapperboard, sub: 'gravacoes' },
      { to: '/corp?tab=producao&sub=em_edicao', label: 'Edição', icon: Scissors, sub: 'em_edicao' },
      { to: '/corp?tab=producao&sub=aguardando_aprovacao', label: 'Aguardando aprovação', icon: Calendar, sub: 'aguardando_aprovacao' },
      { to: '/corp?tab=producao&sub=em_aprovacao', label: 'Em aprovação', icon: CheckCircle2, sub: 'em_aprovacao' },
      { to: '/corp?tab=producao&sub=finalizado', label: 'Finalizado', icon: Flag, sub: 'finalizado' },
      { to: '/corp?tab=producao&sub=redes_sociais', label: 'Redes sociais', icon: Share2, sub: 'redes_sociais' },
      { to: '/corp?tab=producao&sub=para_publicar', label: 'Para publicação', icon: Send, sub: 'para_publicar' },
      { to: '/corp?tab=producao&sub=publicado', label: 'Publicado', icon: Send, sub: 'publicado' },
      { to: '/corp?tab=producao&sub=analytics', label: 'Analytics', icon: BarChart3, sub: 'analytics' },
    ],
  },
  {
    group: 'Administração',
    items: [
      { to: '/acervo', label: 'Acervo', icon: ShieldCheck },
      { to: '/management', label: 'Gestão', icon: BarChart3 },
      { to: '/administration2', label: 'Administração 2', icon: UserCog },
    ],
  },
  {
    group: 'IA',
    items: [
      { to: '/assistente', label: 'Assistente IA', icon: Sparkles },
    ],
  },
];

export default function Shell({ children }) {
  const { user, logout, roleLabels } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const role = user?.role || 'default';
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try { return Number(localStorage.getItem(`mm_sidebar_width__${role}`)) || 240; } catch { return 240; }
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem(`mm_sidebar_collapsed__${role}`) === '1'; } catch { return false; }
  });

  useEffect(() => { localStorage.setItem(`mm_sidebar_width__${role}`, String(sidebarWidth)); }, [sidebarWidth, role]);
  useEffect(() => { localStorage.setItem(`mm_sidebar_collapsed__${role}`, sidebarCollapsed ? '1' : '0'); }, [sidebarCollapsed, role]);

  // Largura da lateral arrastável (desktop). Persiste por perfil de usuário.
  function startResize(e) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMove = (ev) => setSidebarWidth(Math.max(200, Math.min(480, startW + (ev.clientX - startX))));
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // Fecha sidebar mobile ao navegar
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  useGlobalShortcuts({ openPalette: () => setPaletteOpen(true), navigate });

  function handleSearch(e) {
    e.preventDefault();
    setPaletteOpen(true);
  }

  // Atalho global: ⌘K / Ctrl+K abre o palette de busca universal.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — largura arrastável e recolível (persiste por perfil) */}
      <aside
        style={{ width: sidebarWidth }}
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-800 bg-slate-950/95 transition-transform duration-200 lg:static lg:translate-x-0 ${sidebarCollapsed ? 'lg:hidden' : ''} ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-violet-500 font-extrabold text-slate-950">
            MM
          </div>
          <div>
            <strong className="block text-sm font-semibold text-slate-100">MediaMind AI</strong>
            <small className="text-xs text-slate-500">Acervo inteligente</small>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {NAV_GROUPS.map((g) => (
            <div key={g.group} className="mb-4">
              <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                {g.group}
              </div>
              <div className="flex flex-col gap-0.5">
                {g.items.map((it) => {
                  const Icon = it.icon;
                  return (
                    <NavLink
                      key={it.to}
                      to={it.to}
                      end={it.end}
                      className={({ isActive }) => {
                        const query = new URLSearchParams(location.search);
                        const active = it.sub
                          ? location.pathname === '/corp' && query.get('sub') === it.sub
                          : it.to === '/corp'
                            ? isActive && !query.get('sub')
                            : isActive;
                        return `flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
                          active
                            ? 'bg-sky-500 font-bold text-slate-950'
                            : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
                        }`;
                      }}
                    >
                      <Icon size={17} className="shrink-0" />
                      {it.label}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-slate-800 p-3">
          <div className="mb-2 flex items-center gap-2.5 rounded-xl bg-slate-900/60 px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-violet-500 text-sm font-bold text-slate-950">
              {user?.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-200">{user?.name ?? user?.email}</p>
              <p className="text-[11px] text-slate-500">{roleLabels[user?.role] ?? user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
          >
            <LogOut size={15} />
            Sair
          </button>
        </div>
      </aside>

      {/* Alça de redimensionamento da lateral (desktop) */}
      {!sidebarCollapsed && (
        <div
          onMouseDown={startResize}
          title="Arraste para redimensionar a lateral"
          className="group relative hidden w-2 shrink-0 cursor-col-resize bg-slate-800/70 lg:block hover:bg-sky-600/70"
        >
          <span className="absolute left-1/2 top-1/2 h-8 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-600 transition group-hover:bg-sky-300" />
        </div>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-800 bg-slate-950/80 px-4 py-3 backdrop-blur-md lg:px-6">
          {/* Mobile menu */}
          <button
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <ChevronRight size={20} className="rotate-180" />
          </button>

          {/* Recolher/expandir lateral (desktop) */}
          <button
            className="hidden rounded-lg p-2 text-slate-400 hover:bg-slate-800 lg:inline-flex"
            onClick={() => setSidebarCollapsed((c) => !c)}
            title={sidebarCollapsed ? 'Expandir lateral' : 'Recolher lateral'}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>

          {/* Search — gatilho do palette universal (⌘K) */}
          <form onSubmit={handleSearch} className="relative max-w-md flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <button
              type="submit"
              className="flex w-full items-center rounded-xl border border-slate-700 bg-slate-900/60 py-2 pl-9 pr-3 text-sm text-slate-500 hover:border-sky-500"
              onClick={() => setPaletteOpen(true)}
            >
              <span className="truncate text-left">Pesquisar tudo — clientes, tarefas, funções, caminhos…</span>
              <kbd className="ml-auto hidden rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400 sm:inline">⌘K /</kbd>
            </button>
          </form>

          <div className="ml-auto flex items-center gap-1.5">
            <QuickActionsButton />
            <EmpresaSwitcher />
            <button className="relative rounded-xl border border-slate-700 bg-slate-900/60 p-2.5 text-slate-400 hover:text-slate-200">
              <Bell size={18} />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-sky-400" />
            </button>
            <button className="rounded-xl border border-slate-700 bg-slate-900/60 p-2.5 text-slate-400 hover:text-slate-200">
              <Settings size={18} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-x-hidden p-4 lg:p-6">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
