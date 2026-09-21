import React, { useState, useMemo } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { DragDropContext } from '@hello-pangea/dnd';
import RoteiroScriptList from '../components/RoteiroScriptList';
import RoteiroEditor from '../components/RoteiroEditor';
import RoteiroMediaPanel from '../components/RoteiroMediaPanel';
import RoteiroTimeline from '../components/RoteiroTimeline';
import RoteiroMediaSelector from '../components/RoteiroMediaSelector';
import { MOCK_SCRIPTS, MOCK_ASSETS, formatDuration, formatTime, parseTime } from '../data';

// Mock items per script (matching the design reference)
const SCRIPT_ITEMS = {
  1: [
    { id: 101, type: 'media', track: 'v1', label: 'B-roll — Cidade ao amanhecer', icon: '🏙️', in: '00:00:00', out: '00:00:36', duration: '00:36', assetId: 7 },
    { id: 102, type: 'text', track: 't1', label: 'Texto de transição', content: 'As obras de revitalização mudam a rotina do centro.', duration: '00:15' },
    { id: 103, type: 'media', track: 'v1', label: 'Entrevista Prefeito', icon: '🎙️', in: '00:00:00', out: '00:00:45', duration: '00:45', assetId: 1 },
  ],
  2: [
    { id: 201, type: 'media', track: 'v1', label: 'Drone Centro Histórico', icon: '🚁', in: '00:00:00', out: '00:01:18', duration: '01:18', assetId: 2 },
    { id: 202, type: 'text', track: 't1', label: 'Contexto', content: 'Cobertura das enchentes no Rio Grande do Sul.', duration: '00:20' },
    { id: 203, type: 'media', track: 'v1', label: 'Comerciantes comentam', icon: '🧑‍💼', in: '00:00:00', out: '00:01:00', duration: '01:00', assetId: 3 },
    { id: 204, type: 'media', track: 'a1', label: 'Áudio base - trilha', icon: '🎧', in: '00:00:00', out: '00:03:40', duration: '03:40', assetId: 8 },
  ],
  3: [
    { id: 301, type: 'text', track: 't1', label: 'Abertura', content: 'Especial educação: o futuro das escolas públicas.', duration: '00:10' },
    { id: 302, type: 'media', track: 'v1', label: 'Entrevista - Festival de Inovação', icon: '🎬', in: '00:00:00', out: '00:02:34', duration: '02:34', assetId: 6 },
    { id: 303, type: 'media', track: 'v2', label: 'Obras de Revitalização', icon: '🏗️', in: '00:00:00', out: '00:01:03', duration: '01:03', assetId: 5 },
  ],
  4: [
    { id: 401, type: 'media', track: 'v1', label: 'Drone Centro Histórico', icon: '🚁', in: '00:00:00', out: '00:01:18', duration: '01:18', assetId: 2 },
    { id: 402, type: 'text', track: 't1', label: 'Narração', content: 'Documentário sobre turismo no estado.', duration: '00:25' },
    { id: 403, type: 'media', track: 'a1', label: 'Áudio base - trilha', icon: '🎧', in: '00:00:00', out: '00:03:42', duration: '03:42', assetId: 8 },
  ],
};

function computeDurationSeconds(durStr) {
  if (!durStr) return 0;
  if (durStr.length === 5) return parseTime('00:' + durStr);
  return parseTime(durStr);
}

