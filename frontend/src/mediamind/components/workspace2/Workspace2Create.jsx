import { CalendarClock, FilePlus2, FileText, FolderOpen, Grid2X2, Save } from 'lucide-react';
import { useMemo, useState } from 'react';
import { MOCK_SCRIPTS } from '../../data';

const TYPES = [
  ['script', 'Roteiro', FileText, 'Crie um novo ou retome um roteiro existente.'],
  ['template', 'Modelo', Grid2X2, 'Comece com uma estrutura pronta ou crie uma nova.'],
  ['draft', 'Rascunho', Save, 'Registre uma ideia ou continue um rascunho salvo.'],
];
const TEMPLATES = [
  ['Reportagem', 'Cabeça, offs, sonoras e encerramento.'],
  ['Entrevista', 'Perguntas, respostas e observações.'],
  ['Cabeça + off + sonora', 'Estrutura curta para jornalismo diário.'],
  ['Roteiro de agendamento', 'Informações do que será gravado, data, equipe e orientações para registrar depois.'],
];

export default function Workspace2Create({ project = {}, onProjectChange = () => {}, onCreate = () => {}, onOpenScript = () => {}, onSave = () => {} }) {
  const [type, setType] = useState('script');
  const [variant, setVariant] = useState('new');
  const [selectedTemplate, setSelectedTemplate] = useState('Reportagem');
  const [selectedScriptId, setSelectedScriptId] = useState(MOCK_SCRIPTS[0]?.id);
  const existing = useMemo(() => type === 'draft' ? MOCK_SCRIPTS.filter((item) => item.status === 'draft') : MOCK_SCRIPTS, [type]);
  const optionLabels = type === 'script' ? ['Novo roteiro', 'Roteiros existentes'] : type === 'template' ? ['Novo modelo', 'Modelos existentes'] : ['Novo rascunho', 'Rascunhos existentes'];
  const field = (label, key, placeholder = '') => <label className="text-xs text-slate-300">{label}<input aria-label={label} value={project[key] || ''} placeholder={placeholder} onChange={(event) => onProjectChange(key, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs outline-none focus:border-sky-500" /></label>;
  const proceed = () => {
    if (variant === 'existing') {
      const selected = existing.find((item) => item.id === selectedScriptId) || existing[0];
      if (type === 'template') return onCreate(selectedTemplate);
      if (selected) onOpenScript(selected);
      return;
    }
    if (type === 'draft') return onSave();
    onCreate(type === 'template' ? selectedTemplate : 'blank');
  };
  const actionLabel = variant === 'existing' ? `Continuar ${type === 'draft' ? 'rascunho' : type === 'template' ? 'modelo' : 'roteiro'}` : type === 'draft' ? 'Salvar rascunho' : type === 'template' ? 'Criar com modelo' : 'Criar roteiro';

  return <section data-testid="workspace2-create" className="grid min-h-[650px] grid-cols-[190px_minmax(250px,0.8fr)_minmax(420px,1.35fr)] gap-2">
    <nav role="region" aria-label="Tipos de criação" className="w2-panel p-3"><h2 className="text-sm font-bold">Como criar?</h2><p className="mt-1 text-[10px] leading-4 text-slate-400">Escolha o tipo de trabalho.</p><div className="mt-3 space-y-2">{TYPES.map(([id, label, Icon, description]) => <button type="button" key={id} aria-label={label} onClick={() => { setType(id); setVariant('new'); }} className={`w-full rounded-xl border p-2.5 text-left ${type === id ? 'border-sky-400 bg-sky-950/50' : 'border-slate-700 hover:border-sky-700'}`}><span className="flex items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sky-950 text-sky-300"><Icon size={16}/></span><strong className="text-xs">{label}</strong></span><small className="mt-2 block text-[9px] leading-4 text-slate-500">{description}</small></button>)}</div></nav>

    <aside role="complementary" aria-label={`Opções de ${TYPES.find(([id]) => id === type)?.[1]}`} className="w2-panel p-3"><h2 className="text-sm font-bold">{TYPES.find(([id]) => id === type)?.[1]}</h2><div className="mt-3 grid grid-cols-2 gap-2">{optionLabels.map((label, index) => <button type="button" key={label} onClick={() => setVariant(index === 0 ? 'new' : 'existing')} className={`rounded-lg border p-3 text-left text-xs font-bold ${variant === (index === 0 ? 'new' : 'existing') ? 'border-sky-400 bg-sky-950/50 text-sky-200' : 'border-slate-700 text-slate-300'}`}>{index === 0 ? <FilePlus2 size={16} className="mb-2"/> : <FolderOpen size={16} className="mb-2"/>}{label}</button>)}</div>
      {variant === 'new' && type === 'script' && <div className="mt-4 rounded-xl border border-slate-800 p-3"><h3 className="text-xs font-bold">Novo roteiro em branco</h3><p className="mt-1 text-[10px] leading-4 text-slate-400">O material escolhido na Pesquisa estará disponível na próxima tela.</p></div>}
      {variant === 'new' && type === 'draft' && <div className="mt-4 rounded-xl border border-slate-800 p-3"><h3 className="text-xs font-bold">Novo rascunho</h3><p className="mt-1 text-[10px] leading-4 text-slate-400">Salve as informações sem avançar para a montagem.</p></div>}
      {variant === 'new' && type === 'template' && <div className="mt-4 space-y-2">{TEMPLATES.map(([name, description]) => <button type="button" key={name} aria-label={name} onClick={() => setSelectedTemplate(name)} className={`w-full rounded-xl border p-3 text-left ${selectedTemplate === name ? 'border-sky-400 bg-sky-950/50' : 'border-slate-700'}`}><span className="flex items-center gap-2 text-xs font-bold">{name === 'Roteiro de agendamento' ? <CalendarClock size={16}/> : <FileText size={16}/>} {name}</span><small className="mt-1 block text-[10px] leading-4 text-slate-400">{description}</small></button>)}</div>}
      {variant === 'existing' && <div className="mt-4 space-y-2">{(type === 'template' ? TEMPLATES.map(([name, description], index) => ({ id: `template-${index}`, title: name, description })) : existing).map((item) => <button type="button" key={item.id} onClick={() => { setSelectedScriptId(item.id); if (type === 'template') setSelectedTemplate(item.title); }} className={`w-full rounded-xl border p-3 text-left ${selectedScriptId === item.id || selectedTemplate === item.title ? 'border-sky-400 bg-sky-950/50' : 'border-slate-700'}`}><strong className="block text-xs">{item.title}</strong><small className="text-[10px] text-slate-500">{item.description || item.program_name || item.status || 'Disponível'}</small></button>)}</div>}
    </aside>

    <main role="region" aria-label="Informações do roteiro" className="w2-panel flex min-w-0 flex-col p-4"><div><h2 className="text-lg font-bold">Informações do roteiro</h2><p className="mt-1 text-xs text-slate-400">Preencha os dados que acompanharão o trabalho.</p></div><div className="mt-4 grid grid-cols-2 gap-3">{field('Título do roteiro', 'title', 'Ex.: Especial mobilidade urbana')}{field('Programa', 'program', 'Ex.: Jornal da Cidade')}{field('Segmento', 'segment', 'Ex.: Reportagem')}{field('Responsável', 'owner', 'Nome do responsável')}</div><label className="mt-3 text-xs text-slate-300">Observações iniciais<textarea aria-label="Observações iniciais" value={project.notes || ''} onChange={(event) => onProjectChange('notes', event.target.value)} className="mt-1 h-28 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs outline-none focus:border-sky-500" /></label>{type === 'template' && selectedTemplate === 'Roteiro de agendamento' && <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-sky-900 bg-sky-950/20 p-3">{field('Data prevista', 'scheduledDate')}{field('Equipe de gravação', 'crew')}{field('Local da gravação', 'location')}{field('Contato', 'contact')}</div>}<div className="mt-auto flex justify-end gap-2 border-t border-slate-800 pt-4"><button type="button" onClick={onSave} className="w2-button"><Save size={14}/> Salvar e não continuar</button><button type="button" onClick={proceed} className="flex items-center gap-2 rounded-lg bg-sky-500 px-5 py-2.5 text-xs font-bold text-slate-950">{actionLabel}</button></div></main>
  </section>;
}
