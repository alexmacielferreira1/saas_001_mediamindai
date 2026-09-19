import React, { useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { MOCK_CORP_PENDENCIES } from '../../data';
import { loadOrSeedPendencias } from '../../lib/corpPendencias';
import { logAudit } from '../../lib/audit';
import CorpPromptPanel from './CorpPromptPanel';

// Abas do Corp que não são um segmento direto mapeiam para o segmento mais próximo.
const SEGMENT_MAP = {
  inicio: 'producao', gravacao: 'producao', edicao: 'audiovisual',
  documentacao: 'producao', aprovacoes: 'producao',
};

export default function CorpPromptLauncher({ segment }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const effectiveSegment = SEGMENT_MAP[segment] || segment;
  const hasPendencias = !!MOCK_CORP_PENDENCIES[effectiveSegment];

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const fallback = MOCK_CORP_PENDENCIES[effectiveSegment] || [];
    loadOrSeedPendencias(effectiveSegment, fallback)
      .then((loaded) => { setItems(loaded); setLoading(false); });
  }, [open, effectiveSegment]);

  async function apply(id, status) {
    setItems((it) => it.map((p) => (String(p.id) === String(id) ? { ...p, status } : p)));
    try {
      await base44.entities.PendenciaCorp.update(String(id), { status });
      logAudit('Pendência', 'Corp', `Prompt IA moveu pendência para "${status}" em ${effectiveSegment}`);
    } catch { /* best-effort */ }
  }

  if (!hasPendencias) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-sky-500 px-4 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-sky-500/30 hover:bg-sky-400"
      >
        <Sparkles size={16} /> Prompt IA
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" onClick={() => setOpen(false)}>
          <div className="flex h-[80vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-700 bg-slate-900 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-sky-400">Modo Prompt</p>
                <h3 className="text-sm font-semibold text-slate-100">{effectiveSegment} — sugestões da IA</h3>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-200"><X size={18} /></button>
            </div>
            <div className="min-h-0 flex-1">
              {loading ? <p className="text-sm text-slate-500">Carregando pendências…</p> : <CorpPromptPanel segment={effectiveSegment} items={items} onApply={apply} />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}