export default function Timeline({ embedded = false }) {
  const [selectedId, setSelectedId] = useState(1);
  const [items, setItems] = useState(SCRIPT_ITEMS[1]);
  const [status, setStatus] = useState('reviewing');
  const [mediaToSelect, setMediaToSelect] = useState(null);

  const script = MOCK_SCRIPTS.find((s) => s.id === selectedId);

  const totalDuration = useMemo(() => {
    const total = items.reduce((s, i) => s + computeDurationSeconds(i.duration), 0);
    return formatTime(total);
  }, [items]);

  function selectScript(id) {
    setSelectedId(id);
    setItems(SCRIPT_ITEMS[id] || []);
    const s = MOCK_SCRIPTS.find((x) => x.id === id);
    setStatus(s?.status === 'in_review' ? 'reviewing' : s?.status || 'draft');
  }

  function createNew() {
    const newId = Math.max(...MOCK_SCRIPTS.map((s) => s.id)) + 1;
    setSelectedId(newId);
    setItems([]);
    setStatus('draft');
  }

  function addMedia(asset) {
    const track = asset.asset_type === 'audio' ? 'a1' : 'v1';
    const dur = formatDuration(asset.duration || 0);
    const newItem = {
      id: Date.now() + Math.random(),
      type: 'media',
      track,
      label: asset.title,
      icon: asset.icon,
      in: asset.clipIn || '00:00:00',
      out: asset.clipOut || (dur.length === 5 ? '00:' + dur : dur),
      duration: dur,
      assetId: asset.id,
    };
    setItems((prev) => [...prev, newItem]);
  }

  function addText() {
    const newItem = {
      id: Date.now() + Math.random(),
      type: 'text',
      track: 't1',
      label: 'Novo bloco de texto',
      content: '',
      duration: '00:10',
    };
    setItems((prev) => [...prev, newItem]);
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function updateItem(id, field, value) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  }

  function reorderItems(start, end) {
    setItems((prev) => {
      const arr = [...prev];
      const [moved] = arr.splice(start, 1);
      arr.splice(end, 0, moved);
      return arr;
    });
  }

  function onDragEnd(result) {
    const { source, destination } = result;
    if (!destination) return;

    const isTimelineDrop = destination.droppableId.startsWith('timeline-');
    const isEditorDrop = destination.droppableId === 'roteiro-editor';

    if ((source.droppableId === 'medias' || source.droppableId === 'media-panel') && (isEditorDrop || isTimelineDrop)) {
      const asset = MOCK_ASSETS[source.index];
      if (asset) {
        let track = asset.asset_type === 'audio' ? 'a1' : 'v1';
        if (isTimelineDrop) {
          track = destination.droppableId.replace('timeline-', '');
          if (asset.asset_type === 'audio' && track.startsWith('v')) track = 'a1';
          if (asset.asset_type !== 'audio' && track === 'a1') track = 'v1';
          if (track === 't1') track = asset.asset_type === 'audio' ? 'a1' : 'v1';
        }
        addMedia({ ...asset, track });
      }
    } else if (source.droppableId === 'roteiro-editor' && destination.droppableId === 'roteiro-editor') {
      reorderItems(source.index, destination.index);
    }
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className={`flex flex-col gap-3 ${embedded ? 'h-full' : 'h-[calc(100vh-8rem)]'}`}>
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-slate-50">Modo roteiro</h1>
          <p className="text-sm text-slate-400">Edite roteiros com blocos, mídias e timeline multi-camada.</p>
        </div>

        {/* Main area: columns (top) + timeline (bottom) */}
        <PanelGroup direction="vertical" className="min-h-0 flex-1">
          <Panel order={1} minSize={30} className="rounded-xl">
            <PanelGroup direction="horizontal">
              {/* Script list */}
              <Panel order={1} defaultSize={18} minSize={14} className="rounded-xl">
                <RoteiroScriptList
                  selectedId={selectedId}
                  onSelect={selectScript}
                  onCreate={createNew}
                />
              </Panel>
              <PanelResizeHandle className="w-1.5 shrink-0 rounded-full bg-slate-800 transition hover:bg-sky-600" />

              {/* Editor */}
              <Panel order={2} defaultSize={44} minSize={24} className="rounded-xl">
                <RoteiroEditor
                  script={script}
                  items={items}
                  status={status}
                  setStatus={setStatus}
                  onRemove={removeItem}
                  onUpdateItem={updateItem}
                  onReorder={reorderItems}
                  onAddText={addText}
                  totalDuration={totalDuration}
                />
              </Panel>
              <PanelResizeHandle className="w-1.5 shrink-0 rounded-full bg-slate-800 transition hover:bg-sky-600" />

              {/* Media panel */}
              <Panel order={3} defaultSize={22} minSize={14} className="rounded-xl">
                <RoteiroMediaPanel onAddMedia={setMediaToSelect} />
              </Panel>
            </PanelGroup>
          </Panel>

          <PanelResizeHandle className="h-1.5 shrink-0 rounded-full bg-slate-800 transition hover:bg-sky-600" />
          <Panel order={2} defaultSize={28} minSize={12} className="rounded-xl">
            <RoteiroTimeline items={items} onRemove={removeItem} />
          </Panel>
        </PanelGroup>
        <RoteiroMediaSelector
          asset={mediaToSelect}
          onCancel={() => setMediaToSelect(null)}
          onConfirm={(asset) => { addMedia(asset); setMediaToSelect(null); }}
        />
      </div>
    </DragDropContext>
  );
}
