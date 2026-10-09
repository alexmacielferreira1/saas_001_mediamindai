import React, { useState } from 'react';
import { Upload, FileVideo, ChevronDown } from 'lucide-react';

export default function CorpIngestPanel() {
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState([
    { name: 'vmix_20260713_1400.mp4', size: '4.2 GB' },
    { name: 'Camera 2 - Convidado.mp4', size: '4.1 GB' },
    { name: 'Audio - Mesa.wav', size: '620 MB' },
  ]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Ingest</p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); setFiles((f) => [...f, { name: `arquivo_${f.length + 1}.mp4`, size: '1.0 GB' }]); }}
        className={`mb-3 flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed py-5 text-center transition ${
          dragOver ? 'border-sky-500 bg-sky-950/20' : 'border-slate-700 bg-slate-950/40'
        }`}
      >
        <Upload size={18} className="text-slate-500" />
        <p className="text-[11px] text-slate-400">Arraste arquivos aqui</p>
        <p className="text-[10px] text-slate-600">Vídeos, áudios, imagens ou documentos</p>
      </div>

      <div className="mb-3 flex flex-col gap-1.5">
        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-semibold uppercase text-slate-500">Produção</span>
          <div className="relative">
            <select className="w-full appearance-none rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 pr-6 text-[11px] text-slate-200 outline-none focus:border-sky-500">
              <option>EP054 — Sala de Prescrição</option>
            </select>
            <ChevronDown size={11} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-500" />
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-semibold uppercase text-slate-500">Pasta de destino</span>
          <div className="relative">
            <select className="w-full appearance-none rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 pr-6 text-[11px] text-slate-200 outline-none focus:border-sky-500">
              <option>Brutos</option>
            </select>
            <ChevronDown size={11} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-500" />
          </div>
        </label>
      </div>

      <div className="mb-3 flex-1 space-y-1 overflow-y-auto">
        {files.map((f, i) => (
          <div key={i} className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/40 px-2 py-1.5">
            <FileVideo size={12} className="shrink-0 text-slate-500" />
            <span className="flex-1 truncate text-[10px] text-slate-300">{f.name}</span>
            <span className="text-[9px] text-slate-600">{f.size}</span>
          </div>
        ))}
      </div>

      <label className="mb-2 flex items-center gap-1.5 text-[10px] text-slate-400">
        <input type="checkbox" defaultChecked className="rounded border-slate-700 bg-slate-950" />
        Gerar metadados automaticamente (IA)
      </label>

      <button className="w-full rounded-lg bg-sky-500 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400">
        Iniciar Ingest
      </button>
    </div>
  );
}