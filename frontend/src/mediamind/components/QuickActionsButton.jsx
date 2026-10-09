import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronDown } from 'lucide-react';
import { useAuth } from '../auth';
import { ACTIONS, GROUPS, canRunAction, runAction } from '../lib/quickActions';

// Botão "Novo" do Topbar — dropdown com as ações de criação que o usuário
// logado tem permissão para executar (canRunAction). Fonte única: quickActions.
// Itens agrupados por categoria; lista rolável quando cresce.
export default function QuickActionsButton() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onOpenReq() { setOpen(true); }
    window.addEventListener('mm:open-novo', onOpenReq);
    return () => window.removeEventListener('mm:open-novo', onOpenReq);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const visible = ACTIONS.filter((a) => canRunAction(a, user));
  // Só renderiza grupos que tenham ao menos uma ação permitida.
  const activeGroups = GROUPS.filter((g) => visible.some((a) => a.group === g.id));

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-xl bg-sky-500 px-3 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-sky-400"
      >
        <Plus size={16} /> Novo
        <ChevronDown size={14} className="opacity-70" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 max-h-[70vh] w-72 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
          {visible.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-slate-500">
              Nenhuma ação disponível para seu perfil.
            </div>
          ) : (
            activeGroups.map((g) => (
              <div key={g.id}>
                <div className="sticky top-0 bg-slate-900 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  {g.label}
                </div>
                {visible.filter((a) => a.group === g.id).map((a) => {
                  const Icon = a.icon;
                  return (
                    <button
                      key={a.id}
                      onClick={() => {
                        setOpen(false);
                        runAction(a.id, navigate);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-slate-800"
                    >
                      <Icon size={16} className="shrink-0 text-sky-400" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{a.label}</p>
                        <p className="truncate text-[10px] text-slate-500">{a.entity}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}