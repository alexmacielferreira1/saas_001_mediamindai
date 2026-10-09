import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

// Seletor de papel/segmento do IAcervo Corp — substitui a barra horizontal de
// abas por um dropdown compacto com busca e scroll. Respeita a lista de abas
// permitidas (RBAC) repassada pelo Corp.jsx (filterTabsForUser).
export default function CorpRoleSelector({ tabs, active, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const activeTab = useMemo(() => tabs.find((t) => t.id === active) || tabs[0], [tabs, active]);
  const ActiveIcon = activeTab?.Icon;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tabs;
    return tabs.filter((t) => t.name.toLowerCase().includes(q));
  }, [tabs, query]);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Foca o campo de busca ao abrir.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function pick(id) {
    onChange(id);
    setOpen(false);
    setQuery('');
  }

  return (
    <div className="relative w-full max-w-sm" ref={wrapRef}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-left transition hover:border-sky-600/50"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300">
          {ActiveIcon && <ActiveIcon size={15} />}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-100">
          {activeTab?.name ?? 'Selecionar'}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/60">
          {/* Busca */}
          <div className="relative border-b border-slate-800 p-2">
            <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar papel..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-8 text-sm text-slate-100 outline-none focus:border-sky-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered.length) pick(filtered[0].id);
                if (e.key === 'Escape') { setOpen(false); setQuery(''); }
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="max-h-72 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-slate-500">Nenhum papel encontrado.</p>
            ) : (
              filtered.map((t) => {
                const Icon = t.Icon;
                const isActive = t.id === active;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => pick(t.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                      isActive
                        ? 'bg-sky-500/15 text-sky-200'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                      isActive ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {Icon && <Icon size={14} />}
                    </span>
                    <span className="flex-1 truncate font-medium">{t.name}</span>
                    {isActive && <Check size={15} className="shrink-0 text-sky-300" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}