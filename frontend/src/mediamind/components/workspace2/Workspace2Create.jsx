import { Check, FilePlus2, FileText, FolderOpen, Grid2X2, ListVideo, Mic2, PlaySquare, Radio, Save, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { MOCK_SCRIPTS } from '../../data';
import { filterWorkspaceAssets } from '../../lib/workspace2Model';

const choices = [
  ['continue', 'Continuar trabalho', 'Continue com o roteiro e as mídias já selecionadas.', PlaySquare],
  ['blank', 'Iniciar do zero', 'Crie um roteiro novo e vazio.', FilePlus2],
  ['media', 'A partir de mídia', 'Monte o roteiro usando a seleção atual do acervo.', ListVideo],
  ['template', 'Escolher modelo', 'Use uma estrutura pronta como ponto de partida.', Grid2X2],
  ['open-script', 'Abrir roteiro existente', 'Retome um roteiro já criado.', FolderOpen],
  ['new-draft', 'Criar rascunho', 'Registre as informações sem avançar agora.', FileText],
  ['open-draft', 'Abrir rascunho existente', 'Continue um rascunho salvo anteriormente.', Save],
];
const templates = [[FileText, 'Reportagem'], [Mic2, 'Entrevista'], [Radio, 'Cabeça + off + sonora'], [ListVideo, 'Institucional']];

export default function Workspace2Create({ project = {}, assets = [], selectedAssets = [], selectedIds = [], mediaSearch, showSearch = true, showPreview = true, onMediaSearchChange = () => {}, onProjectChange = () => {}, onToggle = () => {}, onPreview = () => {}, onCreate = () => {}, onOpenScript = () => {}, onSave = () => {} }) {
  const [mode, setMode] = useState(selectedAssets.length ? 'continue' : 'blank');
  const [selectedTemplate, setSelectedTemplate] = useState('Reportagem');
  const mediaQuery = mediaSearch?.filters?.filename || '';
  const visibleAssets = useMemo(() => filterWorkspaceAssets(assets, mediaSearch).slice(0, 12), [assets, mediaSearch]);
  const field = (label, key) => <label className="text-xs text-slate-300">{label}<input aria-label={label} value={project[key] || ''} onChange={(e) => onProjectChange(key, e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-3" /></label>;
  const proceed = () => {
    if (mode === 'open-script') return onOpenScript(MOCK_SCRIPTS[0]);
    if (mode === 'open-draft') return onOpenScript(MOCK_SCRIPTS[0]);
    if (mode === 'new-draft') return onSave();
    if (mode === 'template') return onCreate(selectedTemplate);
    return onCreate(mode === 'continue' ? 'media' : mode);
  };
  return <section className="space-y-3" data-testid="workspace2-create">
    <div className="w2-panel flex items-center justify-center gap-4 p-3" aria-label="Etapas da criação">
      {[['1','Informações iniciais'],['2','Montar roteiro']].map(([number,label], index) => <div key={number} className="flex items-center gap-2"><span className={`grid h-8 w-8 place-items-center rounded-full border font-bold ${index === 0 ? 'border-sky-300 bg-sky-500 text-slate-950' : 'border-slate-600 bg-slate-900'}`}>{number}</span><strong className="text-sm">{label}</strong>{index === 0 && <span className="mx-2 h-px w-16 bg-slate-700"/>}</div>)}
    </div>
    <div className={`w2-create-grid grid gap-3 ${showSearch ? '' : 'w2-create-grid--search-hidden'} ${showPreview ? '' : 'w2-create-grid--preview-hidden'}`}>
      {showSearch && <aside className="w2-panel overflow-hidden" aria-label="Pesquisa e seleção de mídias">
        <div className="border-b border-slate-800 p-3"><div className="mb-2 flex items-center gap-2 text-sm font-bold"><Search size={16} className="text-sky-400"/> Pesquisa de mídias</div><input aria-label="Pesquisa de mídias persistente" value={mediaQuery} onChange={(e) => onMediaSearchChange({ ...mediaSearch, filters: { ...mediaSearch.filters, filename: e.target.value } })} placeholder="Continuar a pesquisa do acervo…" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500"/><p className="mt-2 text-[11px] text-slate-500">A busca e a seleção da etapa anterior foram preservadas.</p></div>
        <div className="max-h-[680px] space-y-2 overflow-y-auto p-3">{visibleAssets.map((asset) => { const selected = selectedIds.includes(asset.id); return <button type="button" key={asset.id} onClick={() => onPreview(asset)} className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left ${selected ? 'border-sky-500 bg-sky-950/30' : 'border-slate-800 bg-slate-950/50'}`}><span className="grid h-12 w-16 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-sky-950 to-indigo-700 text-2xl">{asset.icon || '🎬'}</span><span className="min-w-0 flex-1"><strong className="block truncate text-xs">{asset.title}</strong><span className="text-[10px] text-slate-500">{asset.asset_type || 'mídia'}</span></span><span role="checkbox" aria-checked={selected} aria-label={`Selecionar ${asset.title}`} onClick={(event) => { event.stopPropagation(); onToggle(asset.id); }} className={`grid h-6 w-6 place-items-center rounded-full border ${selected ? 'border-sky-300 bg-sky-500 text-slate-950' : 'border-slate-600'}`}>{selected && <Check size={14}/>}</span></button>; })}{!visibleAssets.length && <p className="py-8 text-center text-xs text-slate-500">Nenhuma mídia encontrada com esta pesquisa.</p>}</div>
        <div className="border-t border-slate-800 p-3 text-xs text-sky-300">{selectedAssets.length} mídia(s) selecionada(s) para continuar</div>
      </aside>}
      <main className="space-y-4">
        <div className="w2-panel p-5"><h2 className="text-xl font-bold">Como você quer criar seu roteiro?</h2><p className="text-sm text-slate-400">Continue o que já começou ou escolha um novo ponto de partida.</p><div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{choices.map(([id,title,description,Icon]) => <button type="button" key={id} onClick={() => setMode(id)} className={`relative min-h-32 rounded-xl border p-4 text-left ${mode === id ? 'border-sky-400 bg-sky-950/40' : 'border-slate-700 hover:border-sky-800'}`}><span className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-sky-950 text-sky-300"><Icon size={21}/></span><span className={`absolute right-4 top-4 h-4 w-4 rounded-full border ${mode===id?'border-sky-300 bg-sky-400 ring-4 ring-sky-950':'border-slate-500'}`}/><strong className="block text-sm">{title}</strong><p className="mt-1 text-xs text-slate-400">{description}</p>{id === 'media' && <span className="mt-2 block text-[10px] text-sky-300">{selectedAssets.length} selecionada(s)</span>}</button>)}</div></div>
        <div className="w2-panel p-5"><h3 className="text-lg font-bold">Informações do roteiro</h3><div className="mt-4 grid gap-3 md:grid-cols-2">{field('Título do roteiro', 'title')}{field('Programa', 'program')}{field('Segmento', 'segment')}{field('Responsável', 'reporter')}</div><label className="mt-3 block text-xs text-slate-300">Observações iniciais<textarea aria-label="Observações iniciais" value={project.notes || ''} onChange={(e) => onProjectChange('notes', e.target.value)} className="mt-1 h-20 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"/></label><div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" onClick={onSave} className="w2-button"><Save size={15}/> Salvar e não continuar</button><button type="button" onClick={proceed} className="rounded-xl bg-sky-500 px-6 py-3 font-bold text-slate-950">{mode === 'new-draft' ? 'Salvar rascunho' : 'Continuar para montar'} →</button></div></div>
      </main>
      {showPreview && <aside className="space-y-3" aria-label="Contexto da criação">
        <div className="w2-panel p-4"><h3 className="font-bold">Mídias selecionadas ({selectedAssets.length})</h3><p className="mt-1 text-[11px] text-slate-500">Seleção mantida desde a pesquisa.</p><div className="mt-3 space-y-2">{selectedAssets.slice(0, 6).map((asset) => <div key={asset.id} className="flex items-center gap-2 rounded-lg border border-slate-800 p-2"><span className="text-xl">{asset.icon || '🎬'}</span><span className="min-w-0 truncate text-xs">{asset.title}</span></div>)}{!selectedAssets.length && <p className="py-5 text-center text-xs text-slate-500">Nenhuma mídia selecionada.</p>}</div></div>
        {mode === 'template' && <div className="w2-panel border-violet-900/70 p-4"><h3 className="mb-3 font-bold">Escolha um modelo</h3><div className="space-y-2">{templates.map(([Icon,title]) => <button type="button" key={title} onClick={() => setSelectedTemplate(title)} className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left text-xs ${selectedTemplate === title ? 'border-violet-400 bg-violet-950/50' : 'border-slate-700'}`}><Icon size={18} className="text-violet-300"/>{title}</button>)}</div></div>}
        {(mode === 'open-script' || mode === 'open-draft') && <div className="w2-panel p-4"><h3 className="mb-3 font-bold">{mode === 'open-draft' ? 'Rascunhos disponíveis' : 'Roteiros existentes'}</h3><div className="space-y-2">{MOCK_SCRIPTS.slice(0, 4).map((script) => <button type="button" key={script.id} onClick={() => onOpenScript(script)} className="flex w-full items-center gap-3 rounded-lg border border-slate-700 p-3 text-left hover:border-sky-500"><FolderOpen size={18} className="shrink-0 text-sky-400"/><span className="min-w-0"><strong className="block truncate text-xs">{script.title}</strong><span className="text-[10px] text-slate-500">{script.clip_count} blocos</span></span></button>)}</div></div>}
      </aside>}
    </div>
  </section>;
}
