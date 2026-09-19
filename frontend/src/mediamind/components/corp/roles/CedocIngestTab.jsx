import React, { useState } from 'react';
import {
  Wrench, ShieldCheck, RefreshCw, Trash2, DatabaseZap, FileSearch,
  Globe, ClipboardCheck, Building2, SlidersHorizontal,
} from 'lucide-react';
import Ingest from '../../../pages/Ingest';

// Cedoc vê o MESMO ingest que todos os perfis — mas o Administrador de Acervo
// ganha, por cima, um painel de manutenção e autorizações que controla quem
// pode ingerir, de onde, com qual limite e se exige conferência.

const TVS = ['TV Capital', 'TV Sul', 'TV Norte'];

export default function CedocIngestTab({ isAdmin }) {
  // Manutenção — operações de upkeep do acervo (mock, estado local).
  const [manutencao, setManutencao] = useState({
    reprocessarFalhas: false,
    limparCache: false,
    reindexar: false,
    integridade: false,
  });
  // Autorizações — políticas de ingest que só o admin define.
  const [aut, setAut] = useState({
    limiteGB: 250,
    autoExterno: false,
    exigirConferencia: true,
    tvsAutorizadas: { 'TV Capital': true, 'TV Sul': true, 'TV Norte': false },
  });

  function toggleManutencao(key) {
    setManutencao((m) => ({ ...m, [key]: !m[key] }));
  }
  function toggleAut(key) {
    setAut((a) => ({ ...a, [key]: !a[key] }));
  }
  function toggleTv(tv) {
    setAut((a) => ({ ...a, tvsAutorizadas: { ...a.tvsAutorizadas, [tv]: !a.tvsAutorizadas[tv] } }));
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {isAdmin && (
        <div className="grid gap-3 lg:grid-cols-2">
          {/* Manutenção */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
            <div className="mb-3 flex items-center gap-2">
              <Wrench size={14} className="text-amber-400" />
              <p className="text-xs font-bold uppercase tracking-wide text-slate-300">Manutenção do acervo</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <ManutencaoBtn
                on={manutencao.reprocessarFalhas}
                onClick={() => toggleManutencao('reprocessarFalhas')}
                Icon={RefreshCw}
                label="Reprocessar falhas"
                desc="Reenfileira ingests que falharam"
              />
              <ManutencaoBtn
                on={manutencao.limparCache}
                onClick={() => toggleManutencao('limparCache')}
                Icon={Trash2}
                label="Limpar cache de previews"
                desc="Libera espaço de proxies temporários"
              />
              <ManutencaoBtn
                on={manutencao.reindexar}
                onClick={() => toggleManutencao('reindexar')}
                Icon={DatabaseZap}
                label="Reindexar acervo"
                desc="Reconstrói índices de busca"
              />
              <ManutencaoBtn
                on={manutencao.integridade}
                onClick={() => toggleManutencao('integridade')}
                Icon={FileSearch}
                label="Verificar integridade"
                desc="Confronta hashes dos arquivos"
              />
            </div>
          </div>

          {/* Autorizações */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck size={14} className="text-sky-400" />
              <p className="text-xs font-bold uppercase tracking-wide text-slate-300">Autorizações de ingest</p>
            </div>
            <div className="space-y-2.5">
              {/* Limite por ingest */}
              <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-slate-200">
                    <SlidersHorizontal size={12} className="text-slate-500" /> Limite por ingest
                  </span>
                  <span className="font-mono text-sm font-bold text-sky-300">{aut.limiteGB} GB</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={1000}
                  step={50}
                  value={aut.limiteGB}
                  onChange={(e) => setAut((a) => ({ ...a, limiteGB: Number(e.target.value) }))}
                  className="w-full accent-sky-500"
                />
                <div className="mt-0.5 flex justify-between text-[9px] text-slate-600">
                  <span>50 GB</span><span>1000 GB</span>
                </div>
              </div>

              {/* Toggles de política */}
              <AutToggle
                on={aut.autoExterno}
                onClick={() => toggleAut('autoExterno')}
                Icon={Globe}
                label="Aprovar ingest externo automaticamente"
              />
              <AutToggle
                on={aut.exigirConferencia}
                onClick={() => toggleAut('exigirConferencia')}
                Icon={ClipboardCheck}
                label="Exigir dupla conferência de mídia bruta"
              />

              {/* TVs autorizadas a ingerir */}
              <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-200">
                  <Building2 size={12} className="text-slate-500" /> TVs autorizadas a ingerir
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {TVS.map((tv) => {
                    const on = aut.tvsAutorizadas[tv];
                    return (
                      <button
                        key={tv}
                        onClick={() => toggleTv(tv)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
                          on ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                              : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                        }`}
                      >
                        {tv}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mesmo ingest de todos os perfis */}
      <div className="min-h-0 flex-1">
        <Ingest />
      </div>
    </div>
  );
}

function ManutencaoBtn({ on, onClick, Icon, label, desc }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition ${
        on
          ? 'border-amber-600/50 bg-amber-500/10 hover:bg-amber-500/20'
          : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
      }`}
    >
      <Icon size={15} className={on ? 'text-amber-300' : 'text-slate-500'} />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-200">{label}</p>
        <p className="text-[10px] leading-tight text-slate-500">{desc}</p>
        {on && <p className="mt-1 text-[9px] font-bold uppercase text-amber-300">Em execução</p>}
      </div>
    </button>
  );
}

function AutToggle({ on, onClick, Icon, label }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5 text-left transition hover:border-slate-700"
    >
      <Icon size={14} className={on ? 'text-sky-300' : 'text-slate-500'} />
      <span className="flex-1 text-xs font-medium text-slate-200">{label}</span>
      <span className={`relative h-4 w-7 rounded-full transition ${on ? 'bg-sky-500' : 'bg-slate-700'}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition ${on ? 'left-3.5' : 'left-0.5'}`} />
      </span>
    </button>
  );
}