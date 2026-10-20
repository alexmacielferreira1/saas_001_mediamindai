import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listMediaAssets, mediaStreamUrl } from '../../api/media';
import Workspace2Search from '../components/workspace2/Workspace2Search';
import { MOCK_ASSETS } from '../data';
import { DEFAULT_WORKSPACE_MEDIA_SEARCH, toggleSelectedAsset } from '../lib/workspace2Model';

const SELECTION_KEY = 'mm_workspace_media_selection';
const SEARCH_KEY = 'mm_workspace_media_search';

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

export default function WorkspaceResearch() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => readJson(SELECTION_KEY, []));
  const [mediaSearch, setMediaSearch] = useState(() => readJson(SEARCH_KEY, DEFAULT_WORKSPACE_MEDIA_SEARCH));
  const [previewAssetId, setPreviewAssetId] = useState(null);
  const selectedAssets = useMemo(() => assets.filter((asset) => selectedIds.includes(asset.id)), [assets, selectedIds]);
  const previewAsset = assets.find((asset) => asset.id === previewAssetId) || assets[0];

  useEffect(() => {
    let active = true;
    listMediaAssets().then((items) => {
      if (!active) return;
      const normalized = items.map((asset) => ({ ...asset, title: asset.title || asset.filename, stream_url: mediaStreamUrl(asset), icon: asset.asset_type === 'audio' ? '🎵' : asset.asset_type === 'image' ? '🖼️' : '🎬' }));
      setAssets(normalized); setPreviewAssetId(normalized[0]?.id || null);
    }).catch(() => {
      if (!active) return;
      const demo = MOCK_ASSETS.slice(0, 6).map((asset) => ({ ...asset, stream_url: mediaStreamUrl(asset) }));
      setAssets(demo); setPreviewAssetId(demo[0]?.id || null);
    });
    return () => { active = false; };
  }, []);
  useEffect(() => { localStorage.setItem(SELECTION_KEY, JSON.stringify(selectedIds)); }, [selectedIds]);
  useEffect(() => { localStorage.setItem(SEARCH_KEY, JSON.stringify(mediaSearch)); }, [mediaSearch]);

  return <div className="workspace2 -m-4 min-h-[calc(100vh-4rem)] bg-mm-page p-4 text-slate-100">
    <header className="mb-4"><h1 className="text-2xl font-bold">Pesquisa</h1><p className="text-sm text-slate-400">Pesquise o acervo, visualize e selecione mídias para usar no Workspace.</p></header>
    <Workspace2Search
      assets={assets}
      selectedAssets={selectedAssets}
      selectedIds={selectedIds}
      previewAsset={previewAsset}
      mediaSearch={mediaSearch}
      onMediaSearchChange={setMediaSearch}
      onPreview={(asset) => setPreviewAssetId(asset.id)}
      onToggle={(id) => setSelectedIds((ids) => toggleSelectedAsset(ids, id))}
      onClearSelection={() => setSelectedIds([])}
      onStepChange={() => navigate('/corp?tab=producao&sub=workspace')}
    />
  </div>;
}
