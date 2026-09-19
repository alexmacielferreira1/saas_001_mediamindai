import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Search, Play, Music, Image, FileText, Filter, X, Clock,
} from 'lucide-react';
import { Panel, Badge, StatusBadge, SearchInput, Button, InfoRow, EmptyState } from '../ui';
import { formatDuration, formatSize } from '../data';
import { useMamData } from '../lib/mamData';
import SearchTranscriptResults from '../components/SearchTranscriptResults';

const ASSET_TYPE_ICONS = { video: Play, audio: Music, image: Image, document: FileText };
const CONTENT_TYPES = ['Entrevista', 'Imagem de apoio', 'Drone', 'Documento'];

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const { assets, loading } = useMamData();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setQuery(searchParams.get('q') || '');
  }, [searchParams]);

  const filtered = assets.filter((a) => {
    if (typeFilter !== 'all' && a.asset_type !== typeFilter) return false;
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (query) {
      const hay = `${a.title} ${a.filename} ${a.subjects} ${a.people} ${a.description}`.toLowerCase();
      if (!hay.includes(query.toLowerCase())) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-slate-700 border-t-sky-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="mb-2">
        <h1 className="text-xl font-bold text-slate-50">Pesquisa</h1>
        <p className="text-sm text-slate-400">Busca no acervo por transcrições, metadados e conteúdo</p>
      </div>

      <div className="flex gap-3">
        <SearchInput placeholder="Pesquisar mídias, transcrições, palavras-chave..." value={query} onChange={(e) => setQuery(e.target.value)} className="flex-1" />
        <Button variant="secondary" icon={<Filter size={16} />} onClick={() => setShowFilters(!showFilters)}>
          Filtros
        </Button>
      </div>

      {showFilters && (
        <Panel title="Filtros">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-400">Tipo</span>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500">
                <option value="all">Todos</option>
                <option value="video">Vídeo</option>
                <option value="audio">Áudio</option>
                <option value="image">Imagem</option>
                <option value="document">Documento</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-400">Status</span>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500">
                <option value="all">Todos</option>
                <option value="reviewed">Revisado</option>
                <option value="indexed">Indexado</option>
                <option value="processing">Processando</option>
                <option value="pending">Pendente</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-400">Data inicial</span>
              <input type="date" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-400">Data final</span>
              <input type="date" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500" />
            </label>
          </div>
        </Panel>
      )}

      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>{filtered.length} resultado(s)</span>
        {(typeFilter !== 'all' || statusFilter !== 'all') && (
          <button onClick={() => { setTypeFilter('all'); setStatusFilter('all'); }} className="flex items-center gap-1 text-sky-400 hover:text-sky-300">
            <X size={14} /> Limpar filtros
          </button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        {/* Resultados */}
        <div className="flex flex-col gap-2">
          {filtered.length === 0 ? (
            <Panel>
              <EmptyState icon={Search} title="Nenhum resultado" description="Tente outros termos de busca ou ajuste os filtros." />
            </Panel>
          ) : (
            filtered.map((a) => {
              const Icon = ASSET_TYPE_ICONS[a.asset_type] || FileText;
              return (
                <button
                  key={a.id}
                  onClick={() => setSelected(a)}
                  className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition hover:border-sky-700 ${selected?.id === a.id ? 'border-sky-600 bg-sky-950/20' : 'border-slate-800 bg-slate-900/40'}`}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xl">{a.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-slate-200">{a.title}</p>
                      <StatusBadge status={a.status} />
                    </div>
                    <p className="truncate text-xs text-slate-500">{a.filename}</p>
                    {a.subjects && <p className="mt-1 truncate text-xs text-slate-400">{a.subjects}</p>}
                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                      <span><Icon size={11} className="mr-1 inline" />{a.asset_type}</span>
                      <span><Clock size={11} className="mr-1 inline" />{formatDuration(a.duration)}</span>
                      <span>{formatSize(a.file_size)}</span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Detalhe */}
        {selected ? (
          <Panel title="Detalhes do arquivo">
            <div className="mb-3 flex h-32 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-5xl">
              {selected.icon}
            </div>
            <div className="flex flex-col gap-1">
              <InfoRow label="Título" value={selected.title} />
              <InfoRow label="Arquivo" value={selected.filename} />
              <InfoRow label="Tipo" value={selected.asset_type} />
              <InfoRow label="Status" value={selected.status} />
              <InfoRow label="Categoria" value={selected.category || '—'} />
              <InfoRow label="Local" value={selected.location || '—'} />
              <InfoRow label="Duração" value={formatDuration(selected.duration)} />
              <InfoRow label="Tamanho" value={formatSize(selected.file_size)} />
              <InfoRow label="Pessoas" value={selected.people || '—'} />
              <InfoRow label="Assuntos" value={selected.subjects || '—'} />
              <InfoRow label="Data" value={selected.reference_date || '—'} />
            </div>
            {selected.description && (
              <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <p className="mb-1 text-xs font-semibold text-slate-400">Descrição</p>
                <p className="text-xs text-slate-400">{selected.description}</p>
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <Link to={`/workspace?assetId=${selected.id}&title=${encodeURIComponent(selected.title)}`}><Button size="sm">Abrir no workspace</Button></Link>
              <Button variant="secondary" size="sm" disabled title="Disponível após a ingestão real do arquivo">Download</Button>
            </div>
          </Panel>
        ) : (
          <Panel>
            <EmptyState icon={FileText} title="Selecione um arquivo" description="Clique em um resultado para ver os detalhes." />
          </Panel>
        )}
      </div>

      <SearchTranscriptResults query={query} />
    </div>
  );
}