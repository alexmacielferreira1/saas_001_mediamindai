import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Scissors, Plus, Send, Layers, Pencil, Sparkles,
} from 'lucide-react';
import { Panel, Badge, StatusBadge, MockBanner } from '../ui';
import {
  MOCK_PUBLICATIONS, MOCK_ASSETS, MOCK_PUBLICATION_CALENDAR,
  MOCK_SOCIAL_METRICS, PUBLICATION_PLATFORM_LABELS,
  formatDuration, formatSize,
} from '../data';
import { SocialMetrics } from '../components/SocialRightPanel';
import SocialCortesWorkspace from '../components/corp/SocialCortesWorkspace';
import { workspaceAssetId } from '../lib/assetIdentity';

const PRIMARY_TABS = [
  { key: 'cortes', label: 'Cortes', icon: Scissors },
  { key: 'versoes', label: 'Versões', icon: Layers },
  { key: 'preparar', label: 'Preparar', icon: Pencil },
  { key: 'aprovar', label: 'Aprovar e publicar', icon: Send },
];

const SECONDARY_FILTERS = [
  { key: 'cortes', label: 'Cortes e versões' },
  { key: 'publicar', label: 'Publicação, fila e aprovações' },
  { key: 'contas', label: 'Contas e integrações' },
  { key: 'biblioteca', label: 'Biblioteca disponível' },
  { key: 'calendario', label: 'Calendário' },
  { key: 'desempenho', label: 'Desempenho' },
  { key: 'sugestoes', label: 'Sugestões' },
];

