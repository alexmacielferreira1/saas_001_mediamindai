import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileAudio } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { MOCK_ASSETS, formatTime } from '../data';
import { Panel } from '../ui';

// Pesquisa temporal: busca um termho nas transcrições reais (TranscricaoSegmento)
// e, ao clicar, abre o asset no Workspace posicionado no timecode exato (deep-link).
export default function SearchTranscriptResults({ query }) {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    base44.entities.TranscricaoSegmento.list('start_ms', 500)
      .then(setSegments)
      .catch(() => setSegments([]))
      .finally(() => setLoading(false));
  }, []);

  if (!query || query.trim().length < 2) return null;

  const assetMeta = (id) => MOCK_ASSETS.find((a) => a.id === id);
  const q = query.toLowerCase();
  const matches = segments.filter((s) => (s.texto || '').toLowerCase().includes(q));

  return (
    <Panel title={`Trechos ditos (${matches.length})`} right={<FileAudio size={16} className="text-violet-400" />}>
      {loading && <p className="text-sm text-slate-500">Buscando em transcrições…</p>}
      {!loading && matches.length === 0 && (
        <p className="text-sm text-slate-500">Nenhuma ocorrência em transcrições.</p>
      )}
      <div className="space-y-1.5">
        {matches.map((s) => {
          const meta = assetMeta(s.asset_id);
          return (
            <button
              key={s.id}
              onClick={() => navigate(`/workspace?assetId=${s.asset_id}&tc=${formatTime((s.start_ms || 0) / 1000)}`)}
              className="flex w-full items-start gap-2.5 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-left hover:border-violet-600/50"
              title="Abrir no workspace neste trecho"
            >
              <span className="text-lg">{meta?.icon || '🎬'}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-200">{meta?.title || `Asset ${s.asset_id}`}</p>
                <p className="line-clamp-2 text-xs text-slate-400">{s.texto}</p>
              </div>
              <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-violet-300">
                {formatTime((s.start_ms || 0) / 1000)}
              </span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}