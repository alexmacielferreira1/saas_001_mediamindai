import React, { useCallback, useEffect, useState } from 'react';
import { FolderOpen, RefreshCw, FileVideo, FileAudio, FileImage, Check } from 'lucide-react';
import { getIngestSource } from '../../api/ingest';
import { formatBytes } from '../data';

const ICONS = { video: FileVideo, audio: FileAudio, image: FileImage };

/**
 * Arquivos da pasta de referência do servidor (entrada do Ingest). A seleção vira um pacote
 * que copia cada arquivo para a pasta de destino; o arquivo na entrada não é alterado.
 */
export default function IngestFolderPicker({ selected, onChange, disabled }) {
  const [source, setSource] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    getIngestSource()
      .then((data) => setSource(data))
      .catch((failure) => {
        setSource(null);
        setError(failure?.message || 'Não foi possível ler a pasta de referência.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const files = source?.files || [];
  const available = files.filter((file) => !file.imported_asset_id).map((file) => file.path);
  const chosen = new Set(selected);
  const toggle = (path) => onChange(chosen.has(path) ? selected.filter((item) => item !== path) : [...selected, path]);
  const allChosen = available.length > 0 && available.every((path) => chosen.has(path));

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <FolderOpen size={15} className="shrink-0 text-sky-400" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-200">Da pasta de referência</p>
            {source && <p className="truncate font-mono text-[11px] text-slate-500" title={source.source_folder}>{source.source_folder}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {available.length > 0 && (
            <button type="button" disabled={disabled} onClick={() => onChange(allChosen ? [] : available)} className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50">
              {allChosen ? 'Limpar seleção' : 'Selecionar novos'}
            </button>
          )}
          <button type="button" onClick={load} disabled={loading} aria-label="Atualizar a pasta de referência" className="rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:bg-slate-800 disabled:opacity-50">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-md bg-amber-950/30 px-2 py-1.5 text-xs text-amber-300">{error}</p>}
      {!error && !loading && files.length === 0 && (
        <p className="text-xs text-slate-500">A pasta está vazia. Coloque os vídeos, áudios ou imagens nela e clique em atualizar.</p>
      )}
      {files.length > 0 && (
        <div className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto">
          {files.map((file) => {
            const Icon = ICONS[file.asset_type] || FileVideo;
            const imported = Boolean(file.imported_asset_id);
            return (
              <label key={file.path} className={`flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-1.5 ${imported ? 'opacity-60' : 'cursor-pointer hover:border-sky-800'}`}>
                <input type="checkbox" checked={chosen.has(file.path)} disabled={disabled || imported} onChange={() => toggle(file.path)} aria-label={`Incluir ${file.path}`} className="accent-sky-500" />
                <Icon size={14} className="shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-200" title={file.path}>{file.path}</span>
                {imported && <span className="flex items-center gap-1 text-[10px] uppercase text-emerald-400"><Check size={11} /> No acervo</span>}
                <span className="shrink-0 text-xs text-slate-500">{formatBytes(file.size)}</span>
              </label>
            );
          })}
        </div>
      )}
      {source?.truncated && <p className="mt-2 text-[11px] text-slate-500">Mostrando os primeiros {files.length} arquivos da pasta.</p>}
    </div>
  );
}
