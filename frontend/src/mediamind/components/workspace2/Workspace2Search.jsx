import { useMemo, useState } from 'react';
import {
  Check, ChevronRight, Download, Film, FolderOpen, Grid2X2, List, MessageSquare, Play, Search,
  Send, ShieldCheck, Sparkles, WandSparkles,
} from 'lucide-react';
import { formatDuration } from '../../data';

const visualClasses = [
  'from-sky-950 via-cyan-800 to-amber-300',
  'from-indigo-950 via-blue-700 to-orange-300',
  'from-slate-950 via-violet-800 to-fuchsia-300',
  'from-emerald-950 via-cyan-800 to-sky-300',
  'from-amber-950 via-orange-700 to-yellow-300',
];

function MediaVisual({ asset, large = false }) {
  return (
    <div className={`relative grid place-items-center overflow-hidden bg-gradient-to-br ${visualClasses[Number(asset.id) % visualClasses.length]} ${large ? 'h-48 rounded-lg' : 'h-24 rounded-t-lg'}`}>
      <span className={large ? 'text-6xl' : 'text-4xl'}>{asset.icon || '🎬'}</span>
      <span className="absolute bottom-2 right-2 rounded bg-slate-950/85 px-1.5 py-0.5 font-mono text-[10px] text-white">{formatDuration(asset.duration || 0)}</span>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <label className="block text-xs text-slate-300">
      <span className="mb-1.5 block">{label}</span>
      <input aria-label={label} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-500" />
    </label>
  );
}