export default function ViralClips({ incomingMedia = null }) {
  const [tab, setTab] = useState('cortes');
  const [newClipSignal, setNewClipSignal] = useState(0);
  const [preselectedAsset, setPreselectedAsset] = useState('');
  const [params, setParams] = useSearchParams();

  // Gatilho do botão "Novo": /social?novo=publicacao → aba Cortes + novo recorte.
  useEffect(() => {
    if (params.get('novo') === 'publicacao') {
      setTab('cortes');
      setNewClipSignal((n) => n + 1);
      setParams({}, { replace: true });
    }
    // Pré-seleção de asset vinda do Acervo/Pesquisa: /social?assetId=<id> (alias ?asset=<id>)
    const asset = workspaceAssetId(params);
    if (asset) {
      setTab('cortes');
      setPreselectedAsset(asset);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  function novoCorte() {
    setTab('cortes');
    setNewClipSignal((n) => n + 1);
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-sky-400">Central de conteúdo social</p>
          <h1 className="mt-0.5 text-xl font-bold text-slate-50">Cortes para Redes Sociais</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Selecione trechos do Acervo, gerencie versões e prepare cada corte antes de encaminhar para aprovação e publicação.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={novoCorte} className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-3.5 py-2 text-sm font-bold text-slate-950 transition hover:bg-sky-400">
            <Plus size={15} /> Novo corte
          </button>
          <button className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3.5 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800">
            <Send size={14} /> Ir para aprovação
          </button>
        </div>
      </div>

      {/* Metrics */}
      <SocialMetrics />

      <div className="flex items-center gap-2 border-y border-slate-800 py-2 text-[10px] text-slate-400">
        <Sparkles size={13} className="text-sky-400" /> Cortes, versões, preparo, aprovação, publicação, biblioteca, calendário e desempenho agora fazem parte do fluxo integrado de seis etapas.
      </div>

      <div className="min-h-0 flex-1">
        <SocialCortesWorkspace onProsseguir={() => setTab('aprovar')} newClipSignal={newClipSignal} preselectedAssetId={preselectedAsset} incomingMedia={incomingMedia} />
      </div>
    </div>
  );
}

function VersionsView() {
  return (
    <Panel title="Versões de cortes">
      <MockBanner note="Gerenciamento de versões — dados de exemplo." />
      <div className="flex flex-col gap-2">
        {MOCK_PUBLICATIONS.slice(0, 3).map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
            <Layers size={16} className="text-sky-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-200">{p.title}</p>
              <p className="text-xs text-slate-500">{PUBLICATION_PLATFORM_LABELS[p.platform]} · v1</p>
            </div>
            <StatusBadge status={p.status} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

function PrepareView() {
  return (
    <Panel title="Preparo de cortes">
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <Pencil size={36} className="text-slate-700" />
        <p className="text-sm text-slate-500">Selecione um corte na aba "Cortes" para iniciar o preparo.</p>
      </div>
    </Panel>
  );
}

function PublishView() {
  return (
    <div className="h-full space-y-3 overflow-y-auto">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-emerald-700/30 bg-emerald-500/10 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Publicados</p>
          <p className="text-2xl font-bold text-emerald-300">{MOCK_PUBLICATIONS.filter((p) => p.status === 'published').length}</p>
        </div>
        <div className="rounded-xl border border-amber-700/30 bg-amber-500/10 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Aguardando</p>
          <p className="text-2xl font-bold text-amber-300">{MOCK_PUBLICATIONS.filter((p) => p.status === 'pending_review').length}</p>
        </div>
        <div className="rounded-xl border border-sky-700/30 bg-sky-500/10 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Total views</p>
          <p className="text-2xl font-bold text-sky-300">{MOCK_PUBLICATIONS.reduce((s, p) => s + p.views, 0).toLocaleString('pt-BR')}</p>
        </div>
        <div className="rounded-xl border border-violet-700/30 bg-violet-500/10 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Total likes</p>
          <p className="text-2xl font-bold text-violet-300">{MOCK_PUBLICATIONS.reduce((s, p) => s + p.likes, 0).toLocaleString('pt-BR')}</p>
        </div>
      </div>
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2.5 text-left font-semibold">Título</th>
                <th className="px-3 py-2.5 text-left font-semibold">Plataforma</th>
                <th className="px-3 py-2.5 text-left font-semibold">Status</th>
                <th className="px-3 py-2.5 text-left font-semibold">Views</th>
                <th className="px-3 py-2.5 text-left font-semibold">Likes</th>
                <th className="px-3 py-2.5 text-left font-semibold">Publicado em</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_PUBLICATIONS.map((p) => (
                <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-3 py-3 font-medium text-slate-200">{p.title}</td>
                  <td className="px-3 py-3"><Badge tone="info">{PUBLICATION_PLATFORM_LABELS[p.platform]}</Badge></td>
                  <td className="px-3 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-3 py-3 text-slate-400">{p.views.toLocaleString('pt-BR')}</td>
                  <td className="px-3 py-3 text-slate-400">{p.likes.toLocaleString('pt-BR')}</td>
                  <td className="px-3 py-3 text-slate-500">{p.published_at || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function AccountsView() {
  const accounts = [
    { platform: 'instagram', handle: '@mediamind.ai', connected: true, followers: '182k' },
    { platform: 'youtube', handle: 'MediaMind AI', connected: true, followers: '48k' },
    { platform: 'tiktok', handle: '@mediamind', connected: true, followers: '310k' },
    { platform: 'facebook', handle: 'MediaMind AI', connected: false, followers: '32k' },
  ];
  return (
    <Panel title="Contas conectadas">
      <div className="grid gap-3 sm:grid-cols-2">
        {accounts.map((a) => (
          <div key={a.platform} className="mm-panel flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-200">{PUBLICATION_PLATFORM_LABELS[a.platform]}</p>
              <p className="text-sm text-slate-500">{a.handle} · {a.followers} seguidores</p>
            </div>
            <Badge tone={a.connected ? 'success' : 'error'}>
              {a.connected ? 'Conectado' : 'Desconectado'}
            </Badge>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function LibraryView() {
  return (
    <Panel title="Biblioteca de conteúdo">
      <MockBanner note="Biblioteca de mídias para redes sociais — dados de exemplo." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MOCK_ASSETS.slice(0, 6).map((a) => (
          <div key={a.id} className="mm-panel mm-card-hover">
            <div className="mb-2 flex h-24 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-3xl">{a.icon}</div>
            <p className="truncate text-sm font-medium text-slate-200">{a.title}</p>
            <p className="text-xs text-slate-500">{formatDuration(a.duration)} · {formatSize(a.file_size)}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function CalendarView() {
  return (
    <Panel title="Calendário de publicações">
      <div className="flex flex-col gap-2">
        {MOCK_PUBLICATION_CALENDAR.map((c, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5">
            <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-slate-800">
              <span className="text-xs font-bold text-sky-300">{c.date.split('/')[0]}</span>
              <span className="text-[10px] text-slate-500">{c.date.split('/')[1]}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-200">{c.title}</p>
              <p className="text-xs text-slate-500">{PUBLICATION_PLATFORM_LABELS[c.platform] || c.platform}</p>
            </div>
            <Badge tone={c.status === 'Agendado' ? 'info' : 'pending'}>{c.status}</Badge>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function PerformanceView() {
  return (
    <Panel title="Desempenho por rede">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2.5 text-left font-semibold">Plataforma</th>
              <th className="px-3 py-2.5 text-left font-semibold">Seguidores</th>
              <th className="px-3 py-2.5 text-left font-semibold">Engajamento</th>
              <th className="px-3 py-2.5 text-left font-semibold">Publicados</th>
              <th className="px-3 py-2.5 text-left font-semibold">Views</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_SOCIAL_METRICS.map((s, i) => (
              <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className="px-3 py-3 font-medium text-slate-200">{s.platform}</td>
                <td className="px-3 py-3 text-slate-400">{s.followers}</td>
                <td className="px-3 py-3 text-sky-300">{s.engagement}</td>
                <td className="px-3 py-3 text-slate-400">{s.published}</td>
                <td className="px-3 py-3 text-violet-300">{s.views}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function SuggestionsView() {
  const sugestoes = [
    '24 vídeos similares a "chuva em porto alegre"',
    '5 novos clipes com "apresentador joão"',
    '12 entrevistas sobre "economia" ainda não utilizadas',
    'Melhor horário para Instagram: 18h–20h',
    'TikTok: cortes de 15–30s performam melhor',
  ];
  return (
    <Panel title="Sugestões da IA">
      <div className="flex flex-col gap-2">
        {sugestoes.map((s, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5 text-sm text-slate-300">
            <Sparkles size={15} className="shrink-0 text-sky-400" />
            {s}
          </div>
        ))}
      </div>
    </Panel>
  );
}
