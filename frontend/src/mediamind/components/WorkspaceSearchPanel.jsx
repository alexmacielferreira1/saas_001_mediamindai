import React, { useState } from 'react';
import { Search, Sparkles, X } from 'lucide-react';

const FIELDS = [
  { key: 'filename', label: 'Nome do arquivo' },
  { key: 'transcription', label: 'Fala / Transcrição' },
  { key: 'person', label: 'Pessoa / Apresentador' },
  { key: 'gc', label: 'GC / Texto na tela' },
  { key: 'local', label: 'Local' },
];

export default function WorkspaceSearchPanel({ search, setSearch }) {
  const [tab, setTab] = useState('pesquisa');

  function update(key, val) { setSearch({ ...search, [key]: val }); }

  function clear() {
    setSearch({ filename: '', transcription: '', person: '', gc: '', local: '', date: '' });
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="flex gap-1 border-b border-slate-800 p-2">
        <button
          onClick={() => setTab('pesquisa')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${tab === 'pesquisa' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:bg-slate-800/50'}`}
        >
          <Search size={13} /> Pesquisa
        </button>
        <button
          onClick={() => setTab('prompt')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${tab === 'prompt' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:bg-slate-800/50'}`}
        >
          <Sparkles size={13} /> Prompt IA
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'pesquisa' ? (
          <div className="flex flex-col gap-3">
            {FIELDS.map((f) => (
              <label key={f.key} className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-400">{f.label}</span>
                <input
                  value={search[f.key] || ''}
                  onChange={(e) => update(f.key, e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm outline-none focus:border-sky-500"
                />
              </label>
            ))}
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-400">Data</span>
              <input
                type="date"
                value={search.date || ''}
                onChange={(e) => update('date', e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm outline-none focus:border-sky-500"
              />
            </label>
            <button
              onClick={clear}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-sky-500 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400"
            >
              <X size={13} /> Limpar
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <textarea
              placeholder="Descreva o que você quer encontrar ou criar..."
              rows={8}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-sky-500"
            />
            <button className="flex items-center justify-center gap-1.5 rounded-lg bg-sky-500 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400">
              <Sparkles size={13} /> Gerar
            </button>
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-400">
              <p className="mb-1.5 font-medium text-slate-300">Sugestões:</p>
              <ul className="flex flex-col gap-1">
                <li>• Encontre trechos sobre "revitalização do centro"</li>
                <li>• Criar roteiro para matéria de 3 minutos</li>
                <li>• Sugerir cortes para Instagram</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}