export default function Workspace2Search({
  assets = [], selectedAssets = [], selectedIds = [], previewAsset, onToggle = () => {},
  onPreview = () => {}, onStepChange = () => {}, onClearSelection = () => {},
  showPreview = true,
}) {
  const [filters, setFilters] = useState({ filename: '', transcription: '', person: '', gc: '', local: '', date: '' });
  const [viewMode, setViewMode] = useState('grid');
  const [transcription, setTranscription] = useState('');
  const [rightsStatus, setRightsStatus] = useState('');
  const [quickType, setQuickType] = useState('all');
  const [previewTab, setPreviewTab] = useState('metadata');
  const update = (key) => (value) => setFilters((current) => ({ ...current, [key]: value }));
  const filtered = useMemo(() => assets.filter((asset) => {
    const haystack = `${asset.title || ''} ${asset.filename || ''}`.toLowerCase();
    if (filters.filename && !haystack.includes(filters.filename.toLowerCase())) return false;
    if (filters.transcription && !`${asset.description || ''} ${asset.subjects || ''}`.toLowerCase().includes(filters.transcription.toLowerCase())) return false;
    if (filters.person && !`${asset.people || ''}`.toLowerCase().includes(filters.person.toLowerCase())) return false;
    if (filters.gc && !`${asset.subjects || ''}`.toLowerCase().includes(filters.gc.toLowerCase())) return false;
    if (filters.local && !`${asset.location || ''}`.toLowerCase().includes(filters.local.toLowerCase())) return false;
    if (filters.date && asset.reference_date !== filters.date) return false;
    if (quickType === 'video' && asset.asset_type !== 'video') return false;
    if (quickType === 'audio' && asset.asset_type !== 'audio') return false;
    if (quickType === 'document' && asset.asset_type !== 'document') return false;
    if (quickType === 'image' && asset.asset_type !== 'image') return false;
    return true;
  }), [assets, filters, quickType]);
  const countType = (type) => type === 'all' ? assets.length : assets.filter((asset) => asset.asset_type === type).length;

  return (
    <section data-testid="workspace2-search" className={`grid min-h-[760px] ${showPreview ? 'grid-cols-[260px_minmax(440px,1fr)_430px]' : 'grid-cols-[260px_minmax(440px,1fr)]'} gap-2`}>
      <aside className="w2-panel overflow-hidden">
        <div className="grid grid-cols-2 border-b border-slate-800 p-2 text-xs font-semibold">
          <button type="button" className="flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2"><Search size={14} /> Pesquisa</button>
          <button type="button" className="flex items-center justify-center gap-2 text-slate-400"><Sparkles size={14} /> Prompt IA</button>
        </div>
        <div className="space-y-4 p-3">
          <Field label="Nome do arquivo" value={filters.filename} onChange={update('filename')} placeholder="Digite o nome do arquivo..." />
          <Field label="Fala / Transcrição" value={filters.transcription} onChange={update('transcription')} placeholder="Palavras-chave na fala..." />
          <Field label="Pessoa / Apresentador" value={filters.person} onChange={update('person')} placeholder="Nome da pessoa..." />
          <Field label="GC / Texto na tela" value={filters.gc} onChange={update('gc')} placeholder="Texto exibido no vídeo..." />
          <Field label="Local" value={filters.local} onChange={update('local')} placeholder="Ex.: São Paulo, Centro..." />
          <Field label="Data" type="date" value={filters.date} onChange={update('date')} />
          <button type="button" onClick={() => setFilters({ filename: '', transcription: '', person: '', gc: '', local: '', date: '' })} className="w-full rounded-lg bg-sky-500 py-2 text-xs font-bold text-slate-950">Limpar</button>
          <div className="border-t border-slate-800 pt-4 text-xs text-slate-400">Filtros adicionais</div>
          {['Categoria', 'Formato', 'Status', 'Duração', 'Origem'].map((label) => <select aria-label={label} key={label} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300"><option>{label === 'Duração' ? 'Qualquer duração' : 'Todas'}</option></select>)}
        </div>
      </aside>

      <main className="flex min-w-0 flex-col gap-2">
        <div className="w2-panel flex-1 overflow-hidden">
          <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div><h2 className="text-base font-bold">Mídias encontradas ({filtered.length})</h2><p className="text-xs text-slate-400">Selecione as mídias para usar nas próximas etapas.</p></div>
            <div className="flex items-center gap-1"><button type="button" aria-label="Visualização em grade" onClick={() => setViewMode('grid')} className={`w2-button ${viewMode === 'grid' ? 'border-sky-500 text-sky-300' : ''}`}><Grid2X2 size={14} /></button><button type="button" aria-label="Visualização em lista" onClick={() => setViewMode('list')} className={`w2-button ${viewMode === 'list' ? 'border-sky-500 text-sky-300' : ''}`}><List size={14} /></button><select aria-label="Ordenação" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs"><option>Mais recentes</option></select></div>
          </header>
          <div className="flex flex-wrap gap-1 border-b border-slate-800 px-3 py-2">
            {[['all', 'Todos'], ['video', 'Vídeos'], ['audio', 'Áudios'], ['document', 'Documentos'], ['image', 'Imagens']].map(([id, label]) => <button type="button" key={id} onClick={() => setQuickType(id)} className={`rounded border px-2.5 py-1 text-[10px] ${quickType === id ? 'border-sky-500 bg-sky-500 text-slate-950' : 'border-slate-700 text-slate-400'}`}>{label} ({countType(id)})</button>)}
            {['Período', 'Programa', 'Pessoa', 'Categoria', 'Formato', 'Status'].map((label) => <select key={label} aria-label={`Filtro rápido ${label}`} className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-400"><option>{label}</option></select>)}
          </div>
          <div data-testid="workspace2-media-grid" className={`${viewMode === 'grid' ? 'grid grid-cols-3' : 'flex flex-col'} gap-2 p-3`}>
            {filtered.map((asset) => {
              const selected = selectedIds.includes(asset.id);
              return (
                <article key={asset.id} draggable onDragStart={(event) => event.dataTransfer.setData('application/x-workspace2-asset', String(asset.id))} onClick={() => onPreview(asset)} className={`cursor-grab overflow-hidden rounded-xl border bg-slate-950/80 ${viewMode === 'list' ? 'grid grid-cols-[180px_1fr]' : ''} ${previewAsset?.id === asset.id ? 'border-sky-400 ring-1 ring-sky-500' : 'border-slate-700'}`}>
                  <div className="relative">
                    <MediaVisual asset={asset} />
                    <input aria-label={`Selecionar ${asset.title}`} type="checkbox" checked={selected} onChange={() => onToggle(asset.id)} onClick={(event) => event.stopPropagation()} className="absolute left-2 top-2 h-4 w-4 accent-sky-500" />
                  </div>
                  <div className="p-2.5"><h3 className="truncate text-xs font-bold">{asset.title}</h3><p className="mt-1 text-[10px] text-slate-400">ASSET-00{asset.id} · {asset.reference_date || '—'}</p><div className="mt-2 flex gap-1"><span className="rounded-full bg-slate-800 px-2 py-0.5 text-[9px]">{asset.status || 'Pronto'}</span><span className="rounded-full bg-violet-950 px-2 py-0.5 text-[9px] text-violet-300">IA</span></div></div>
                </article>
              );
            })}
          </div>
        </div>
        <div className="w2-panel p-3">
          <div className="mb-2 flex items-center justify-between"><div><h3 className="text-sm font-bold">Mídias selecionadas para Roteiro e Timeline ({selectedAssets.length})</h3><p className="text-[11px] text-slate-400">Essas mídias estarão disponíveis nas próximas etapas.</p></div><button type="button" onClick={onClearSelection} className="w2-button">Limpar seleção</button></div>
          <div className="flex gap-2 overflow-x-auto">{selectedAssets.map((asset) => <div key={asset.id} className="flex min-w-40 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 p-2"><span className="text-xl">{asset.icon}</span><span className="min-w-0 text-[10px]"><strong className="block truncate">{asset.title}</strong>{formatDuration(asset.duration || 0)}</span></div>)}</div>
        </div>
      </main>

      {showPreview && <aside className="w2-panel flex flex-col overflow-hidden">
        <header className="border-b border-slate-800 px-3 py-2 text-sm font-bold">Preview da mídia</header>
        <div className="space-y-3 p-3">
          {previewAsset && <><MediaVisual asset={previewAsset} large /><div className="flex items-center justify-between"><div><h3 className="font-bold">{previewAsset.title}</h3><p className="text-xs text-slate-400">ASSET-00{previewAsset.id}</p></div><button type="button" className="grid h-9 w-9 place-items-center rounded-full bg-sky-500 text-slate-950"><Play size={17} fill="currentColor" /></button></div></>}
          <div className="rounded-lg border border-slate-800">
            <div className="flex border-b border-slate-800">{[['metadata','Metadados'],['transcription','Transcrição'],['chapters','Capítulos'],['thumbnails','Miniaturas']].map(([id,label]) => <button type="button" key={id} onClick={() => setPreviewTab(id)} className={`px-3 py-2 text-[10px] ${previewTab === id ? 'border-b-2 border-sky-400 text-sky-300' : 'text-slate-500'}`}>{label}</button>)}</div>
            <div className="p-3 text-[10px]">{previewTab === 'metadata' && previewAsset && <dl className="grid grid-cols-[90px_1fr] gap-y-2"><dt className="text-slate-500">Título</dt><dd>{previewAsset.title}</dd><dt className="text-slate-500">Descrição</dt><dd>{previewAsset.description || '—'}</dd><dt className="text-slate-500">Programa</dt><dd>{previewAsset.program_name || '—'}</dd><dt className="text-slate-500">Categoria</dt><dd>{previewAsset.category || '—'}</dd><dt className="text-slate-500">Data</dt><dd>{previewAsset.reference_date || '—'}</dd><dt className="text-slate-500">Duração</dt><dd>{formatDuration(previewAsset.duration || 0)}</dd><dt className="text-slate-500">Formato</dt><dd>{previewAsset.asset_type || '—'}</dd><dt className="text-slate-500">Localização</dt><dd>{previewAsset.location || '—'}</dd><dt className="text-slate-500">Pessoas</dt><dd>{previewAsset.people || '—'}</dd><dt className="text-slate-500">Direitos</dt><dd>Uso interno</dd><dt className="text-slate-500">Status</dt><dd>{previewAsset.status || '—'}</dd><dt className="text-slate-500">Tags</dt><dd className="flex flex-wrap gap-1">{String(previewAsset.subjects || '').split(',').filter(Boolean).map((tag) => <span key={tag} className="rounded bg-slate-800 px-1.5 py-0.5">{tag.trim()}</span>)}</dd></dl>}{previewTab === 'transcription' && <p>{transcription || 'Transcrição ainda não gerada.'}</p>}{previewTab === 'chapters' && <p>Capítulos serão criados a partir da transcrição e dos marcadores.</p>}{previewTab === 'thumbnails' && <p>Miniaturas capturadas e sugeridas pela IA aparecerão aqui.</p>}</div>
          </div>
          <div className="grid grid-cols-2 gap-2"><label className="text-[10px] text-slate-400">IN<input value="00:00:00" readOnly className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs text-white" /></label><label className="text-[10px] text-slate-400">OUT<input value={formatDuration(previewAsset?.duration || 0)} readOnly className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs text-white" /></label></div>
          <button type="button" onClick={() => previewAsset && onToggle(previewAsset.id)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500 py-2 text-xs font-bold text-slate-950"><Check size={14} /> Adicionar à seleção</button>
          <div className="rounded-lg border border-slate-800 p-3"><div className="mb-2 flex items-center gap-2 text-xs font-bold"><MessageSquare size={14} className="text-sky-400" /> Revisão e comentários</div><textarea aria-label="Comentário" placeholder="Adicione um comentário sobre esta mídia..." className="h-16 w-full rounded border border-slate-700 bg-slate-950 p-2 text-xs" /></div>
          <div className="rounded-lg border border-slate-800 p-3"><div className="flex items-center justify-between text-xs font-bold"><span className="flex items-center gap-2"><WandSparkles size={14} className="text-violet-400" /> Transcrição</span><button type="button" onClick={() => setTranscription('Transcrição preparada localmente para revisão.')} className="rounded bg-violet-700 px-2 py-1">Transcrever</button></div><p className="mt-2 text-[11px] text-slate-500">{transcription || 'Nenhuma transcrição disponível.'}</p></div>
          <div className="rounded-lg border border-slate-800 p-3"><div className="mb-2 flex items-center gap-2 text-xs font-bold"><ShieldCheck size={14} className="text-amber-400" /> Direitos e governança</div><div className="grid grid-cols-2 gap-2"><select aria-label="Titular dos direitos" className="rounded border border-slate-700 bg-slate-950 p-2 text-xs"><option>Cedido</option></select><select aria-label="Status de uso" className="rounded border border-slate-700 bg-slate-950 p-2 text-xs"><option>Ativo</option></select></div><button type="button" onClick={() => setRightsStatus('Direitos registrados neste projeto.')} className="mt-2 w-full rounded bg-amber-800 py-2 text-xs font-bold text-amber-100">Registrar direitos</button>{rightsStatus && <p className="mt-2 text-[11px] text-emerald-300">{rightsStatus}</p>}</div>
        </div>
      </aside>}

      <footer className={`${showPreview ? 'col-span-3' : 'col-span-2'} grid grid-cols-6 gap-2`}>
        <button type="button" onClick={() => onStepChange('script')} className="w2-button justify-center"><Film size={14} /> Adicionar ao roteiro</button>
        <button type="button" onClick={() => onStepChange('timeline')} className="w2-button justify-center"><ChevronRight size={14} /> Adicionar à timeline</button>
        <button type="button" className="w2-button justify-center"><Film size={14} /> Gerar corte</button>
        <button type="button" className="w2-button justify-center"><FolderOpen size={14} /> Abrir no Workspace</button>
        <button type="button" className="w2-button justify-center"><Send size={14} /> Usar na produção</button>
        <button type="button" className="w2-button justify-center"><Download size={14} /> Download</button>
      </footer>
    </section>
  );
}
