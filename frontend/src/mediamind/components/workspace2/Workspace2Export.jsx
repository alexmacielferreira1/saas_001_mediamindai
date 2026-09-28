import { useMemo, useState } from 'react';
import { Archive, CheckCircle2, Clock3, Download, FileCode2, FileText, Save, Send, Video } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { exportTimeline } from '../../../api/media';
import { gerarXmlPremiere } from '../../lib/premiereXml';

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
  const exportName = slug(project?.title || timeline?.name);
  const summary = useMemo(() => ({
    tracks: timeline?.tracks?.length || 0,
    clips: timeline?.tracks?.reduce((total, track) => total + (track.clips?.length || 0), 0) || 0,
    duration: Number(timeline?.duration || 0).toFixed(2),
  }), [timeline]);

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
    const next = [job, ...queue]; setQueue(next); localStorage.setItem('mm_export_queue_v1', JSON.stringify(next));
    onNotice(approval ? 'Versão adicionada à fila de aprovação.' : 'Sequência adicionada à fila de exportação.');
  };
  const renderNow = async () => {
    onNotice('Renderizando sequência agora…');
    try {
      const result = await exportTimeline({ name: timeline?.name || project?.title, tracks: timeline?.tracks || [] });
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
    <div className="grid gap-3 lg:grid-cols-3">{groups.map(({ title, icon: Icon, actions }) => <article key={title} className="w2-panel p-4"><h3 className="mb-3 flex items-center gap-2 font-bold"><Icon size={16} className="text-sky-400" /> {title}</h3><div className="space-y-2">{actions.map(([label, action]) => <button key={label} type="button" onClick={action} className="w2-button w-full justify-start"><Download size={13} /> {label}</button>)}</div></article>)}</div>
    <article className="w2-panel overflow-hidden"><header className="flex items-center justify-between border-b border-slate-800 p-3"><div><h3 className="font-bold">Fila e versões de aprovação</h3><p className="text-[11px] text-slate-500">{summary.clips} clipes em {summary.tracks} trilhas</p></div><Clock3 size={16} className="text-amber-300" /></header>{queue.length ? <div className="divide-y divide-slate-800">{queue.map((job) => <div key={job.id} className="flex items-center gap-3 p-3 text-xs"><Archive size={14} /><span className="flex-1">{job.name}</span><span>{job.kind === 'approval' ? 'Aprovação' : 'Sequência'}</span><span className="rounded bg-amber-500/15 px-2 py-1 text-amber-300">Na fila</span></div>)}</div> : <p className="p-6 text-center text-xs text-slate-500">Nenhuma exportação na fila.</p>}</article>
    <div className="hidden"><FileText /><Send /><CheckCircle2 /></div>
  </section>;
}
