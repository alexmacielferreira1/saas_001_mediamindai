import React, { useState } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { Search, Upload, LayoutDashboard, FileText } from 'lucide-react';
import SearchPage from '../../../pages/Search';
import Ingest from '../../../pages/Ingest';
import Workspace from '../../../pages/Workspace';
import RoteiroEditor from '../../RoteiroEditor';
import RoteiroIAPanel from '../../RoteiroIAPanel';

// As 4 telas comuns que toda função recebe — Pesquisa, Ingest, Workspace e
// Modo Roteiro. Reaproveita as pages já existentes em vez de duplicar.
export const COMMON_SUBTABS = [
  { id: 'pesquisa', name: 'Pesquisa', Icon: Search },
  { id: 'ingest', name: 'Ingest', Icon: Upload },
  { id: 'workspace', name: 'Workspace', Icon: LayoutDashboard },
  { id: 'roteiro', name: 'Modo Roteiro', Icon: FileText },
];

export const COMMON_IDS = COMMON_SUBTABS.map((t) => t.id);

// Modo Roteiro standalone — dá ao RoteiroEditor um estado local mínimo pra
// funcionar como tela própria (blocos de texto/mídia, reordenação, status).
function ModoRoteiroScreen() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('draft');
  const script = { title: 'Novo roteiro', project_name: 'Corp' };
  const totalDuration = '00:00:00';

  function onRemove(id) { setItems((p) => p.filter((i) => i.id !== id)); }
  function onUpdateItem(id, field, value) { setItems((p) => p.map((i) => (i.id === id ? { ...i, [field]: value } : i))); }
  function onReorder(s, d) {
    setItems((p) => {
      const a = [...p];
      const [m] = a.splice(s, 1);
      a.splice(d, 0, m);
      return a;
    });
  }
  function onAddText() {
    const t = prompt('Texto do bloco:');
    if (t && t.trim()) setItems((p) => [...p, { id: Date.now(), type: 'text', track: 't1', content: t.trim() }]);
  }
  function onDragEnd(r) {
    if (r.destination && r.destination.index !== r.source.index) onReorder(r.source.index, r.destination.index);
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex h-full flex-col gap-3">
        <RoteiroIAPanel
          onApply={(blocos) => setItems((p) => [...p, ...blocos])}
          context={{ projectTitle: script.title, program: script.project_name }}
        />
        <div className="min-h-0 flex-1">
          <RoteiroEditor
            script={script}
            items={items}
            status={status}
            setStatus={setStatus}
            onRemove={onRemove}
            onUpdateItem={onUpdateItem}
            onReorder={onReorder}
            onAddText={onAddText}
            totalDuration={totalDuration}
          />
        </div>
      </div>
    </DragDropContext>
  );
}

export function CommonScreen({ active }) {
  if (active === 'pesquisa') return <div className="h-full overflow-y-auto"><SearchPage /></div>;
  if (active === 'ingest') return <div className="h-full overflow-y-auto"><Ingest /></div>;
  if (active === 'workspace') return <div className="h-full overflow-y-auto"><Workspace /></div>;
  if (active === 'roteiro') return <div className="h-full"><ModoRoteiroScreen /></div>;
  return null;
}