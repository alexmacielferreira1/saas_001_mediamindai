import { useMemo, useState } from 'react';
import { Check, Download, Film, GripVertical, MoreVertical, Play, Plus, Save, Search, Send, Trash2, Type } from 'lucide-react';
import { formatDuration, MOCK_SCRIPTS } from '../../data';
import { DEFAULT_WORKSPACE_MEDIA_SEARCH, filterWorkspaceAssets } from '../../lib/workspace2Model';

export default function Workspace2Script({
  assets = [], selectedAssets = [], selectedIds = [], blocks = [], onAddAsset = () => {}, onRemoveBlock = () => {}, onReorderBlocks = () => {},
  onToggle = () => {}, onPreview = () => {}, mediaSearch, onMediaSearchChange,
  onAddText = () => {}, onStepChange = () => {}, project = {}, onProjectChange = () => {},
  onSave = () => {}, onSaveAs = () => {}, onExport = () => {}, onNotice = () => {},
}) {
  const [activeScriptId, setActiveScriptId] = useState(MOCK_SCRIPTS[0]?.id);
  const [localMediaSearch, setLocalMediaSearch] = useState(DEFAULT_WORKSPACE_MEDIA_SEARCH);
  const mediaCount = blocks.filter((block) => block.type === 'media').length;
  const textCount = blocks.filter((block) => block.type === 'text').length;
  const availableAssets = assets.length ? assets : selectedAssets;
  const effectiveSearch = mediaSearch || localMediaSearch;
  const changeSearch = (updater) => {
    const next = typeof updater === 'function' ? updater(effectiveSearch) : updater;
    if (onMediaSearchChange) onMediaSearchChange(next);
    else setLocalMediaSearch(next);
  };
  const visibleAssets = useMemo(() => filterWorkspaceAssets(availableAssets, effectiveSearch), [availableAssets, effectiveSearch]);
  const updateFilter = (key, value) => changeSearch((current) => ({ ...current, filters: { ...current.filters, [key]: value } }));
  const addAsset = (asset) => {
    if (!selectedIds.includes(asset.id) && !selectedAssets.some((item) => item.id === asset.id)) onToggle(asset.id);
    onAddAsset(asset);
  };
  const openScript = (script) => {
    setActiveScriptId(script.id);
    onProjectChange('title', script.title);
    if (script.project_name) onProjectChange('program', script.project_name);
    onNotice(`Roteiro “${script.title}” aberto`);
  };
  const handleDrop = (event) => {
    event.preventDefault();
    const id = event.dataTransfer.getData('application/x-workspace2-asset');
    const asset = availableAssets.find((item) => String(item.id) === id);
    if (asset) addAsset(asset);
  };
  const handleBlockDrop = (event, targetId) => {
    const draggedId = event.dataTransfer.getData('application/x-workspace2-block');
    if (!draggedId) return;
    event.preventDefault();
    event.stopPropagation();
    onReorderBlocks(draggedId, targetId);
  };
  const field = (label, name, type = 'input') => <label className="text-[10px] text-slate-400"><span className="mb-1 block">{label}</span>{type === 'select' ? <select aria-label={label} value={project[name] || ''} onChange={(event) => onProjectChange(name, event.target.value)} className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-xs text-white"><option>Jornalismo</option><option>Entretenimento</option><option>Institucional</option></select> : <input aria-label={label} value={project[name] || ''} onChange={(event) => onProjectChange(name, event.target.value)} className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-xs text-white" />}</label>;
  return (
    <section data-testid="workspace2-script" className="grid min-h-[760px] grid-cols-[340px_minmax(520px,1fr)_300px] gap-2">
      <aside aria-label="Mídias do Acervo" className="w2-panel flex min-h-0 flex-col overflow-hidden">
        <header className="border-b border-slate-800 px-4 py-3"><h2 className="flex items-center gap-2 font-bold"><Search size={15} className="text-sky-400" /> Mídias do Acervo ({visibleAssets.length})</h2><p className="text-[11px] text-slate-400">A pesquisa do Passo 1 continua ativa. Arraste ou adicione ao roteiro.</p></header>
        <div className="space-y-2 border-b border-slate-800 p-3">
          <input aria-label="Pesquisa rápida de mídias" value={effectiveSearch.filters.filename} onChange={(event) => updateFilter('filename', event.target.value)} placeholder="Nome do arquivo…" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs" />
          <div className="grid grid-cols-2 gap-2">
            <input aria-label="Fala ou transcrição no roteiro" value={effectiveSearch.filters.transcription} onChange={(event) => updateFilter('transcription', event.target.value)} placeholder="Fala / transcrição…" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-[10px]" />
            <input aria-label="Pessoa na mídia do roteiro" value={effectiveSearch.filters.person} onChange={(event) => updateFilter('person', event.target.value)} placeholder="Pessoa…" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-[10px]" />
            <input aria-label="GC da mídia do roteiro" value={effectiveSearch.filters.gc} onChange={(event) => updateFilter('gc', event.target.value)} placeholder="GC / texto…" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-[10px]" />
            <input aria-label="Local da mídia do roteiro" value={effectiveSearch.filters.local} onChange={(event) => updateFilter('local', event.target.value)} placeholder="Local…" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-[10px]" />
          </div>
          <input aria-label="Data da mídia do roteiro" type="date" value={effectiveSearch.filters.date} onChange={(event) => updateFilter('date', event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-[10px] text-slate-300" />
          <div className="flex flex-wrap gap-1">{[['all', 'Todas'], ['video', 'Vídeos'], ['audio', 'Áudios'], ['image', 'Imagens'], ['document', 'Docs']].map(([id, label]) => <button type="button" key={id} onClick={() => changeSearch((current) => ({ ...current, quickType: id }))} className={`rounded border px-2 py-1 text-[9px] ${effectiveSearch.quickType === id ? 'border-sky-500 bg-sky-500 text-slate-950' : 'border-slate-700 text-slate-400'}`}>{label}</button>)}</div>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">{visibleAssets.map((asset) => {
          const selected = selectedIds.includes(asset.id) || selectedAssets.some((item) => item.id === asset.id);
          return <article draggable onDragStart={(event) => event.dataTransfer.setData('application/x-workspace2-asset', String(asset.id))} onClick={() => onPreview(asset)} key={asset.id} className={`flex cursor-grab items-center gap-3 rounded-xl border bg-slate-950 p-2 ${selected ? 'border-sky-600' : 'border-slate-700'}`}><span className="grid h-12 w-16 shrink-0 place-items-center rounded bg-gradient-to-br from-sky-950 to-amber-400 text-2xl">{asset.icon}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{asset.title}</p><p className="text-[10px] text-slate-400">{formatDuration(asset.duration || 0)} · {asset.asset_type || 'mídia'}</p><span className={`mt-1 inline-flex items-center gap-1 text-[9px] ${selected ? 'text-emerald-300' : 'text-slate-500'}`}>{selected && <Check size={10} />}{selected ? 'Selecionada' : 'Disponível'}</span></div><button type="button" aria-label={`Adicionar ${asset.title} ao roteiro`} onClick={(event) => { event.stopPropagation(); addAsset(asset); }} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-sky-700 text-sky-300 hover:bg-sky-950"><Plus size={15} /></button></article>;
        })}{visibleAssets.length === 0 && <p className="rounded-lg border border-dashed border-slate-700 p-4 text-center text-xs text-slate-500">Nenhuma mídia corresponde aos filtros mantidos do Passo 1.</p>}</div>
      </aside>

      <main className="flex min-w-0 flex-col gap-2">
        <div className="w2-panel p-3">
          <div className="mb-3 flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase text-sky-400">Projeto ativo</p><h2 className="text-lg font-bold">{project.title || 'Sem título'}</h2><p className="text-[10px] text-slate-500">Última alteração: atualiza ao salvar</p></div><div className="grid grid-cols-3 gap-2 text-center text-[10px]"><span className="rounded border border-slate-700 p-2">Clipes<strong className="block text-lg text-white">{mediaCount}</strong></span><span className="rounded border border-slate-700 p-2">Textos<strong className="block text-lg text-white">{textCount}</strong></span><span className="rounded border border-slate-700 p-2">Versão<strong className="block text-sm text-white">{project.version}</strong></span></div></div>
          <div className="grid grid-cols-4 gap-2">{field('Nome do projeto', 'title')}{field('Segmento', 'segment', 'select')}{field('Programa', 'program')}{field('Status', 'status')}{field('Versão', 'version')}{field('Duração estimada', 'estimatedDuration')}{field('Repórter', 'reporter')}{field('Produtor', 'producer')}{field('Editor', 'editor')}</div>
        </div>
        <div className="w2-panel p-3">
          <div className="mb-3 flex items-center gap-2"><div><h2 className="text-xl font-bold">{project.title}</h2><p className="text-xs text-slate-400">{project.program} · {blocks.length} blocos</p></div><div className="ml-auto flex flex-wrap gap-2"><button type="button" onClick={onSave} className="w2-button"><Save size={14} /> Salvar</button><button type="button" onClick={onSaveAs} className="w2-button">Salvar como</button><button type="button" onClick={() => onNotice('Versões: v1.0 ativa')} className="w2-button">Versões</button><button type="button" onClick={onExport} className="w2-button"><Download size={14} /> Exportar</button><button type="button" aria-label="Ir para Timeline" onClick={() => { onNotice('Projeto encaminhado para edição'); onStepChange('timeline'); }} className="flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950"><Send size={14} /> Enviar para edição</button></div></div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 p-3"><div className="grid h-24 w-44 place-items-center rounded-lg bg-gradient-to-br from-blue-950 via-sky-800 to-amber-300 text-5xl">🏙️</div><button type="button" className="grid h-11 w-11 place-items-center rounded-full bg-sky-500 text-slate-950"><Play fill="currentColor" /></button><div className="flex-1"><p className="text-xs text-slate-400">Preview do roteiro</p><p className="font-bold">Jornal 15h – 15/06</p><div className="mt-3 h-1.5 rounded bg-slate-800"><div className="h-full w-1/3 rounded bg-sky-500" /></div></div></div>
        </div>

        <div className="w2-panel flex-1 p-3" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
          <header className="mb-3 flex items-center justify-between"><div><h2 className="text-base font-bold">Roteiro / Blocos ({blocks.length})</h2><p className="text-[10px] text-sky-300">Arraste mídias da coluna esquerda →</p></div><div className="flex gap-2"><button type="button" onClick={() => onAddText('Novo bloco de texto')} className="w2-button"><Type size={14} /> Adicionar texto</button><button type="button" onClick={() => onNotice('Arraste os blocos pela alça para reordenar')} className="w2-button"><GripVertical size={14} /> Reordenar</button></div></header>
          {blocks.length === 0 ? <div className="grid min-h-72 place-items-center rounded-xl border border-dashed border-slate-700 text-center text-sm text-slate-500"><div><Film className="mx-auto mb-3" /><p>Adicione mídias selecionadas ao roteiro.</p></div></div> : <div className="space-y-2">{blocks.map((block, index) => <article key={block.id} aria-label={`Bloco ${index + 1}: ${block.title}`} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-workspace2-block', String(block.id)); }} onDragOver={(event) => { if (event.dataTransfer.types?.includes?.('application/x-workspace2-block')) event.preventDefault(); }} onDrop={(event) => handleBlockDrop(event, block.id)} className={`flex cursor-grab items-center gap-3 rounded-xl border p-3 active:cursor-grabbing ${block.type === 'text' ? 'border-violet-700 bg-violet-950/20' : 'border-sky-700 bg-sky-950/20'}`}><GripVertical size={16} className="text-slate-500" /><span className="w-6 text-xs text-slate-400">{String(index + 1).padStart(2, '0')}</span><span className={`grid h-9 w-9 place-items-center rounded-lg ${block.type === 'text' ? 'bg-violet-800' : 'bg-sky-800'}`}>{block.type === 'text' ? <Type size={16} /> : <Film size={16} />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{block.title}</p><p className="text-[10px] text-slate-400">{block.type === 'text' ? 'Bloco de texto' : `MÍDIA · ${formatDuration(block.duration || 0)}`}</p></div><button type="button" aria-label={`Remover bloco ${block.title}`} onClick={() => onRemoveBlock(block.id)} className="rounded p-2 text-slate-500 hover:bg-rose-950 hover:text-rose-300"><Trash2 size={15} /></button></article>)}</div>}
        </div>
      </main>

      <aside aria-label="Lista de roteiros" className="w2-panel overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-3 text-base font-bold">Roteiros ({MOCK_SCRIPTS.length})</div>
        <div className="p-3"><button type="button" className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500 py-2 text-xs font-bold text-slate-950"><Plus size={15} /> Criar novo roteiro</button></div>
        <div className="space-y-2 px-3">{MOCK_SCRIPTS.map((script) => <button type="button" aria-label={`Abrir roteiro ${script.title}`} aria-pressed={activeScriptId === script.id} onClick={() => openScript(script)} key={script.id} className={`block w-full rounded-xl border p-3 text-left ${activeScriptId === script.id ? 'border-sky-400 bg-sky-950/30' : 'border-slate-700 bg-slate-950/40 hover:border-slate-500'}`}><div className="flex items-start justify-between"><div><h3 className="text-sm font-bold">{script.title}</h3><p className="text-xs text-slate-400">{script.project_name}</p></div><MoreVertical size={15} /></div><div className="mt-4 flex items-center justify-between text-[10px]"><span className={`rounded-full px-2 py-1 ${script.status === 'approved' ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-300'}`}>{script.status === 'approved' ? 'Aprovado' : script.status === 'draft' ? 'Rascunho' : 'Em revisão'}</span><span>{script.clip_count} blocos · {script.duration_label}</span></div></button>)}</div>
      </aside>
    </section>
  );
}
