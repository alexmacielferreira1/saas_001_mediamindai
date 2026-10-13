import { useRef, useState } from 'react';
import MediaPlayer from '../../MediaPlayer';
import Timeline2 from '../../../pages/Timeline2';
import { useWorkDraftState, useWorkScope } from '../../../lib/workProtection';
import { GraphicDraftProvider } from '../../../lib/graphicDrafts';

const fieldClass = 'w-full rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200';
const buttonClass = 'rounded border border-sky-800 px-3 py-2 text-xs text-sky-300 hover:bg-sky-950';
const sections = ['Mídias', 'Documentos', 'Referências', 'Observações'];

export default function EditingProjectPanels({ project, lane, onChange }) {
  const scope = useWorkScope();
  const [tab, setTab] = useState('Mídias');
  const [versions, setVersions] = useWorkDraftState(`editing:${project.id}:versions`, []);
  const [versionId, setVersionId] = useWorkDraftState(`editing:${project.id}:versionId`, null);
  const [comments, setComments] = useWorkDraftState(`editing:${project.id}:comments`, []);
  const [checks, setChecks] = useWorkDraftState(`editing:${project.id}:checks`, {});
  const [comment, setComment] = useWorkDraftState(`editing:${project.id}:comment`, '');
  const [time, setTime] = useState(0);
  const [sourceId, setSourceId] = useState(null);
  const upload = useRef(null);
  const materials = project.materiais || [];
  const source = item => item.url || item.stream_url || item.src;
  const videos = materials.filter(item => source(item) && /video|\.(mp4|mov|webm)$/i.test(`${item.tipo || item.asset_type || ''} ${item.nome || item.filename || ''}`));
  const version = versions.find(item => item.id === versionId);
  const media = videos.find(item => String(item.id || source(item)) === sourceId) || videos[0];
  const src = version?.url || (media && source(media));
  const addComment = () => {
    if (!comment.trim()) return;
    setComments(items => [...items, { id: crypto.randomUUID(), time, text: comment.trim(), status: 'Pendente', versionId: versionId || 'source' }]);
    setComment('');
  };
  const markers = comments.filter(item => item.versionId === (versionId || 'source'));
  const assets = materials.filter(source).map((item, index) => ({ ...item, id: item.id || `${project.id}-${index}`, title: item.nome || item.filename, filename: item.nome || item.filename, stream_url: source(item), asset_type: /audio|\.(wav|mp3|aac|m4a)$/i.test(`${item.tipo || ''} ${item.nome || ''}`) ? 'audio' : /image|\.(png|jpe?g|webp)$/i.test(`${item.tipo || ''} ${item.nome || ''}`) ? 'image' : 'video' }));
  return <div className="space-y-3">
    <div className={`grid gap-3 ${lane === 'aguardando' ? 'xl:grid-cols-2' : 'xl:grid-cols-[1.4fr_1fr_.85fr]'}`}>
      <div><MediaPlayer key={src || project.id} src={src} markers={markers} onTimeChange={setTime} title={version ? `Preview da edição · ${version.name}` : 'Preview da gravação'}/>
        {videos.length > 1 && <select aria-label="Vídeo da prévia" className={fieldClass} value={sourceId || String(media?.id || source(media))} onChange={event => { setSourceId(event.target.value); setVersionId(null); }}>{videos.map(item => <option key={item.id || source(item)} value={String(item.id || source(item))}>{item.nome || item.filename}</option>)}</select>}
      </div>
      {lane !== 'aguardando' && <section className="rounded-lg border border-slate-800 p-3"><h3 className="mb-3 text-xs font-bold text-sky-300">INFORMAÇÕES DA PRODUÇÃO</h3>{[['Programa','programa'],['Episódio','episodio'],['Título','titulo'],['Responsável pela edição','editor'],['Prazo de entrega','prazo_edicao']].map(([label,key]) => <label key={key} className="mb-2 block text-[10px] text-slate-400">{label}<input aria-label={label} value={project[key] || ''} onChange={event => onChange(key,event.target.value)} className={fieldClass}/></label>)}</section>}
      {lane !== 'aguardando' ? <section className="rounded-lg border border-slate-800 p-3"><h3 className="mb-3 text-xs font-bold text-sky-300">{lane === 'para_editar' ? 'CHECKLIST DE MATERIAIS' : 'CHECKLIST DE EDIÇÃO'}</h3>{(lane === 'para_editar' ? ['Roteiro da pauta','Mídias de gravação','Imagens de apoio','GC, logo e vinhetas','Referências visuais','Trilha sonora'] : ['Montagem inicial','Cortes e ajustes','Tratamento de áudio','Legendas e GC','Conferência técnica','Exportação final']).map(label => <label key={label} className="flex items-center gap-2 border-b border-slate-800 py-3 text-xs text-slate-300"><input type="checkbox" checked={Boolean(checks[label])} onChange={event => setChecks(items => ({...items,[label]:event.target.checked}))}/>{label}</label>)}</section> : <section className="rounded-lg border border-slate-800 p-3"><h3 className="mb-3 text-xs font-bold text-sky-300">APONTAMENTOS DA REVISÃO</h3>{markers.length === 0 && <p className="text-xs text-slate-500">Nenhum apontamento nesta versão. Marque o tempo no player e registre abaixo.</p>}{markers.map(item => <div key={item.id} className="mb-2 border-b border-slate-800 pb-2"><p className="text-xs text-slate-300">{item.text}</p><p className="text-[10px] text-sky-400">{item.time.toFixed(2)} s · marcador disponível no player</p><select aria-label={`Status de ${item.text}`} value={item.status} onChange={event => setComments(items => items.map(entry => entry.id === item.id ? {...entry,status:event.target.value} : entry))} className={fieldClass}>{['Pendente','Em andamento','Resolvido'].map(status => <option key={status}>{status}</option>)}</select></div>)}</section>}
    </div>
    <section className="overflow-hidden rounded-lg border border-slate-800">
      <nav className="flex flex-wrap border-b border-slate-800">{sections.map(label => <button type="button" key={label} onClick={() => setTab(label)} aria-pressed={tab === label} className={`px-4 py-3 text-xs ${tab === label ? 'bg-sky-950 text-sky-300' : 'text-slate-400'}`}>{label}</button>)}</nav>
      {tab === 'Timeline' ? <div className="min-h-[640px]"><GraphicDraftProvider scope={`${scope || 'local'}:editing-timeline:${project.id}`}><Timeline2 embedded editingProjectId={project.id} projectAssets={assets}/></GraphicDraftProvider></div> : <div className="p-3">
        {tab === 'Observações' ? <textarea aria-label="Observações da edição" value={project.edicao_obs || ''} onChange={event => onChange('edicao_obs',event.target.value)} rows={3} className={fieldClass}/> : <div className="grid gap-2 md:grid-cols-3">{materials.filter(item => tab === 'Documentos' ? /document|\.(pdf|docx?|txt)$/i.test(`${item.tipo || ''} ${item.nome || ''}`) : tab === 'Referências' ? /referencia|reference/i.test(item.tipo || '') : true).map((item,index) => <article key={item.id || index} className="rounded border border-slate-800 p-3 text-xs text-slate-300"><p>{item.nome || item.filename || 'Arquivo'}</p>{source(item) ? <a href={source(item)} download className="text-sky-400">Abrir / baixar arquivo</a> : <span className="text-amber-300">Arquivo não vinculado</span>}</article>)}{materials.length === 0 && <p className="text-xs text-slate-500">Nenhuma mídia vinculada.</p>}</div>}
      </div>}
    </section>
    <div className="grid gap-3 xl:grid-cols-2">
      <section className="rounded-lg border border-slate-800 p-3"><div className="flex justify-between"><h3 className="text-xs font-bold text-sky-300">VERSÕES DA EDIÇÃO</h3><button type="button" className={buttonClass} onClick={() => upload.current?.click()}>Enviar nova versão</button></div><p className="my-2 text-[10px] text-slate-500">Versões locais protegidas pelo rascunho. A publicação da entrega é separada.</p><input ref={upload} aria-label="Arquivo da nova versão" type="file" accept="video/*" className="hidden" onChange={event => { const file=event.target.files?.[0]; if(!file)return; const next={id:crypto.randomUUID(),name:`V${versions.length+1}`,filename:file.name,url:URL.createObjectURL(file),date:new Date().toISOString()};setVersions(items=>[next,...items]);setVersionId(next.id);event.target.value=''; }}/>{versions.length === 0 && <p className="py-3 text-xs text-slate-500">Nenhuma versão enviada.</p>}{versions.map(item => <button type="button" key={item.id} onClick={() => setVersionId(item.id)} aria-pressed={versionId===item.id} className="mt-2 flex w-full justify-between rounded border border-slate-700 p-2 text-xs text-slate-300"><span>{item.name} · {item.filename}</span><span>{new Date(item.date).toLocaleString('pt-BR')}</span></button>)}{versionId && <button type="button" className={buttonClass} onClick={() => setVersionId(null)}>Ver gravação original</button>}</section>
      <section className="rounded-lg border border-slate-800 p-3"><h3 className="mb-3 text-xs font-bold text-sky-300">OBSERVAÇÕES E MARCADORES</h3><textarea aria-label="Novo apontamento" value={comment} onChange={event => setComment(event.target.value)} className={fieldClass} placeholder="Registre uma correção no tempo atual do player…"/><button type="button" disabled={!comment.trim()} onClick={addComment} className={`${buttonClass} mt-2 disabled:opacity-30`}>Adicionar marcador em {time.toFixed(2)} s</button><p className="mt-2 text-xs text-slate-500">{markers.length} apontamento(s) nesta versão · {markers.filter(item=>item.status==='Resolvido').length} resolvido(s)</p></section>
    </div>
  </div>;
}
