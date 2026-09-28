import { useMemo, useState } from 'react';
import { Archive, Captions, CheckCircle2, Clock3, Download, FileCode2, Layers3, Play, Save, Sparkles, Video } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { exportMediaClip, exportTimeline } from '../../../api/media';
import { gerarXmlPremiere } from '../../lib/premiereXml';
import FinalTimelinePlayer from './FinalTimelinePlayer';

const slug = (value) => String(value || 'projeto-mediamind').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

function downloadContent(filename, content, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function timelinePayload(project, timeline) {
  return {
    format: 'MediaMindProject',
    version: 1,
    exportedAt: new Date().toISOString(),
    project,
    timeline,
  };
}

function timelineRenderPayload(project, timeline) {
  return {
    name: timeline?.name || project?.title,
    tracks: timeline?.tracks || [],
    in_point: timeline?.inPoint ?? null,
    out_point: timeline?.outPoint ?? null,
  };
}

function toMaterials(timeline) {
  return (timeline?.tracks || []).flatMap((track) => track.clips || []).filter((clip) => clip.assetId).map((clip) => ({ nome: clip.filename || clip.name }));
}

function buildEdl(timeline) {
  const fps = Number(timeline?.fps) || 30;
  const tc = (seconds) => {
    const frames = Math.max(0, Math.round(Number(seconds || 0) * fps));
    const ff = frames % fps;
    const totalSeconds = Math.floor(frames / fps);
    const ss = totalSeconds % 60;
    const mm = Math.floor(totalSeconds / 60) % 60;
    const hh = Math.floor(totalSeconds / 3600);
    return [hh, mm, ss, ff].map((part) => String(part).padStart(2, '0')).join(':');
  };
  const clips = (timeline?.tracks || []).flatMap((track) => (track.clips || []).map((clip) => ({ ...clip, track })));
  return [`TITLE: ${timeline?.name || 'MediaMind'}`, 'FCM: NON-DROP FRAME', '', ...clips.flatMap((clip, index) => [
    `${String(index + 1).padStart(3, '0')}  ${String(clip.assetId || clip.id).slice(0, 8).toUpperCase()} V     C        ${tc(clip.sourceIn)} ${tc(clip.sourceOut)} ${tc(clip.start)} ${tc(clip.start + clip.duration)}`,
    `* FROM CLIP NAME: ${clip.name}`,
  ])].join('\n');
}

export default function Workspace2Export({ project, timeline, onSave, onNotice }) {
  const [queue, setQueue] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mm_export_queue_v1')) || []; } catch { return []; }
  });
  const [batchConfig, setBatchConfig] = useState({ captions: true, removeSilence: true, animatedText: false, format: '9:16', destination: 'approval' });
  const [runningJob, setRunningJob] = useState(null);
  const exportName = slug(project?.title || timeline?.name);
  const summary = useMemo(() => ({
    tracks: timeline?.tracks?.length || 0,
    clips: timeline?.tracks?.reduce((total, track) => total + (track.clips?.length || 0), 0) || 0,
    duration: Number(timeline?.duration || 0).toFixed(2),
  }), [timeline]);
  const batchAssets = useMemo(() => {
    const clips = (timeline?.tracks || []).flatMap((track) => track.clips || []).filter((clip) => clip.kind === 'video' && clip.assetId);
    return clips.filter((clip, index) => clips.findIndex((candidate) => candidate.assetId === clip.assetId) === index);
  }, [timeline]);
  const persistQueue = (next) => { setQueue(next); localStorage.setItem('mm_export_queue_v1', JSON.stringify(next)); };

  const exportProject = () => {
    downloadContent(`${exportName}.mediamind.json`, JSON.stringify(timelinePayload(project, timeline), null, 2), 'application/json');
    onNotice('Arquivo de projeto MediaMind exportado.');
  };
  const exportXml = () => {
    downloadContent(`${exportName}.xml`, gerarXmlPremiere({ titulo: project?.title, materiais: toMaterials(timeline) }), 'application/xml');
    onNotice('XML compatível com Premiere e DaVinci exportado.');
  };
  const exportEdl = () => { downloadContent(`${exportName}.edl`, buildEdl(timeline)); onNotice('EDL exportada.'); };
  const exportOtio = () => {
    const children = (timeline?.tracks || []).map((track) => ({ OTIO_SCHEMA: 'Track.1', name: track.name, kind: track.kind === 'audio' ? 'Audio' : 'Video', children: (track.clips || []).map((clip) => ({ OTIO_SCHEMA: 'Clip.2', name: clip.name, metadata: { assetId: clip.assetId, start: clip.start, duration: clip.duration, sourceIn: clip.sourceIn } })) }));
    downloadContent(`${exportName}.otio`, JSON.stringify({ OTIO_SCHEMA: 'Timeline.1', name: timeline?.name, tracks: { OTIO_SCHEMA: 'Stack.1', children } }, null, 2), 'application/json');
    onNotice('Projeto OpenTimelineIO exportado.');
  };
  const exportPdf = () => {
    const pdf = new jsPDF();
    pdf.setFontSize(18); pdf.text(project?.title || timeline?.name || 'Projeto MediaMind', 16, 20);
    pdf.setFontSize(11); pdf.text(`Trilhas: ${summary.tracks}  |  Clipes: ${summary.clips}  |  Duração: ${summary.duration}s`, 16, 30);
    let y = 42;
    (timeline?.markers || []).forEach((marker) => { pdf.text(`${Number(marker.time).toFixed(3)}s — ${marker.label}`, 16, y); y += 7; });
    pdf.save(`${exportName}-marcacoes.pdf`);
    onNotice('PDF com resumo e marcações exportado.');
  };
  const queueRender = (approval = false) => {
    const job = { id: crypto.randomUUID(), name: project?.title || timeline?.name, kind: approval ? 'approval' : 'sequence', status: 'waiting', createdAt: new Date().toISOString() };
    const next = [job, ...queue]; persistQueue(next);
    onNotice(approval ? 'Versão adicionada à fila de aprovação.' : 'Sequência adicionada à fila de exportação.');
  };
  const queueBatch = () => {
    if (!batchAssets.length) { onNotice('Adicione vídeos à Timeline antes de criar um lote.'); return; }
    const createdAt = new Date().toISOString();
    const jobs = batchAssets.map((clip) => ({ id: crypto.randomUUID(), name: clip.name, kind: 'batch-clip', status: 'waiting', createdAt, clip, config: batchConfig }));
    persistQueue([...jobs, ...queue]);
    onNotice(`${jobs.length} arquivo(s) adicionados à fila de edição em lote.`);
  };
  const runJob = async (job) => {
    setRunningJob(job.id);
    persistQueue(queue.map((item) => item.id === job.id ? { ...item, status: 'processing' } : item));
    try {
      const result = job.kind === 'batch-clip'
        ? await exportMediaClip({ asset_id: job.clip.assetId, source_in: job.clip.sourceIn, duration: job.clip.duration, properties: job.clip.properties })
        : await exportTimeline(timelineRenderPayload(project, timeline));
      const url = URL.createObjectURL(result.blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = result.filename; anchor.click(); URL.revokeObjectURL(url);
      const next = queue.map((item) => item.id === job.id ? { ...item, status: 'completed', completedAt: new Date().toISOString(), filename: result.filename } : item);
      persistQueue(next); onNotice(`Processamento concluído: ${result.filename}`);
    } catch (error) {
      persistQueue(queue.map((item) => item.id === job.id ? { ...item, status: 'failed', error: error?.message } : item));
      onNotice(error?.message || 'O item da fila falhou e pode ser tentado novamente.');
    } finally { setRunningJob(null); }
  };
  const renderNow = async () => {
    onNotice('Renderizando sequência agora…');
    try {
      const result = await exportTimeline(timelineRenderPayload(project, timeline));
      const url = URL.createObjectURL(result.blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = result.filename; anchor.click(); URL.revokeObjectURL(url);
      onNotice(`Render concluído: ${result.filename}`);
    } catch (error) { onNotice(error?.message || 'Não foi possível renderizar a sequência.'); }
  };

  const groups = [
    { title: 'Projeto', icon: Save, actions: [
      ['Salvar projeto no MediaMind', () => { onSave(); onNotice('Projeto e Timeline salvos no MediaMind.'); }],
      ['Exportar projeto MediaMind', exportProject],
    ] },
    { title: 'Edição externa', icon: FileCode2, actions: [
      ['Exportar XML Premiere / DaVinci', exportXml], ['Exportar EDL', exportEdl], ['Exportar OpenTimelineIO', exportOtio], ['Exportar PDF com marcações', exportPdf],
    ] },
    { title: 'Render e entrega', icon: Video, actions: [
      ['Renderizar sequência agora', renderNow], ['Enviar sequência para fila', () => queueRender(false)], ['Gerar versão para aprovação', () => queueRender(true)],
    ] },
  ];

  return <section className="space-y-4" data-testid="workspace2-export">
    <div><h2 className="text-xl font-bold">Central de exportação</h2><p className="text-xs text-slate-400">Salve o projeto, intercambie com editores externos, renderize agora ou organize entregas na fila.</p></div>
    <FinalTimelinePlayer timeline={timeline} />
    <div className="grid gap-3 lg:grid-cols-3">{groups.map(({ title, icon: Icon, actions }) => <article key={title} className="w2-panel p-4"><h3 className="mb-3 flex items-center gap-2 font-bold"><Icon size={16} className="text-sky-400" /> {title}</h3><div className="space-y-2">{actions.map(([label, action]) => <button key={label} type="button" onClick={action} className="w2-button w-full justify-start"><Download size={13} /> {label}</button>)}</div></article>)}</div>
    <article className="w2-panel overflow-hidden"><header className="flex items-center justify-between border-b border-slate-800 p-3"><div><h3 className="flex items-center gap-2 font-bold"><Sparkles size={15} className="text-violet-300" /> Edição em lote</h3><p className="text-[11px] text-slate-500">Aplique a mesma preparação a {batchAssets.length} mídia(s) do projeto e processe cada arquivo pela fila.</p></div><Layers3 size={16} className="text-sky-300" /></header><div className="grid gap-4 p-4 lg:grid-cols-[1fr_1fr_auto]"><div><p className="mb-2 text-[10px] font-bold uppercase text-slate-500">Automação</p>{[['captions', 'Gerar legendas'], ['removeSilence', 'Remover pausas excessivas'], ['animatedText', 'Adicionar textos animados']].map(([field, label]) => <label key={field} className="mb-2 flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={batchConfig[field]} onChange={(event) => setBatchConfig((current) => ({ ...current, [field]: event.target.checked }))} /> {field === 'captions' && <Captions size={13} />} {label}</label>)}</div><div className="grid grid-cols-2 gap-2"><label className="text-[10px] uppercase text-slate-500">Formato<select aria-label="Formato do lote" value={batchConfig.format} onChange={(event) => setBatchConfig((current) => ({ ...current, format: event.target.value }))} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200"><option>9:16</option><option>16:9</option><option>1:1</option><option>4:5</option></select></label><label className="text-[10px] uppercase text-slate-500">Destino<select aria-label="Destino do lote" value={batchConfig.destination} onChange={(event) => setBatchConfig((current) => ({ ...current, destination: event.target.value }))} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200"><option value="approval">Aprovação</option><option value="download">Download</option><option value="publication">Publicação</option></select></label></div><button type="button" onClick={queueBatch} className="w2-button self-center border-violet-600 text-violet-200"><Sparkles size={13} /> Criar lote ({batchAssets.length})</button></div></article>
    <article className="w2-panel overflow-hidden"><header className="flex items-center justify-between border-b border-slate-800 p-3"><div><h3 className="font-bold">Fila de processamento e aprovação</h3><p className="text-[11px] text-slate-500">{summary.clips} clipes em {summary.tracks} trilhas · fila persistida neste ambiente</p></div><Clock3 size={16} className="text-amber-300" /></header>{queue.length ? <div className="divide-y divide-slate-800">{queue.map((job) => { const label = job.kind === 'approval' ? 'Aprovação' : job.kind === 'batch-clip' ? `Lote · ${job.config?.format || 'original'}` : 'Sequência'; return <div key={job.id} className="flex flex-wrap items-center gap-3 p-3 text-xs"><Archive size={14} /><span className="min-w-48 flex-1"><strong className="block">{job.name}</strong>{job.error && <small className="text-rose-300">{job.error}</small>}</span><span>{label}</span><span className={`rounded px-2 py-1 ${job.status === 'completed' ? 'bg-emerald-500/15 text-emerald-300' : job.status === 'failed' ? 'bg-rose-500/15 text-rose-300' : job.status === 'processing' ? 'bg-sky-500/15 text-sky-300' : 'bg-amber-500/15 text-amber-300'}`}>{job.status === 'completed' ? 'Concluído' : job.status === 'failed' ? 'Falhou' : job.status === 'processing' ? 'Processando' : 'Na fila'}</span>{job.status !== 'completed' && <button type="button" disabled={Boolean(runningJob)} onClick={() => runJob(job)} className="w2-button disabled:opacity-40"><Play size={12} /> {job.status === 'failed' ? 'Tentar novamente' : 'Processar agora'}</button>}{job.status === 'completed' && <CheckCircle2 size={16} className="text-emerald-300" />}</div>; })}</div> : <p className="p-6 text-center text-xs text-slate-500">Nenhuma exportação na fila.</p>}</article>
  </section>;
}
