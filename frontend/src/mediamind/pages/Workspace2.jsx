import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Eye, LayoutTemplate, Lock, PanelLeft, PanelRight, Search, Unlock, Upload } from 'lucide-react';
import { listMediaAssets, mediaStreamUrl, uploadMediaAsset } from '../../api/media';
import Workspace2Stepper from '../components/workspace2/Workspace2Stepper';
import Workspace2Search from '../components/workspace2/Workspace2Search';
import Workspace2Script from '../components/workspace2/Workspace2Script';
import Workspace2Export from '../components/workspace2/Workspace2Export';
import Workspace2Create from '../components/workspace2/Workspace2Create';
import Timeline2 from './Timeline2';
import UploadReceiptPanel from '../components/UploadReceiptPanel';
import { DEFAULT_WORKSPACE_MEDIA_SEARCH, appendScriptBlock, appendTextBlock, removeScriptBlock, reorderScriptBlocks, toggleSelectedAsset } from '../lib/workspace2Model';
import { workspace2ToTimeline2 } from '../lib/timeline2Model';
import { MOCK_ASSETS } from '../data';

export default function Workspace2() {
  const initialProject = {
    title: 'Jornal 12h - 15/05/2026', segment: 'Jornalismo', program: 'Jornal do Meio Dia',
    status: 'Rascunho', version: 'v1.0', estimatedDuration: '02:48:10', reporter: 'João Silva',
    producer: 'Maria Oliveira', editor: 'Alex',
  };
  const [activeStep, setActiveStep] = useState('search');
  const [assets, setAssets] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [mediaSearch, setMediaSearch] = useState(DEFAULT_WORKSPACE_MEDIA_SEARCH);
  const [previewAssetId, setPreviewAssetId] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [project, setProject] = useState(initialProject);
  const [notice, setNotice] = useState('Projeto ativo · Não salvo');
  const [showPreview, setShowPreview] = useState(true);
  const [showSearch, setShowSearch] = useState(true);
  const [locked, setLocked] = useState(false);
  const [uploadReceipts, setUploadReceipts] = useState([]);
  const importRef = useRef(null);
  const projectImportRef = useRef(null);
  const selectedAssets = useMemo(
    () => assets.filter((asset) => selectedIds.includes(asset.id)),
    [assets, selectedIds],
  );
  const previewAsset = assets.find((asset) => asset.id === previewAssetId) || assets[0];

  useEffect(() => {
    let active = true;
    listMediaAssets().then((items) => {
      if (!active) return;
      const normalized = items.map((asset) => ({ ...asset, title: asset.title || asset.filename, stream_url: mediaStreamUrl(asset), icon: asset.asset_type === 'audio' ? '🎵' : asset.asset_type === 'image' ? '🖼️' : '🎬' }));
      setAssets(normalized);
      setPreviewAssetId((current) => current || normalized[0]?.id || null);
    }).catch(() => {
      if (!active) return;
      const demo = MOCK_ASSETS.slice(0, 6).map((asset) => ({ ...asset, stream_url: mediaStreamUrl(asset) }));
      const demoBlocks = [
        { id: 'demo-open', title: 'Abertura — Apresentador', text: 'Boa noite! Você confere agora as principais notícias.', type: 'text', duration: 15 },
        ...demo.slice(0, 3).map((asset, index) => ({ id: `demo-${asset.id}`, assetId: asset.id, title: asset.title, type: 'media', duration: [27, 32, 18][index] })),
        { id: 'demo-close', title: 'Encerramento', text: 'Essas são as informações de hoje. Continue com a gente.', type: 'text', duration: 15 },
      ];
      setAssets(demo); setSelectedIds(demo.slice(0, 3).map((asset) => asset.id)); setPreviewAssetId(demo[0]?.id || null); setBlocks(demoBlocks);
      setNotice('Acervo indisponível · exibindo dados demonstrativos para validar o roteiro');
    });
    return () => { active = false; };
  }, []);

  const saveProject = () => {
    localStorage.setItem('mm_workspace2_draft', JSON.stringify({ activeStep, selectedIds, previewAssetId, blocks, project }));
    setNotice('Projeto salvo localmente · Última alteração: agora');
  };
  const resetProject = () => {
    setActiveStep('search'); setSelectedIds([]);
    setPreviewAssetId(assets[0]?.id || null); setBlocks([]); setProject(initialProject);
    localStorage.removeItem('mm_workspace2_draft'); setNotice('Projeto restaurado ao padrão');
  };
  const exportProject = () => {
    const blob = new Blob([JSON.stringify({ project, blocks, selectedIds }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'workspace2-projeto.json'; anchor.click(); URL.revokeObjectURL(url);
    setNotice('Projeto exportado');
  };
  const importProject = async (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.project) setProject((current) => ({ ...current, ...data.project }));
      if (Array.isArray(data.blocks)) setBlocks(data.blocks);
      if (Array.isArray(data.selectedIds)) setSelectedIds(data.selectedIds);
      setNotice('Projeto importado com sucesso');
    } catch { setNotice('Arquivo inválido: importe um projeto JSON do Workspace 2'); }
    event.target.value = '';
  };
  const importMedia = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setNotice(`Enviando ${files.length} arquivo(s) para o Acervo…`);
    try {
      const uploaded = await Promise.all(files.map((file) => uploadMediaAsset(file)));
      const normalized = uploaded.map((asset) => ({ ...asset, title: asset.title || asset.filename, stream_url: mediaStreamUrl(asset), icon: asset.asset_type === 'audio' ? '🎵' : asset.asset_type === 'image' ? '🖼️' : '🎬' }));
      setAssets((current) => [...normalized, ...current.filter((item) => !normalized.some((next) => next.id === item.id))]);
      setSelectedIds((current) => [...new Set([...current, ...normalized.map((item) => item.id)])]);
      setPreviewAssetId(normalized[0]?.id || null);
      setUploadReceipts(normalized);
      setNotice(`${normalized.length} arquivo(s) enviados ao Acervo e selecionados para o projeto.`);
    } catch (error) { setNotice(error?.message || 'Falha ao enviar mídia para o Acervo.'); }
    event.target.value = '';
  };
  const openTimeline2 = () => {
    const document = workspace2ToTimeline2({ project, blocks, selectedAssets });
    localStorage.setItem('mm_workspace2_timeline2_draft', JSON.stringify(document));
    setNotice('Projeto preparado para a Timeline 2');
    setActiveStep('timeline');
  };
  const preparedTimeline = workspace2ToTimeline2({ project, blocks, selectedAssets });
  const latestTimeline = (() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`mm_timeline2_project:${preparedTimeline.id}`));
      return saved?.tracks ? saved : preparedTimeline;
    } catch { return preparedTimeline; }
  })();

  const shared = {
    assets,
    selectedAssets,
    selectedIds,
    mediaSearch,
    onMediaSearchChange: setMediaSearch,
    previewAsset,
    blocks,
    onPreview: (asset) => setPreviewAssetId(asset.id),
    onToggle: (id) => setSelectedIds((ids) => toggleSelectedAsset(ids, id)),
    onClearSelection: () => setSelectedIds([]),
    onAddAsset: (asset) => { if (!locked) setBlocks((items) => appendScriptBlock(items, asset)); },
    onAddText: (text) => { if (!locked) setBlocks((items) => appendTextBlock(items, text)); },
    onRemoveBlock: (id) => { if (!locked) setBlocks((items) => removeScriptBlock(items, id)); },
    onReorderBlocks: (draggedId, targetId) => { if (!locked) setBlocks((items) => reorderScriptBlocks(items, draggedId, targetId)); },
    onStepChange: (step) => step === 'timeline' ? openTimeline2() : setActiveStep(step),
    project,
    onProjectChange: (field, value) => { if (!locked) setProject((current) => ({ ...current, [field]: value })); },
    onSave: saveProject,
    onSaveAs: () => { setProject((current) => ({ ...current, title: `${current.title} — cópia` })); setNotice('Cópia criada; salve para registrar'); },
    onExport: exportProject,
    onNotice: setNotice,
    showPreview,
    showSearch,
  };
  const openScript = (script) => {
    if (script) setProject((current) => ({ ...current, title: script.title, program: script.project_name || current.program }));
    setNotice(script ? `Roteiro “${script.title}” aberto` : 'Editor de roteiro aberto');
    setActiveStep('script');
  };
  const createScript = (source) => {
    if (source === 'media') setBlocks((current) => current.length ? current : selectedAssets.reduce((items, asset) => appendScriptBlock(items, asset), []));
    if (typeof source === 'string' && !['blank', 'media', 'brief', 'template'].includes(source)) setProject((current) => ({ ...current, template: source }));
    setNotice('Novo roteiro preparado');
    setActiveStep('script');
  };

  return (
    <div className="workspace2 -m-4 min-h-[calc(100vh-4rem)] bg-[#020817] p-4 text-slate-100">
      <div className="mb-4 flex items-start gap-5">
        <div className="min-w-64">
          <h1 className="text-2xl font-bold">Workspace <span className="text-amber-400">2</span></h1>
          <p className="text-sm text-slate-400">Pesquisa, roteiro, prévia e edição em um único fluxo</p>
        </div>
        <div className="flex-1"><Workspace2Stepper activeStep={activeStep} onStepChange={(step) => step === 'timeline' ? openTimeline2() : setActiveStep(step)} selectedCount={selectedIds.length} onSave={saveProject} onReset={resetProject} /></div>
      </div>
      <div role="status" className="mb-3 min-h-5 text-right text-xs text-sky-300">{notice}</div>
      <UploadReceiptPanel assets={uploadReceipts} />
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-2">
        <button type="button" onClick={() => setShowSearch((value) => !value)} aria-pressed={showSearch} className={`w2-button ${showSearch ? 'border-sky-500 bg-sky-500 text-slate-950' : ''}`}><PanelLeft size={14} /> {showSearch ? 'Ocultar pesquisa' : 'Mostrar pesquisa'}</button>
        <button type="button" onClick={() => setShowPreview((value) => !value)} className={`w2-button ${showPreview ? 'border-sky-500 bg-sky-500 text-slate-950' : ''}`}><PanelRight size={14} /> Prévia</button>
        <button type="button" onClick={() => importRef.current?.click()} className="w2-button"><Upload size={14} /> Importar mídias</button><input ref={importRef} aria-label="Importar mídias" type="file" multiple accept="video/*,audio/*,image/*" onChange={importMedia} className="hidden" />
        <button type="button" onClick={() => projectImportRef.current?.click()} className="w2-button">Importar projeto</button><input ref={projectImportRef} aria-label="Arquivo do projeto" type="file" accept="application/json,.json" onChange={importProject} className="hidden" />
        <button type="button" onClick={exportProject} className="w2-button"><Download size={14} /> Exportar</button>
        <button type="button" onClick={() => setNotice('Layout Padrão MediaMind ativo')} className="w2-button"><LayoutTemplate size={14} /> Layouts</button>
        <button type="button" onClick={() => { setLocked((value) => !value); setNotice(locked ? 'Projeto destravado' : 'Projeto travado para evitar alterações'); }} className={`w2-button ${locked ? 'border-amber-500 text-amber-300' : ''}`}>{locked ? <Lock size={14} /> : <Unlock size={14} />} Travar</button>
      </div>
      {activeStep === 'search' && <Workspace2Search {...shared} />}
      {activeStep === 'create' && <Workspace2Create {...shared} onOpenScript={openScript} onCreate={createScript} />}
      {activeStep === 'script' && <Workspace2Script {...shared} />}
      {activeStep === 'timeline' && <WorkspaceStageShell {...shared}><Timeline2 embedded /></WorkspaceStageShell>}
      {activeStep === 'export' && <WorkspaceStageShell {...shared}><Workspace2Export project={project} timeline={latestTimeline} onSave={saveProject} onNotice={setNotice} /></WorkspaceStageShell>}
    </div>
  );
}

