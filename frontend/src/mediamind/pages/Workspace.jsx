import React, { useState, useEffect, useRef } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { DragDropContext } from '@hello-pangea/dnd';
import {
  Lock, Unlock, Upload, Download, Layout as LayoutIcon,
  PanelLeft, PanelRight, Save, Search as SearchIcon, X,
  FileText, Film, Clapperboard,
} from 'lucide-react';
import WorkspaceSearchPanel from '../components/WorkspaceSearchPanel';
import WorkspaceMediaGrid from '../components/WorkspaceMediaGrid';
import WorkspacePreview from '../components/WorkspacePreview';
import WorkspaceRoteiroPanel from '../components/WorkspaceRoteiroPanel';
import WorkspaceTimelineBar from '../components/WorkspaceTimelineBar';
import { MOCK_ASSETS, formatDuration, parseTime } from '../data';
import { useSearchParams } from 'react-router-dom';
import { findAssetById, workspaceAssetId } from '../lib/assetIdentity';

const STORAGE_KEY = 'mm_workspace_layouts';

const SEGMENTS = ['Jornalismo', 'Esportes', 'Entretenimento', 'Documentário', 'Institucional'];
const PROGRAMS = ['Jornal do Meio Dia', 'Jornal da Noite', 'Especial Enchentes RS', 'Documentário Turismo'];
const STATUSES = ['Rascunho', 'Em revisão', 'Aprovado', 'Publicado'];

