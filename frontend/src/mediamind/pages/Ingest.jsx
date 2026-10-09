import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Settings, HardDrive, Cpu, Volume2, Scan } from 'lucide-react';
import IngestSubMenu from '../components/IngestSubMenu';
import IngestNewPackage from '../components/IngestNewPackage';
import IngestList from '../components/IngestList';

function ConfigView() {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-slate-800 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <Settings size={18} className="text-slate-400" />
          <div>
            <h1 className="text-xl font-bold text-slate-50">Configurações</h1>
            <p className="text-sm text-slate-400">Parâmetros de ingestão e processamento de IA.</p>
          </div>
        </div>
      </div>
      <div className="flex-1 px-6 py-4">
        <div className="max-w-2xl space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="mb-3 flex items-center gap-2">
              <HardDrive size={15} className="text-sky-400" />
              <h2 className="text-sm font-bold text-slate-200">Armazenamento</h2>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Caminho base</span>
                <span className="font-mono text-slate-300">/data/storage</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Uso atual</span>
                <span className="font-bold text-amber-300">72%</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Cpu size={15} className="text-violet-400" />
              <h2 className="text-sm font-bold text-slate-200">Modelos de IA</h2>
            </div>
            <div className="flex flex-col gap-2">
              {[
                { icon: Volume2, label: 'Whisper Large v3', desc: 'Transcrição de áudio', tone: 'text-sky-400' },
                { icon: Scan, label: 'Tesseract OCR', desc: 'Reconhecimento de texto', tone: 'text-violet-400' },
                { icon: Cpu, label: 'YOLOv8', desc: 'Detecção de objetos', tone: 'text-emerald-400' },
              ].map((m) => {
                const Icon = m.icon;
                return (
                  <div key={m.label} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                    <Icon size={16} className={m.tone} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-200">{m.label}</p>
                      <p className="text-xs text-slate-500">{m.desc}</p>
                    </div>
                    <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">Ativo</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Ingest() {
  const [view, setView] = useState('nova');
  const [params, setParams] = useSearchParams();

  // Gatilho do botão "Novo": /ingest?novo=pacote abre o formulário de criação.
  useEffect(() => {
    if (params.get('novo') === 'pacote') {
      setView('nova');
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-3">
      <IngestSubMenu
        view={view}
        onChange={setView}
        onNew={() => setView('nova')}
      />
      <div className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-900/40">
        {view === 'nova' && <IngestNewPackage />}
        {view === 'andamento' && <IngestList view="andamento" onNew={() => setView('nova')} />}
        {view === 'concluidas' && <IngestList view="concluidas" onNew={() => setView('nova')} />}
        {view === 'falhas' && <IngestList view="falhas" onNew={() => setView('nova')} />}
        {view === 'config' && <ConfigView />}
      </div>
    </div>
  );
}