import React from 'react';
import { Plus, Clock, CheckCircle2, AlertCircle, Settings, Package } from 'lucide-react';

const MENU_ITEMS = [
  { key: 'andamento', label: 'Em andamento', icon: Clock, filter: 'processing' },
  { key: 'concluidas', label: 'Concluídas', icon: CheckCircle2, filter: 'completed' },
  { key: 'falhas', label: 'Falhas', icon: AlertCircle, filter: 'failed' },
];

export default function IngestSubMenu({ view, onChange, onNew, packages = [] }) {
  return (
    <div className="flex h-full w-52 shrink-0 flex-col rounded-xl border border-slate-800 bg-slate-900/40">
      <div className="p-3">
        <button
          onClick={onNew}
          className={`flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-bold transition ${
            view === 'nova'
              ? 'bg-sky-500 text-slate-950'
              : 'border border-sky-700 bg-sky-950/30 text-sky-300 hover:bg-sky-900/40'
          }`}
        >
          <Plus size={14} /> Nova Ingestão
        </button>
      </div>

      <div className="px-3 pb-2">
        <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Pacotes</p>
      </div>

      <div className="flex-1 overflow-y-auto px-3">
        <div className="flex flex-col gap-1">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            const count = packages.filter((p) => p.status === item.filter).length;
            const isActive = view === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onChange(item.key)}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                  isActive
                    ? 'bg-sky-500/15 text-sky-300'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon size={15} /> {item.label}
                </span>
                {count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    isActive ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="my-2 border-t border-slate-800" />

        <button
          onClick={() => onChange('config')}
          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
            view === 'config'
              ? 'bg-sky-500/15 text-sky-300'
              : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
          }`}
        >
          <Settings size={15} /> Configurações
        </button>
      </div>

      {/* Storage widget */}
      <div className="border-t border-slate-800 p-3">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Armazenamento</p>
        <div className="flex items-center gap-2 rounded-lg bg-slate-950/60 px-2.5 py-2">
          <Package size={14} className="text-slate-500" />
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-300">0 B enviados</p>
            <p className="text-[10px] text-slate-600">Capacidade não configurada</p>
          </div>
        </div>
      </div>
    </div>
  );
}