export default function Workspace() {
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);
  const [showRoteiro, setShowRoteiro] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);
  const [locked, setLocked] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(MOCK_ASSETS[6] || MOCK_ASSETS[0]);
  const [searchParams] = useSearchParams();
  const initialTc = searchParams.get('tc') || '';

  useEffect(() => {
    const assetId = workspaceAssetId(searchParams);
    if (assetId) {
      const found = findAssetById(MOCK_ASSETS, assetId);
      if (found) setSelectedAsset(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [items, setItems] = useState([
    {
      id: 1, assetId: 2, title: 'B-roll — Cidade ao amanhecer', icon: '🏙️',
      in: '00:01:12', out: '00:01:48', duration: 36, type: 'video', track: 'v1',
      filePath: '/media/BROLL_CIDADE_AMANHECER.mov', aiSummary: '',
    },
  ]);
  const [search, setSearch] = useState({ filename: '', transcription: '', person: '', gc: '', local: '', date: '' });
  const [savedLayouts, setSavedLayouts] = useState([]);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [project, setProject] = useState({
    title: 'Jornal 12h - 15/05/2026',
    segment: 'Jornalismo',
    program: 'Jornal do Meio Dia',
    status: 'Rascunho',
    version: 'v1.0',
    duration: '02:48:10',
    reporter: 'João Silva',
    producer: 'Maria Oliveira',
    editor: 'Alex',
    saved: false,
  });
  const fileInputRef = useRef(null);

  useEffect(() => {
    try {
      setSavedLayouts(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
    } catch {
      setSavedLayouts([]);
    }
  }, []);

  const layoutConfig = { showLeft, showRight, showRoteiro, showTimeline, locked };

  function saveLayout(name) {
    const layout = { name, config: layoutConfig, savedAt: new Date().toISOString() };
    const updated = [...savedLayouts.filter((l) => l.name !== name), layout];
    setSavedLayouts(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  function loadLayout(name) {
    const layout = savedLayouts.find((l) => l.name === name);
    if (!layout) return;
    const c = layout.config;
    setShowLeft(c.showLeft ?? true);
    setShowRight(c.showRight ?? true);
    setShowRoteiro(c.showRoteiro ?? true);
    setShowTimeline(c.showTimeline ?? false);
    setLocked(c.locked ?? false);
    setShowLayoutMenu(false);
  }

  function deleteLayout(name) {
    const updated = savedLayouts.filter((l) => l.name !== name);
    setSavedLayouts(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  function exportLayout() {
    const blob = new Blob([JSON.stringify(layoutConfig, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'mediamind-workspace-layout.json'; a.click();
    URL.revokeObjectURL(url);
  }

  function importLayout(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const c = JSON.parse(ev.target.result);
        if (c.showLeft !== undefined) setShowLeft(c.showLeft);
        if (c.showRight !== undefined) setShowRight(c.showRight);
        if (c.showRoteiro !== undefined) setShowRoteiro(c.showRoteiro);
        if (c.showTimeline !== undefined) setShowTimeline(c.showTimeline);
        if (c.locked !== undefined) setLocked(c.locked);
      } catch {
        alert('Arquivo de layout inválido');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const filteredAssets = MOCK_ASSETS.filter((a) => {
    if (search.filename && !`${a.title} ${a.filename}`.toLowerCase().includes(search.filename.toLowerCase())) return false;
    if (search.transcription && !`${a.description} ${a.subjects}`.toLowerCase().includes(search.transcription.toLowerCase())) return false;
    if (search.person && !`${a.people || ''}`.toLowerCase().includes(search.person.toLowerCase())) return false;
    if (search.gc && !`${a.subjects || ''}`.toLowerCase().includes(search.gc.toLowerCase())) return false;
    if (search.local && !`${a.location || ''}`.toLowerCase().includes(search.local.toLowerCase())) return false;
    if (search.date && a.reference_date !== search.date) return false;
    return true;
  });

  function computeDuration(inStr, outStr) {
    const d = parseTime(outStr) - parseTime(inStr);
    return Math.max(0, d);
  }

  function addRoteiroItem(asset, inPt, outPt, index, track) {
    const autoTrack = track || (asset.asset_type === 'audio' ? 'a1' : 'v1');
    const newItem = {
      id: Date.now() + Math.random(),
      assetId: asset.id,
      title: asset.title,
      icon: asset.icon,
      in: inPt || '00:00:00',
      out: outPt || formatDuration(asset.duration || 0),
      duration: computeDuration(inPt || '00:00:00', outPt || formatDuration(asset.duration || 0)) || (asset.duration || 0),
      type: asset.asset_type === 'audio' ? 'audio' : 'video',
      track: autoTrack,
      filePath: asset.filename || asset.path || '',
      aiSummary: '',
    };
    setItems((prev) => {
      const next = [...prev];
      if (index == null) next.push(newItem);
      else next.splice(index, 0, newItem);
      return next;
    });
    setShowTimeline(true);
    setProject((p) => ({ ...p, saved: false }));
  }

  function addTextItem(text, index) {
    const newItem = {
      id: Date.now() + Math.random(),
      assetId: null,
      title: text ? `${text.slice(0, 30)}${text.length > 30 ? '…' : ''}` : 'Bloco de texto',
      icon: '📝',
      in: '00:00:00',
      out: '00:00:05',
      duration: 5,
      type: 'text',
      track: 't1',
      text: text || '',
      filePath: '',
      aiSummary: '',
    };
    setItems((prev) => {
      const next = [...prev];
      if (index == null) next.push(newItem);
      else next.splice(index, 0, newItem);
      return next;
    });
    setShowTimeline(true);
    setProject((p) => ({ ...p, saved: false }));
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setProject((p) => ({ ...p, saved: false }));
  }

  function reorderItems(start, end) {
    setItems((prev) => {
      const arr = [...prev];
      const [moved] = arr.splice(start, 1);
      arr.splice(end, 0, moved);
      return arr;
    });
    setProject((p) => ({ ...p, saved: false }));
  }

  function updateItem(id, field, value) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
    setProject((p) => ({ ...p, saved: false }));
  }

  function insertAt(index) {
    if (selectedAsset) addRoteiroItem(selectedAsset, '00:00:00', formatDuration(selectedAsset.duration || 0), index);
  }

  function insertTextAt(index) {
    const text = prompt('Digite o texto do bloco:');
    if (text != null && text.trim()) addTextItem(text.trim(), index);
  }

  function onDragEnd(result) {
    const { source, destination } = result;
    if (!destination) return;

    const isTimelineDrop = destination.droppableId.startsWith('timeline-');
    const isRoteiroDrop = destination.droppableId === 'roteiro';

    if ((source.droppableId === 'medias' || source.droppableId === 'preview') && (isRoteiroDrop || isTimelineDrop)) {
      const assetId = result.draggableId.replace(/^(media|preview)-/, '');
      const asset = findAssetById(MOCK_ASSETS, assetId) || filteredAssets[source.index];
      if (asset) {
        let track = 'v1';
        if (isTimelineDrop) {
          track = destination.droppableId.replace('timeline-', '');
          if (asset.asset_type === 'audio' && track.startsWith('v')) track = 'a1';
          if (asset.asset_type !== 'audio' && track === 'a1') track = 'v1';
          if (track === 't1') track = asset.asset_type === 'audio' ? 'a1' : 'v1';
        }
        const insertIndex = isTimelineDrop ? null : destination.index;
        addRoteiroItem(asset, '00:00:00', formatDuration(asset.duration || 0), insertIndex, track);
      }
    } else if (source.droppableId === 'roteiro' && destination.droppableId === 'roteiro') {
      reorderItems(source.index, destination.index);
    }
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex h-[calc(100vh-8rem)] flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-50">Workspace editorial</h1>
            <p className="text-sm text-slate-400">Pesquisa, roteiro, prévia e timeline em um layout profissional personalizável.</p>
          </div>
          <span className="rounded-lg border border-emerald-700/40 bg-emerald-950/30 px-3 py-1.5 text-xs font-medium text-emerald-300">
            Layout salvo por usuário: Padrão MediaMind
          </span>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
          <button
            onClick={() => setShowLeft(!showLeft)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${showLeft ? 'bg-sky-500 text-slate-950' : 'border border-slate-700 text-slate-400 hover:bg-slate-800'}`}
          >
            <PanelLeft size={14} /> Pesquisa
          </button>
          <button
            onClick={() => setShowRight(!showRight)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${showRight ? 'bg-sky-500 text-slate-950' : 'border border-slate-700 text-slate-400 hover:bg-slate-800'}`}
          >
            <PanelRight size={14} /> Prévia
          </button>

          <div className="mx-1 h-5 w-px bg-slate-700" />

          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-800">
            <Upload size={14} /> Importar
          </button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={importLayout} />
          <button onClick={exportLayout} className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-800">
            <Download size={14} /> Exportar
          </button>

          <div className="relative">
            <button
              onClick={() => setShowLayoutMenu(!showLayoutMenu)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
            >
              <LayoutIcon size={14} /> Layouts
            </button>
            {showLayoutMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowLayoutMenu(false)} />
                <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-xl">
                  {savedLayouts.length === 0 && <p className="px-2 py-1.5 text-xs text-slate-500">Nenhum layout salvo</p>}
                  {savedLayouts.map((l) => (
                    <div key={l.name} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs hover:bg-slate-800">
                      <button onClick={() => loadLayout(l.name)} className="flex-1 text-left text-slate-300">{l.name}</button>
                      <div className="flex gap-1">
                        <button onClick={() => saveLayout(l.name)} className="text-slate-500 hover:text-sky-400"><Save size={12} /></button>
                        <button onClick={() => deleteLayout(l.name)} className="text-slate-500 hover:text-rose-400"><X size={12} /></button>
                      </div>
                    </div>
                  ))}
                  <div className="mt-1 border-t border-slate-700 pt-1">
                    <button
                      onClick={() => { const name = prompt('Nome do layout:'); if (name) { saveLayout(name); setShowLayoutMenu(false); } }}
                      className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-sky-400 hover:bg-slate-800"
                    >
                      <Save size={12} /> Salvar layout atual
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setLocked(!locked)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${locked ? 'bg-amber-500/20 text-amber-300' : 'border border-slate-700 text-slate-400 hover:bg-slate-800'}`}
          >
            {locked ? <Lock size={14} /> : <Unlock size={14} />} Travar
          </button>

          {/* Mode toggles */}
          <div className="ml-auto flex items-center gap-1 rounded-lg border border-slate-700 p-1">
            <button className="flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1 text-xs font-bold text-white">
              <Film size={13} /> Mídias encontradas
            </button>
            <button
              onClick={() => setShowRoteiro(!showRoteiro)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${showRoteiro ? 'bg-violet-500/30 text-violet-200' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <FileText size={13} /> Modo Roteiro
            </button>
            <button
              onClick={() => setShowTimeline(!showTimeline)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${showTimeline ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <Clapperboard size={13} /> Timeline
            </button>
          </div>
        </div>

        {/* Main area: columns (top) + optional timeline (bottom) */}
        <PanelGroup direction="vertical" className="min-h-0 flex-1">
          <Panel order={1} minSize={30} className="rounded-xl">
            <PanelGroup direction="horizontal">
              {showLeft && (
                <>
                  <Panel order={1} defaultSize={18} minSize={14} className="rounded-xl">
                    <WorkspaceSearchPanel search={search} setSearch={setSearch} />
                  </Panel>
                  {!locked && <PanelResizeHandle className="w-1.5 shrink-0 rounded-full bg-slate-800 transition hover:bg-sky-600" />}
                </>
              )}

              <Panel order={2} defaultSize={38} minSize={20} className="rounded-xl">
                <WorkspaceMediaGrid
                  assets={filteredAssets}
                  selectedAsset={selectedAsset}
                  onSelect={setSelectedAsset}
                />
              </Panel>

              {showRight && (
                <>
                  {!locked && <PanelResizeHandle className="w-1.5 shrink-0 rounded-full bg-slate-800 transition hover:bg-sky-600" />}
                  <Panel order={3} defaultSize={22} minSize={16} className="rounded-xl">
                    <WorkspacePreview
                      asset={selectedAsset}
                      onClose={() => setShowRight(false)}
                      onAddRoteiro={(a, i, o) => addRoteiroItem(a, i, o)}
                      initialInPoint={initialTc}
                    />
                  </Panel>
                </>
              )}

              {showRoteiro && (
                <>
                  {!locked && <PanelResizeHandle className="w-1.5 shrink-0 rounded-full bg-slate-800 transition hover:bg-sky-600" />}
                  <Panel order={4} defaultSize={22} minSize={16} className="rounded-xl">
                    <WorkspaceRoteiroPanel
                      items={items}
                      project={project}
                      setProject={setProject}
                      onRemove={removeItem}
                      onReorder={reorderItems}
                      onUpdateItem={updateItem}
                      onInsertAt={insertAt}
                      onInsertText={insertTextAt}
                      onToggleTimeline={() => setShowTimeline(true)}
                    />
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>

          {showTimeline && (
            <>
              {!locked && <PanelResizeHandle className="h-1.5 shrink-0 rounded-full bg-slate-800 transition hover:bg-sky-600" />}
              <Panel order={2} defaultSize={30} minSize={12} className="rounded-xl">
                <WorkspaceTimelineBar items={items} onRemove={removeItem} />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>
    </DragDropContext>
  );
}
