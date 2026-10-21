import { useWorkDraftState, useWorkStorageKey } from "../lib/workProtection";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Download, Eye, Search, Upload } from 'lucide-react';
import { listMediaAssets, mediaStreamUrl, uploadMediaAsset } from '../../api/media';
import Workspace2Stepper from '../components/workspace2/Workspace2Stepper';
import Workspace2Script from '../components/workspace2/Workspace2Script';
import Workspace2Export from '../components/workspace2/Workspace2Export';
import Workspace2Create from '../components/workspace2/Workspace2Create';
import Timeline2 from './Timeline2';
import FilmCraftWorkspace from '../components/graphic-tools/FilmCraftWorkspace';
import UploadReceiptPanel from '../components/UploadReceiptPanel';
import { DEFAULT_WORKSPACE_MEDIA_SEARCH, appendScriptBlock, appendTextBlock, removeScriptBlock, reorderScriptBlocks, toggleSelectedAsset } from '../lib/workspace2Model';
import { workspace2ToTimeline2 } from '../lib/timeline2Model';
import { MOCK_ASSETS } from '../data';
import { findAssetById, workspaceAssetId } from '../lib/assetIdentity';

export default function Workspace2() {
  const storagePrefix = useWorkStorageKey("");
  // Deep-link vindo da Pesquisa/Acervo: ?assetId=<id> (ou o alias ?asset=<id>).
  const [searchParams] = useSearchParams();
  const linkedAssetId = workspaceAssetId(searchParams);
  const initialProject = {
    title: 'Jornal 12h - 15/05/2026', segment: 'Jornalismo', program: 'Jornal do Meio Dia',
    status: 'Rascunho', version: 'v1.0', estimatedDuration: '02:48:10', reporter: 'João Silva',
    producer: 'Maria Oliveira', editor: 'Alex',
  };
  const [activeStep, setActiveStep] = useWorkDraftState("pages/Workspace2.jsx:activeStep", 'create');
  const [assets, setAssets] = useState([]);
  const [selectedIds, setSelectedIds] = useWorkDraftState("pages/Workspace2.jsx:selectedIds", () => { try { return JSON.parse(localStorage.getItem(storagePrefix + 'mm_workspace_media_selection')) || []; } catch { return []; } });
  const [mediaSearch, setMediaSearch] = useWorkDraftState("pages/Workspace2.jsx:mediaSearch", () => { try { return JSON.parse(localStorage.getItem(storagePrefix + 'mm_workspace_media_search')) || DEFAULT_WORKSPACE_MEDIA_SEARCH; } catch { return DEFAULT_WORKSPACE_MEDIA_SEARCH; } });
  const [previewAssetId, setPreviewAssetId] = useWorkDraftState("pages/Workspace2.jsx:previewAssetId", null);
  const [blocks, setBlocks] = useWorkDraftState("pages/Workspace2.jsx:blocks", []);
  const [project, setProject] = useWorkDraftState("pages/Workspace2.jsx:project", initialProject);
  const [notice, setNotice] = useState('Projeto ativo · Não salvo');
  const [showPreview] = useState(true);
  const [showSearch] = useState(true);
  const [researchOpen, setResearchOpen] = useState(false);
  const [timelinePreview, setTimelinePreview] = useState('current');
  const locked = false;
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
      const linked = linkedAssetId ? findAssetById(normalized, linkedAssetId) : null;
      if (linked) {
        setSelectedIds((current) => (current.includes(linked.id) ? current : [...current, linked.id]));
        setPreviewAssetId(linked.id);
        setNotice(`Mídia aberta pelo link: ${linked.title || linked.id}`);
      } else {
        setPreviewAssetId((current) => current || normalized[0]?.id || null);
        if (linkedAssetId) setNotice('A mídia do link não foi encontrada no Acervo desta empresa.');
      }
    }).catch(() => {
      if (!active) return;
      const demo = MOCK_ASSETS.slice(0, 6).map((asset) => ({ ...asset, stream_url: mediaStreamUrl(asset) }));
      const demoBlocks = [
        { id: 'demo-open', title: 'Abertura — Apresentador', text: 'Boa noite! Você confere agora as principais notícias.', type: 'text', duration: 15 },
        ...demo.slice(0, 3).map((asset, index) => ({ id: `demo-${asset.id}`, assetId: asset.id, title: asset.title, type: 'media', duration: [27, 32, 18][index] })),
        { id: 'demo-close', title: 'Encerramento', text: 'Essas são as informações de hoje. Continue com a gente.', type: 'text', duration: 15 },
      ];
      setAssets(demo); setSelectedIds((current) => current.length ? current : demo.slice(0, 3).map((asset) => asset.id)); setPreviewAssetId(demo[0]?.id || null); setBlocks(current => current.length ? current : demoBlocks);
      setNotice('Acervo indisponível · exibindo dados demonstrativos para validar o roteiro');
    });
    return () => { active = false; };
  }, [linkedAssetId]);
  useEffect(() => { localStorage.setItem(storagePrefix + 'mm_workspace_media_selection', JSON.stringify(selectedIds)); }, [selectedIds, storagePrefix]);
  useEffect(() => { localStorage.setItem(storagePrefix + 'mm_workspace_media_search', JSON.stringify(mediaSearch)); }, [mediaSearch, storagePrefix]);

  const saveProject = () => {
    localStorage.setItem(storagePrefix + 'mm_workspace2_draft', JSON.stringify({ activeStep, selectedIds, previewAssetId, blocks, project }));
    setNotice('Projeto salvo localmente · Última alteração: agora');
  };
  const resetProject = () => {
    if (!window.confirm('Resetar o projeto? As mídias selecionadas, o roteiro e o rascunho salvo neste navegador serão descartados.')) return;
    setActiveStep('create'); setSelectedIds([]);
    setPreviewAssetId(assets[0]?.id || null); setBlocks([]); setProject(initialProject);
    localStorage.removeItem(storagePrefix + 'mm_workspace2_draft'); setNotice('Projeto restaurado ao padrão');
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
    localStorage.setItem(storagePrefix + 'mm_workspace2_timeline2_draft', JSON.stringify(document));
    setNotice('Projeto preparado para a Timeline 2');
    setActiveStep('timeline');
  };
  const changeStep = (step) => {
    if (step === 'timeline') openTimeline2(); else setActiveStep(step);
  };
  const preparedTimeline = workspace2ToTimeline2({ project, blocks, selectedAssets });
  const latestTimeline = (() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storagePrefix + `mm_timeline2_project:${preparedTimeline.id}`));
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
    onStepChange: changeStep,
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
    <div className="workspace2 -m-4 min-h-[calc(100vh-4rem)] bg-mm-page p-4 text-slate-100">
      <div className="mb-4 flex items-start gap-5">
        <div className="min-w-64">
          <h1 className="text-2xl font-bold">Workspace</h1>
          <p className="text-sm text-slate-400">Pesquisa, roteiro, prévia e edição em um único fluxo</p>
        </div>
        <div className="flex-1"><Workspace2Stepper activeStep={activeStep} onStepChange={changeStep} selectedCount={selectedIds.length} onSave={saveProject} onReset={resetProject} /></div>
      </div>
      <div role="status" className="mb-3 min-h-5 text-right text-xs text-sky-300">{notice}</div>
      <UploadReceiptPanel assets={uploadReceipts} />
      {!(activeStep === 'timeline' && timelinePreview === 'mmfilm') && <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-2">
        {(activeStep === 'script' || activeStep === 'timeline') && <span className="text-[10px] text-slate-500">Use a aba Pesquisa na lateral esquerda para buscar e arrastar mídias.</span>}
        <button type="button" onClick={() => importRef.current?.click()} className="w2-button"><Upload size={14} /> Importar mídias</button><input ref={importRef} aria-label="Importar mídias" type="file" multiple accept="video/*,audio/*,image/*" onChange={importMedia} className="hidden" />
        <button type="button" onClick={() => projectImportRef.current?.click()} className="w2-button">Importar projeto</button><input ref={projectImportRef} aria-label="Arquivo do projeto" type="file" accept="application/json,.json" onChange={importProject} className="hidden" />
        <button type="button" onClick={exportProject} className="w2-button"><Download size={14} /> Exportar</button>
      </div>}
      {activeStep === 'create' && <WorkspaceStageShell {...shared} showSearch={false} showPreview={false} contentOnRight><Workspace2Create {...shared} showSearch={false} showPreview={false} onOpenScript={openScript} onCreate={createScript} /></WorkspaceStageShell>}
      {activeStep === 'script' && <WorkspaceStageShell {...shared} collapsibleSearch showSearch={researchOpen} onToggleSearch={() => setResearchOpen((value) => !value)} showPreview={false} contentOnRight><Workspace2Script {...shared} showSearch={false} showPreview /></WorkspaceStageShell>}
      {activeStep === 'timeline' && <>
        <div role="tablist" aria-label="Comparar editores de timeline" className="mb-2 flex gap-2">
          <button role="tab" aria-selected={timelinePreview === 'current'} onClick={() => setTimelinePreview('current')} className="rounded-lg border border-slate-700 px-4 py-2 text-sm">Timeline atual</button>
          <button role="tab" aria-selected={timelinePreview === 'mmfilm'} onClick={() => setTimelinePreview('mmfilm')} className="rounded-lg border border-sky-700 px-4 py-2 text-sm text-sky-300">MMFilm · prévia</button>
        </div>
        <WorkspaceStageShell {...shared} collapsibleSearch showSearch={researchOpen} onToggleSearch={() => setResearchOpen((value) => !value)} showPreview={false} contentOnRight>
          <div hidden={timelinePreview !== 'current'}><Timeline2 embedded projectAssets={selectedAssets} /></div>
          {timelinePreview === 'mmfilm' && <div className="mmfilm-workspace-preview"><p className="mb-2 text-xs text-amber-300">Prévia independente para comparar o editor. As alterações aqui ainda não são enviadas à exportação do Workspace.</p><FilmCraftWorkspace previewAsset={previewAsset}/></div>}
        </WorkspaceStageShell>
      </>}
      {activeStep === 'export' && <WorkspaceStageShell {...shared} showSearch={false} showPreview={false} contentOnRight><Workspace2Export project={project} timeline={latestTimeline} onSave={saveProject} onNotice={setNotice} /></WorkspaceStageShell>}
    </div>
  );
}

