import React from 'react';
import { Sparkles } from 'lucide-react';
import CorpDashboard from './CorpDashboard';

// Hub de Início do IAcervoCorp — painel de entrada assim que você chega no
// Corp. Mostra o panorama geral (indicadores + agenda unificada) e o prompt
// de IA pra sugerir/executar ações. O conteúdo de "visão geral" que existia
// antes já vive dentro do Editor de vídeo, então o Início aqui é o ponto de
// partida corporativo, não uma repetição do editorial.
export default function CorpInicioPage({ onNavigate }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-sky-400" />
        <h2 className="text-lg font-bold text-slate-50">Início</h2>
      </div>

      <CorpDashboard />

      <div className="flex flex-wrap gap-2">
        <button onClick={() => onNavigate?.('producao')} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">Ir para Produção</button>
        <button onClick={() => onNavigate?.('editor_video')} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">Ir para Editor de vídeo</button>
        <button onClick={() => onNavigate?.('videomaker')} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">Ir para Videomaker</button>
      </div>
    </div>
  );
}