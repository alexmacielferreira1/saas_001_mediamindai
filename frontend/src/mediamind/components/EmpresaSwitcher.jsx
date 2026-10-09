import React, { useEffect, useRef, useState } from 'react';
import { Building2, ChevronDown, Check, LayoutGrid, RefreshCw } from 'lucide-react';
import { useEmpresa } from '../lib/empresaContext';

// Seletor de empresa (dropdown) estilo ClínicaFit: troca rápida entre empresas
// e a visão "Todas as empresas". Footer reabre a tela cheia de seleção.
const DOT_COLORS = ['#a78bfa', '#2a9d8f', '#38bdf8', '#fbbf24', '#fb7185', '#34d399'];

export default function EmpresaSwitcher() {
  const { accessible, current, currentEmpresa, isGlobal, setCurrent, clear, isAdmin } = useEmpresa();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const showSwitcher = isAdmin || accessible.length > 1;
  useEffect(() => {
    if (!showSwitcher) return;
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [showSwitcher]);

  if (!showSwitcher) return null;

  const label = isGlobal ? 'Todas as empresas' : currentEmpresa?.nome || 'Selecionar empresa';

  function pick(id) { setCurrent(id); setOpen(false); }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-sky-500 hover:text-slate-100"
      >
        <Building2 size={15} className="text-sky-400" />
        <span className="hidden max-w-[160px] truncate sm:inline">{label}</span>
        <ChevronDown size={13} className={`text-slate-500 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50">
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Empresa ativa
          </div>

          {isAdmin && (
            <button
              onClick={() => pick('all')}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-700/60">
                <LayoutGrid size={14} className="text-slate-300" />
              </span>
              <span className="flex-1">Todas as empresas</span>
              {isGlobal && <Check size={15} className="text-sky-400" />}
            </button>
          )}

          {isAdmin && accessible.length > 0 && <div className="my-1 h-px bg-slate-800" />}

          {accessible.map((e, i) => {
            const selected = current === e.id;
            return (
              <button
                key={e.id}
                onClick={() => pick(e.id)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ background: DOT_COLORS[i % DOT_COLORS.length] }}
                />
                <span className="flex-1 truncate">{e.nome}</span>
                {selected && <Check size={15} className="text-sky-400" />}
              </button>
            );
          })}

          <div className="my-1 h-px bg-slate-800" />
          <button
            onClick={() => { clear(); setOpen(false); }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700/60">
              <RefreshCw size={13} className="text-slate-400" />
            </span>
            Trocar de empresa...
          </button>
        </div>
      )}
    </div>
  );
}