function WorkspaceStageShell({ children, assets = [], selectedAssets = [], previewAsset, mediaSearch, onMediaSearchChange, onPreview, onToggle, showSearch, showPreview }) {
  const query = mediaSearch?.filters?.filename || '';
  const visible = assets.filter((asset) => !query || `${asset.title} ${asset.filename || ''}`.toLowerCase().includes(query.toLowerCase())).slice(0, 10);
  return <div className="grid gap-2" style={{ gridTemplateColumns: showSearch ? (showPreview ? '280px minmax(0,1fr) 300px' : '280px minmax(0,1fr)') : (showPreview ? 'minmax(0,1fr) 300px' : 'minmax(0,1fr)') }}>
    {showSearch && <aside className="w2-panel overflow-hidden" aria-label="Pesquisa persistente do Workspace"><div className="border-b border-slate-800 p-3"><label className="flex items-center gap-2 text-xs font-bold text-sky-300"><Search size={14}/> Pesquisa de mídias</label><input aria-label="Pesquisa de mídias persistente" value={query} onChange={(event) => onMediaSearchChange({ ...mediaSearch, filters: { ...mediaSearch.filters, filename: event.target.value } })} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs" placeholder="Buscar no acervo…"/></div><div className="max-h-[720px] space-y-2 overflow-y-auto p-3">{visible.map((asset) => <button type="button" key={asset.id} onClick={() => onPreview(asset)} className="flex w-full items-center gap-2 rounded-lg border border-slate-800 p-2 text-left hover:border-sky-600"><span className="text-xl">{asset.icon || '🎬'}</span><span className="min-w-0 flex-1 truncate text-xs">{asset.title}</span><span onClick={(event) => { event.stopPropagation(); onToggle(asset.id); }} className="text-sky-300">+</span></button>)}</div></aside>}
    <main className="min-w-0">{children}</main>
    {showPreview && <aside className="w2-panel p-3" aria-label="Prévia persistente do Workspace"><h3 className="flex items-center gap-2 border-b border-slate-800 pb-3 text-sm font-bold"><Eye size={15} className="text-sky-400"/> Prévia</h3><div className="mt-3 grid aspect-video place-items-center rounded-xl bg-gradient-to-br from-sky-950 via-blue-800 to-amber-300 text-5xl">{previewAsset?.icon || '🎬'}</div><h4 className="mt-3 font-bold">{previewAsset?.title || 'Selecione uma mídia'}</h4><p className="text-xs text-slate-500">{selectedAssets.length} mídia(s) selecionada(s)</p></aside>}
  </div>;
}