function WorkspaceStageShell({ children, assets = [], selectedAssets = [], selectedIds = [], previewAsset, mediaSearch, onMediaSearchChange, onPreview, onToggle, showSearch, showPreview, contentOnRight = false, collapsibleSearch = false, onToggleSearch = () => {} }) {
  const query = mediaSearch?.filters?.filename || '';
  const visible = assets.filter((asset) => !query || `${asset.title} ${asset.filename || ''}`.toLowerCase().includes(query.toLowerCase())).slice(0, 10);
  const updateFilter = (key, value) => onMediaSearchChange({ ...mediaSearch, filters: { ...mediaSearch.filters, [key]: value } });
  const threeColumnLayout = showSearch && showPreview;
  const columns = collapsibleSearch ? `${showSearch ? '300px' : '42px'} minmax(0,1fr)` : showSearch ? (showPreview ? (contentOnRight ? '280px 300px minmax(0,1fr)' : '280px minmax(0,1fr) 300px') : '280px minmax(0,1fr)') : (showPreview ? 'minmax(0,1fr) 300px' : 'minmax(0,1fr)');
  return <div data-testid="workspace-stage-shell" className={`grid gap-2 transition-[grid-template-columns] duration-300 ${contentOnRight && threeColumnLayout ? 'w2-timeline-shell w2-preview-beside-search' : ''}`} style={{ gridTemplateColumns: columns }}>
    {collapsibleSearch && !showSearch && <aside className="w2-panel flex min-h-[760px] items-start justify-center py-3"><button type="button" aria-label="Abrir pesquisa lateral" onClick={onToggleSearch} className="flex flex-col items-center gap-2 rounded-lg px-2 py-3 text-sky-300 hover:bg-sky-950"><Search size={16}/><span className="[writing-mode:vertical-rl] text-[10px] font-bold uppercase tracking-widest">Pesquisa</span><ChevronRight size={14}/></button></aside>}
    {showSearch && <aside className="w2-panel overflow-hidden" aria-label="Pesquisa persistente do Workspace"><div className="flex items-center justify-between border-b border-slate-800 p-3"><span className="flex items-center gap-2 text-xs font-bold text-sky-300"><Search size={14}/> Pesquisa de mídias</span>{collapsibleSearch && <button type="button" aria-label="Recolher pesquisa lateral" onClick={onToggleSearch} className="rounded p-1 text-slate-400 hover:bg-slate-800"><ChevronLeft size={16}/></button>}</div><div className="space-y-2 border-b border-slate-800 p-3">{[['filename','Nome do arquivo'],['transcription','Fala / Transcrição'],['person','Pessoa / Apresentador']].map(([key,label]) => <label key={key} className="block text-[10px] text-slate-400">{label}<input aria-label={key === 'filename' ? 'Nome do arquivo' : label} value={mediaSearch?.filters?.[key] || ''} onChange={(event) => updateFilter(key, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs" placeholder={`Buscar por ${label.toLowerCase()}…`}/></label>)}<button type="button" onClick={() => onMediaSearchChange(DEFAULT_WORKSPACE_MEDIA_SEARCH)} className="w-full rounded-lg bg-slate-800 py-2 text-xs font-bold text-sky-300">Limpar pesquisa</button></div><div className="border-b border-slate-800 px-3 py-2 text-[10px] font-bold text-slate-400">MÍDIAS ENCONTRADAS ({visible.length})</div><div className="max-h-[570px] space-y-2 overflow-y-auto p-3">{visible.map((asset) => { const selected = selectedIds.includes(asset.id); const media = { id: asset.id, assetId: asset.id, name: asset.title || asset.filename, filename: asset.filename, kind: asset.asset_type, duration: Number(asset.duration) || 30, src: asset.stream_url, mimeType: asset.mime_type, origin: 'acervo' }; return <article key={asset.id} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData('application/x-workspace2-asset', String(asset.id)); event.dataTransfer.setData('application/x-timeline2-media', JSON.stringify(media)); if (!selected) onToggle(asset.id); }} className={`rounded-lg border p-2 hover:border-sky-600 ${selected ? 'border-sky-500 bg-sky-950/30' : 'border-slate-800'}`}><button type="button" aria-label={`Visualizar ${asset.title}`} onClick={() => onPreview(asset)} className="flex w-full items-center gap-2 text-left"><span className="grid h-10 w-12 shrink-0 place-items-center rounded bg-sky-950 text-xl">{asset.icon || '🎬'}</span><span className="min-w-0 flex-1"><strong className="block truncate text-xs">{asset.title}</strong><small className="text-[9px] text-slate-500">{asset.asset_type || 'mídia'} · arraste para usar</small></span><span className={`grid h-6 w-6 place-items-center rounded-full border text-xs ${selected ? 'border-sky-300 bg-sky-500 text-slate-950' : 'border-slate-600 text-sky-300'}`}>{selected ? '✓' : '+'}</span></button></article>; })}</div></aside>}
    <main className="min-w-0">{children}</main>
    {showPreview && <aside className="w2-panel p-3" aria-label="Prévia persistente do Workspace"><h3 className="flex items-center gap-2 border-b border-slate-800 pb-3 text-sm font-bold"><Eye size={15} className="text-sky-400"/> Preview da mídia</h3>{previewAsset?.stream_url && previewAsset.asset_type === 'video' ? <video src={previewAsset.stream_url} controls preload="metadata" className="mt-3 aspect-video w-full rounded-xl bg-black object-contain"/> : previewAsset?.stream_url && previewAsset.asset_type === 'audio' ? <div className="mt-3 grid aspect-video place-items-center rounded-xl bg-slate-950"><audio src={previewAsset.stream_url} controls preload="metadata" className="w-4/5"/></div> : <div className="mt-3 grid aspect-video place-items-center rounded-xl bg-gradient-to-br from-sky-950 via-blue-800 to-amber-300 text-5xl">{previewAsset?.icon || '🎬'}</div>}<h4 className="mt-3 font-bold">{previewAsset?.title || 'Selecione uma mídia'}</h4><p className="text-[10px] text-slate-500">{previewAsset?.filename || `ASSET-${previewAsset?.id || '—'}`}</p><div className="mt-3 grid grid-cols-2 gap-2 text-[10px]"><label>IN<input aria-label="IN da prévia persistente" defaultValue="00:00:00" className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"/></label><label>OUT<input aria-label="OUT da prévia persistente" defaultValue={previewAsset?.duration || 0} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"/></label></div><dl className="mt-3 grid grid-cols-[72px_1fr] gap-y-2 rounded-lg border border-slate-800 p-3 text-[10px]"><dt className="text-slate-500">Programa</dt><dd>{previewAsset?.program_name || '—'}</dd><dt className="text-slate-500">Categoria</dt><dd>{previewAsset?.category || '—'}</dd><dt className="text-slate-500">Data</dt><dd>{previewAsset?.reference_date || '—'}</dd><dt className="text-slate-500">Status</dt><dd>{previewAsset?.status || '—'}</dd></dl><p className="mt-3 text-xs text-slate-500">{selectedAssets.length} mídia(s) selecionada(s)</p>{previewAsset && <button type="button" onClick={() => onToggle(previewAsset.id)} className="mt-3 w-full rounded-lg bg-sky-500 py-2 text-xs font-bold text-slate-950">{selectedIds.includes(previewAsset.id) ? 'Remover da seleção' : 'Adicionar à seleção'}</button>}</aside>}
  </div>;
}
