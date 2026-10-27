import React from 'react';
import {
  Package, Clock, CheckCircle2, AlertCircle, ChevronRight,
  Loader2, RefreshCw, Plus,
} from 'lucide-react';
import { StatusBadge } from '../ui';

const CONFIG = {
  andamento: { title: 'Em andamento', icon: Clock, filter: 'processing', tone: 'text-violet-300' },
  concluidas: { title: 'Concluídas', icon: CheckCircle2, filter: 'completed', tone: 'text-emerald-300' },
  falhas: { title: 'Falhas', icon: AlertCircle, filter: 'failed', tone: 'text-amber-300' },
};

// Data do pacote: o servidor manda ``created_date`` (ISO); os pacotes de demonstração, ``created_at``.
function packageDate(pkg) {
  if (pkg.created_at) return pkg.created_at;
  const date = new Date(pkg.created_date);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

// Transcrição (Whisper local) dos áudios/vídeos do pacote, quando a IA está ligada.
function transcriptionText(pkg) {
  const items = (pkg.items || []).filter((item) => item.transcription);
  const failed = items.filter((item) => item.transcription === 'failed');
  if (pkg.transcription_pending > 0) return { tone: 'text-violet-300', text: `Transcrição pendente: ${pkg.transcription_pending} arquivo(s)` };
  if (failed.length) return { tone: 'text-amber-300', text: `Transcrição falhou em ${failed.length}: ${failed[0].transcription_error || 'erro desconhecido'}` };
  if (items.length) return { tone: 'text-emerald-300', text: `Transcrito: ${items.length} arquivo(s)` };
  return null;
}

function failureText(pkg) {
  const failed = (pkg.items || []).filter((item) => item.status === 'failed');
  if (!failed.length) return 'Falha no processamento';
  return `${failed.length} arquivo(s) com falha: ${failed[0].error || 'erro desconhecido'}`;
}

export default function IngestList({ view, onNew, packages = [], error = '', runningId = null, onResume }) {
  const cfg = CONFIG[view];
  if (!cfg) return null;
  const Icon = cfg.icon;
  const filtered = packages.filter((p) => p.status === cfg.filter);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <Icon size={18} className={cfg.tone} />
          <div>
            <h1 className="text-xl font-bold text-slate-50">{cfg.title}</h1>
            <p className="text-sm text-slate-400">{filtered.length} {filtered.length === 1 ? 'pacote' : 'pacotes'}</p>
          </div>
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400"
        >
          <Plus size={14} /> Nova Ingestão
        </button>
      </div>

      {/* List */}
      <div className="flex-1 px-6 py-4">
        {error && <p role="alert" className="mb-3 rounded-md bg-rose-950/30 px-3 py-2 text-xs text-rose-300">{error}</p>}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Icon size={36} className="text-slate-700" />
            <p className="text-sm text-slate-500">Nenhum pacote neste estado.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((p) => (
              <div key={p.id} className="group rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 transition hover:border-sky-700">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800">
                      <Package size={18} className="text-slate-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-200">{p.name}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                        <span>{p.file_count} arquivos</span>
                        <span className="text-slate-700">•</span>
                        <span>{p.owner}</span>
                        <span className="text-slate-700">•</span>
                        <span className="font-mono">{packageDate(p)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {onResume && (view !== 'concluidas' || p.transcription_pending > 0) && (
                      <button type="button" disabled={Boolean(runningId)} onClick={() => onResume(p, { retry: view === 'falhas' })} className="flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50">
                        {runningId === p.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} {view === 'falhas' ? 'Reprocessar' : 'Continuar'}
                      </button>
                    )}
                    <StatusBadge status={p.status} />
                    <ChevronRight size={16} className="text-slate-600 transition group-hover:text-sky-400" />
                  </div>
                </div>
                {view === 'andamento' && (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Loader2 size={11} className={`${runningId === p.id ? 'animate-spin ' : ''}text-violet-400`} /> {runningId === p.id ? 'Copiando para a pasta de destino' : 'Parado — clique em Continuar'}
                      </span>
                      <span className="font-bold text-violet-300">{p.progress}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-violet-500" style={{ width: `${p.progress}%` }} />
                    </div>
                  </div>
                )}
                {transcriptionText(p) && (
                  <p className={`mt-2 text-xs ${transcriptionText(p).tone}`}>{transcriptionText(p).text}</p>
                )}
                {view === 'falhas' && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-md bg-rose-950/30 px-2 py-1 text-xs text-rose-300">
                    <AlertCircle size={11} /> {failureText(p)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}