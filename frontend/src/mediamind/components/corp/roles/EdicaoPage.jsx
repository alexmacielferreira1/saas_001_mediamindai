import React, { useState } from 'react';
import EditingProjectPanels from './EditingProjectPanels';
import FilmCraftWorkspace from '../../graphic-tools/FilmCraftWorkspace';
import { GraphicDraftProvider } from '../../../lib/graphicDrafts';
import { useWorkScope } from '../../../lib/workProtection';
import { Scissors, Plus, User, Calendar, FileText, Send, Download, FileCode2, Copy, RotateCcw, Clock3, CircleAlert, CircleCheck, Layers3, MessageCircle, FolderOpen, Video, AudioLines, Image, Link2, ChevronLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useProducaoProjetos, addProjeto, updateProjeto, transicionar } from '../../../lib/producaoStore';
import { baixarXmlPremiere } from '../../../lib/premiereXml';
import { useAuth } from '../../../auth';
import { StageDragArea, DraggableStageCard } from '../StageDragList';
import { EDITING_LANES, editingTransition, laneForEditingProject, laneForEditingStatus } from '../../../lib/edicaoWorkflow';

const EDICAO_STATUS = [
  { value: 'rascunho_corte', label: 'Rascunho de corte' },
  { value: 'corte_fino', label: 'Corte fino' },
  { value: 'revisao_interna', label: 'Revisão interna' },
  { value: 'pronto_para_aprovacao', label: 'Pronto para revisão' },
];
const STATUS_LABEL = { rascunho_corte: 'Rascunho de corte', corte_fino: 'Corte fino', revisao_interna: 'Revisão interna', pronto_para_aprovacao: 'Pronto para revisão' };

const projectLane = project => project?.etapa === "em_aprovacao" ? "em_aprovacao" : laneForEditingProject(project);

function inputCls() {
  return 'w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500';
}

// Em edição: lista (arrastável) + detalhamento + acesso às mídias (download,
// copiar nomes, baixar XML Premiere) + ajuste ao videomaker / revisão do produtor.
export default function EdicaoPage({ disableBack = false, initialLane = 'em_edicao' }) {
  const workScope = useWorkScope();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const projetos = useProducaoProjetos();
  const { user } = useAuth();
  const { toast } = useToast();
  const editorName = user?.name || 'Editor';
  const emEdicao = projetos.filter((p) => ['para_editar', 'em_edicao', 'aguardando_aprovacao', 'aguardando', 'em_aprovacao'].includes(p.etapa));
  const initialProject = emEdicao.find((project) => projectLane(project) === initialLane) || emEdicao[0];
  const [selId, setSelId] = useState(initialProject?.id ?? null);
  const [ajusteOpen, setAjusteOpen] = useState(false);
  const [ajusteObs, setAjusteObs] = useState('');
  const [queueFilter, setQueueFilter] = useState([...EDITING_LANES, "em_aprovacao"].includes(initialLane) ? initialLane : 'em_edicao');
  const [sortOrder, setSortOrder] = useState('deadline');
  const laneProjects = emEdicao.filter(project => projectLane(project) === queueFilter);
  const sel = laneProjects.find(project => project.id === selId) || laneProjects[0] || null;

  function nova() {
    const id = addProjeto({ etapa: 'para_editar', programa: '', titulo: 'Nova edição', apresentadores: [], editor: editorName, responsavel: editorName });
    setSelId(id);
    setQueueFilter('para_editar');
  }
  function field(name, value) { if (sel) updateProjeto(sel.id, { [name]: value }); }

  function copiarNomes() {
    const nomes = (sel.materiais || []).map((m) => m.nome).join('\n');
    if (!nomes) return;
    navigator.clipboard.writeText(nomes).then(() => toast({ title: 'Nomes dos arquivos copiados' }));
  }

  function enviarAjuste() {
    if (!ajusteObs.trim()) return;
    updateProjeto(sel.id, { grav_status: 'problema' });
    const saved = transicionar(sel.id, 'gravacoes', { quem: editorName, obs: `Ajuste solicitado pela edição: ${ajusteObs.trim()}` });
    setAjusteOpen(false);
    setAjusteObs('');
    Promise.resolve(saved).then((ok) => {
      if (ok) toast({ title: 'Ajuste solicitado ao videomaker', description: 'O projeto voltou pra Gravação com a observação.' });
    });
  }

  function enviarParaAprovacao() {
    if (!sel) return;
    Promise.resolve(transicionar(sel.id, 'em_aprovacao', { quem: editorName, obs: 'Versão encaminhada para revisão' })).then((ok) => {
      if (ok) toast({ title: 'Versão enviada para Em revisão', description: 'A entrega já está disponível para conferência.' });
    });
  }

  function moveToLane(projectId, targetLane) {
    const project = emEdicao.find((item) => String(item.id) === String(projectId));
    if (!project) return;
    const transition = editingTransition(project, targetLane);
    if (!transition) {
      toast({ title: 'Movimento fora da ordem', description: 'Mova a entrega apenas para a etapa anterior ou seguinte.' });
      return;
    }
    updateProjeto(project.id, transition);
    setQueueFilter(targetLane);
    setSelId(project.id);
  }

  function changeEditingStatus(status) {
    if (!sel) return;
    const targetLane = laneForEditingStatus(status);
    if (targetLane === laneForEditingStatus(sel.edicao_status)) field('edicao_status', status);
    else moveToLane(sel.id, targetLane);
  }

  const materiais = sel?.materiais || [];
  const queueCounts = Object.fromEntries(EDITING_LANES.map((lane) => [lane, emEdicao.filter((p) => projectLane(p) === lane).length]));
  const filteredQueue = emEdicao.filter((p) => projectLane(p) === queueFilter).sort((a,b) => sortOrder === 'title' ? (a.titulo || '').localeCompare(b.titulo || '') : (Date.parse(a.prazo || a.data_entrega) || Number.MAX_SAFE_INTEGER) - (Date.parse(b.prazo || b.data_entrega) || Number.MAX_SAFE_INTEGER));
  const selectedLane = sel ? projectLane(sel) : null;
  const selectedLaneIndex = selectedLane ? EDITING_LANES.indexOf(selectedLane) : -1;
  const mediaGroups = [
    { label: 'Vídeos', Icon: Video, match: /video|\.(mp4|mov|webm|avi)$/i },
    { label: 'Áudio', Icon: AudioLines, match: /audio|\.(wav|mp3|aac|m4a)$/i },
    { label: 'Imagens', Icon: Image, match: /image|\.(png|jpg|jpeg|webp)$/i },
    { label: 'Documentos', Icon: FileText, match: /document|\.(pdf|docx?|txt)$/i },
    { label: 'Referências', Icon: Link2, match: /referencia|reference/i },
  ].map(group => {
    const items = materiais.filter(media => group.match.test(`${media.tipo || ''} ${media.nome || ''}`));
    return { ...group, count: items.length, files: items.slice(0, 3).map(media => media.nome), fallback: [] };
  });

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-800 bg-mm-page">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-400">Produção / Pós-produção</p>
          <h2 className="mt-0.5 text-base font-semibold text-slate-100">Central de edição</h2>
          <p className="text-[11px] text-slate-500">Acompanhe a fila, edite os metadados e encaminhe cada entrega sem sair desta tela.</p>
        </div>
        <button onClick={nova} className="flex min-h-9 items-center gap-1.5 rounded-md bg-sky-500 px-3 text-[11px] font-bold text-slate-950 hover:bg-sky-400"><Plus size={13} /> Nova edição</button>
      </div>

      <div className="grid border-b border-slate-800 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { id: 'para_editar', label: 'Para editar', value: queueCounts.para_editar, Icon: Scissors, tone: 'text-sky-300' },
          { id: 'em_edicao', label: 'Em edição', value: queueCounts.em_edicao, Icon: Clock3, tone: 'text-sky-300' },
          { id: 'aguardando', label: 'Em alteração', value: queueCounts.aguardando, Icon: CircleAlert, tone: 'text-amber-300' },
          { id: 'em_aprovacao', label: 'Aguardando revisão', value: projetos.filter(project => project.etapa === 'em_aprovacao').length, Icon: CircleCheck, tone: 'text-emerald-300' },
        ].map(({ id, label, value, Icon, tone }) => (
          <button key={label} onClick={() => { setQueueFilter(id); const first = emEdicao.find(project => projectLane(project) === id); setSelId(first?.id ?? null); }} className={`flex items-center gap-3 border-b border-slate-800 px-4 py-3 text-left last:border-b-0 sm:border-r xl:border-b-0 ${queueFilter === id ? 'bg-sky-950/40 ring-1 ring-inset ring-sky-500' : ''}`}>
            <Icon size={15} className={tone} />
            <div className="min-w-0">
              <p className={`text-lg font-semibold tabular-nums ${tone}`}>{value}</p>
              <p className="truncate text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-3 border-b border-slate-800 p-2">
        <select aria-label="Projeto aberto" value={sel?.id || ''} onChange={event => setSelId(emEdicao.find(project => String(project.id) === event.target.value)?.id ?? null)} className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"><option value="" disabled>Selecione um projeto</option>{filteredQueue.map(project => <option key={project.id} value={project.id}>{project.episodio || '—'} · {project.titulo}</option>)}</select>
        <button type="button" aria-expanded={detailsOpen} aria-controls="editing-project-details" onClick={() => setDetailsOpen(value => !value)} className="shrink-0 rounded border border-sky-800 px-3 py-2 text-xs text-sky-300">{detailsOpen ? 'Esconder fila e detalhes' : 'Mostrar fila e detalhes'}</button>
      </div>

      <div id="editing-project-details" data-testid="editing-project-details" hidden={!detailsOpen} className="max-h-[65vh] shrink-0 overflow-y-auto border-b border-slate-800">
      <div className="grid min-h-0 lg:grid-cols-[minmax(280px,30%)_minmax(0,1fr)]">
      {/* Lista */}
      <div className="flex min-h-0 flex-col border-b border-slate-800 bg-slate-950/20 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-300"><Scissors size={14} className="text-sky-400" /> Fila de trabalho</p>
            <p className="mt-0.5 text-[10px] text-slate-500">Selecione uma entrega para trabalhar no painel ao lado.</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1 border-b border-slate-800 p-2">
          {[
            ['para_editar', 'Para editar', queueCounts.para_editar],
            ['em_edicao', 'Em edição', queueCounts.em_edicao],
            ['aguardando', 'Alteração', queueCounts.aguardando],
          ].map(([id, label, count]) => <button key={id} onClick={() => { setQueueFilter(id); const first = emEdicao.find((project) => projectLane(project) === id); setSelId(first?.id ?? null); }} onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{e.preventDefault();moveToLane(e.dataTransfer.getData('text/plain'),id);}} className={`min-h-8 rounded border px-1.5 text-[9px] font-semibold transition-colors ${queueFilter === id ? 'border-sky-500 bg-sky-500/15 text-sky-300' : 'border-slate-800 text-slate-500 hover:bg-slate-900'}`}>{label} <span className="ml-1 rounded bg-slate-800 px-1 py-0.5 tabular-nums text-slate-300">{count}</span></button>)}
        </div>
        <div className="grid grid-cols-[1fr_auto] border-b border-slate-800 bg-slate-900/45 px-4 py-2 text-[9px] font-bold uppercase tracking-wide text-slate-500">
          <span>Entrega / responsável</span><span>Etapa</span>
        </div>
        <label className="flex items-center gap-2 p-3 text-xs text-slate-400">Ordenar por<select aria-label="Ordenar fila" value={sortOrder} onChange={event => setSortOrder(event.target.value)} className={inputCls()}><option value="deadline">Prazo (mais urgente)</option><option value="title">Título</option></select></label>
        <StageDragArea onMove={(id, dir) => {
          const project = emEdicao.find((item) => String(item.id) === String(id));
          const laneIndex = project ? EDITING_LANES.indexOf(laneForEditingProject(project)) : -1;
          const target = EDITING_LANES[laneIndex + dir];
          if (project && dir > 0 && laneIndex >= EDITING_LANES.indexOf('em_edicao')) {
            transicionar(project.id, 'em_aprovacao', { quem: editorName, obs: 'Versão encaminhada para revisão pela fila de edição' });
            toast({ title: 'Versão enviada para Em revisão', description: 'A entrega entrou na conferência.' });
          } else if (target) moveToLane(id, target);
        }} disableBack={disableBack} className="flex-1 min-h-0">
          <div className="h-full overflow-y-auto">
            {filteredQueue.length === 0 ? (
              <p className="px-3 py-10 text-center text-[11px] text-slate-500">{disableBack ? 'Nada em edição. Crie uma nova edição pra começar.' : 'Nada em edição. Arraste um projeto da Gravação pra cá, ou crie uma nova edição.'}</p>
            ) : (
              <div className="divide-y divide-slate-800">
                {filteredQueue.map((p) => {
                  const st = STATUS_LABEL[p.edicao_status] || 'Rascunho de corte';
                  return (
                    <DraggableStageCard key={p.id} id={p.id} etapa={p.etapa} onClick={() => setSelId(p.id)} className={`w-full border-l-2 px-4 py-3 text-left transition-colors ${selId === p.id ? 'border-l-sky-400 bg-sky-950/35' : 'border-l-transparent bg-transparent hover:bg-slate-900/60'}`}>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase text-sky-400">{p.episodio || '—'} · {p.programa}</p>
                        <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase bg-violet-500/15 text-violet-300">{st}</span>
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-200">{p.titulo}</p>
                      <p className="mt-1 text-[10px] text-slate-500">Responsável: <span className="text-slate-400">{p.editor || p.responsavel || '—'}</span></p>
                    </DraggableStageCard>
                  );
                })}
              </div>
            )}
          </div>
        </StageDragArea>
      </div>

      {/* Detalhamento de edição */}
      <div className="flex min-h-0 flex-col bg-slate-900/20">
        {sel ? (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
              <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-sky-400">{sel.episodio || '—'} · {sel.programa}</p>
              <h2 className="text-sm font-semibold text-slate-100">{sel.titulo}</h2>
              </div>
              <span className="rounded border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[9px] font-bold uppercase text-violet-300">{STATUS_LABEL[sel.edicao_status] || 'Rascunho de corte'}</span>
            </div>
            <div className="border-b border-slate-800 px-4 py-3">
              <div className="relative grid grid-cols-5 gap-2 before:absolute before:left-[10%] before:right-[10%] before:top-3 before:h-px before:bg-slate-700">
                {[
                  ['Gravação finalizada', sel.gravacao?.data || '—'],
                  ['Materiais recebidos', materiais.length ? `${materiais.length} arquivo(s)` : '—'],
                  ['Para editar', '—'],
                  ['Em edição', '—'],
                  ['Em revisão', '—'],
                ].map(([label, date], index) => <div key={label} className="relative z-10 text-center"><span className={`mx-auto flex size-6 items-center justify-center rounded-full border text-[9px] font-bold ${(index === 0 ? Boolean(sel.gravada) : index === 1 ? materiais.length > 0 : index === 2 ? selectedLaneIndex > 0 : index === 3 ? selectedLaneIndex >= 1 : false) ? 'border-sky-400 bg-sky-500 text-slate-950' : 'border-slate-600 bg-slate-950 text-slate-500'}`}>{(index === 0 ? Boolean(sel.gravada) : index === 1 ? materiais.length > 0 : index === 2 ? selectedLaneIndex > 0 : false) ? '✓' : index + 1}</span><p className="mt-1 text-[9px] font-semibold text-slate-300">{label}</p><p className="text-[8px] tabular-nums text-slate-600">{date}</p></div>)}
              </div>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {selectedLane === 'em_edicao' && <EditingProjectPanels key={sel.id + selectedLane} project={sel} lane={selectedLane} onChange={field} />}
              <section className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/45 p-3 xl:grid-cols-[1.25fr_.75fr]">
                <div><p className="text-[10px] font-bold uppercase text-slate-300">Material para edição</p><p className="mb-2 text-[9px] text-slate-500">Baixe os arquivos, gere o pacote do projeto ou continue no Workspace.</p><div className="flex flex-wrap gap-1.5"><button onClick={copiarNomes} className="flex items-center gap-1 rounded border border-sky-700/50 px-2 py-1.5 text-[9px] font-semibold text-sky-300 hover:bg-sky-950/40"><Download size={11} /> Copiar nomes</button><button onClick={() => baixarXmlPremiere(sel)} className="flex items-center gap-1 rounded border border-sky-700/50 px-2 py-1.5 text-[9px] font-semibold text-sky-300 hover:bg-sky-950/40"><FileCode2 size={11} /> Baixar XML</button><button onClick={() => baixarXmlPremiere(sel)} className="flex items-center gap-1 rounded border border-sky-700/50 px-2 py-1.5 text-[9px] font-semibold text-sky-300 hover:bg-sky-950/40"><Layers3 size={11} /> Pacote XML</button><button onClick={() => window.location.assign('/workspace')} className="flex items-center gap-1 rounded border border-sky-700/50 px-2 py-1.5 text-[9px] font-semibold text-sky-300 hover:bg-sky-950/40"><FolderOpen size={11} /> Abrir no Workspace</button></div></div>
                <div><p className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-300"><MessageCircle size={11} className="text-sky-400" /> Observações de edição</p><textarea value={sel.edicao_obs || ''} onChange={(e) => field('edicao_obs', e.target.value)} rows={3} className={`${inputCls()} mt-1`} placeholder="Cortes, ajustes, GC, trilha e observações..." /></div>
              </section>

              <div className="grid gap-2 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Título</span>
                  <input value={sel.titulo || ''} onChange={(e) => field('titulo', e.target.value)} className={inputCls()} />
                </label>
                <label className="block">
                  <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Programa</span>
                  <input value={sel.programa || ''} onChange={(e) => field('programa', e.target.value)} className={inputCls()} />
                </label>
                <label className="block">
                  <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Episódio</span>
                  <input value={sel.episodio || ''} onChange={(e) => field('episodio', e.target.value)} className={inputCls()} />
                </label>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-0.5 flex items-center gap-1 text-[9px] uppercase text-slate-500"><User size={10} /> Responsável pela edição</span>
                  <input value={sel.editor || sel.responsavel || ''} onChange={(e) => field('editor', e.target.value)} className={inputCls()} placeholder="Editor" />
                </label>
                <label className="block">
                  <span className="mb-0.5 flex items-center gap-1 text-[9px] uppercase text-slate-500"><Calendar size={10} /> Prazo de edição</span>
                  <input type="date" value={sel.edicao_prazo || ''} onChange={(e) => field('edicao_prazo', e.target.value)} className={inputCls()} />
                </label>
                <label className="block">
                  <span className="mb-0.5 block text-[9px] uppercase text-slate-500">Status da edição</span>
                  <select value={sel.edicao_status || 'rascunho_corte'} onChange={(e) => changeEditingStatus(e.target.value)} className={inputCls()}>
                    {EDICAO_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </label>
              </div>

              {/* Mídias — download, copiar nomes, XML Premiere */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-500"><FileCode2 size={11} /> Mídias da gravação ({materiais.length})</p>
                  {materiais.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <button onClick={copiarNomes} className="flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800" title="Copiar nomes dos arquivos pra colar no Premiere">
                        <Copy size={11} /> Copiar nomes
                      </button>
                      <button onClick={() => baixarXmlPremiere(sel)} className="flex items-center gap-1 rounded-md border border-violet-700/50 px-2 py-1 text-[10px] font-semibold text-violet-300 hover:bg-violet-950/40" title="Baixar projeto Premiere (XML) com os clipes">
                        <FileCode2 size={11} /> Baixar XML Premiere
                      </button>
                    </div>
                  )}
                </div>
                {materiais.length === 0 ? (
                  <p className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-3 text-[11px] text-slate-500">Sem mídias recebidas. O videomaker precisa subir os arquivos na aba Gravações.</p>
                ) : (
                  <div className="space-y-1.5">
                    {materiais.map((m) => (
                      <div key={m.id} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                        <FileText size={13} className="shrink-0 text-violet-300" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-slate-200">{m.nome}</p>
                          <p className="text-[10px] text-slate-500">{m.tamanho}</p>
                        </div>
                        <a href={m.url} download={m.nome} className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-sky-300" title="Baixar mídia">
                          <Download size={13} />
                        </a>
                      </div>
                    ))}
                    <p className="pt-1 text-[10px] text-slate-500">Baixe as mídias pra uma pasta local, abra o Premiere e conecte a pasta — ou importe o XML Premiere com os clipes já referenciados.</p>
                  </div>
                )}
              </div>

              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase text-slate-500">Resumo da produção</p>
                <div className="space-y-1 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-[11px] text-slate-400">
                  <p>Pauta: {sel.pauta || '—'}</p>
                  <p>Equipe: {(sel.equipe || []).join(', ') || '—'}</p>
                  <p>Gravação: {sel.gravacao ? `${sel.gravacao.data} · ${sel.gravacao.horario} · ${sel.gravacao.estudio}` : '—'}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 px-4 py-3">
              <button onClick={() => setAjusteOpen(true)} className="flex items-center gap-1.5 rounded-md border border-rose-700/50 px-3 py-1.5 text-[11px] font-bold text-rose-300 hover:bg-rose-950/40">
                <RotateCcw size={12} /> Solicitar ajuste ao videomaker
              </button>
              <div className="ml-auto flex flex-wrap gap-2">
                {selectedLaneIndex > 0 && <button onClick={()=>moveToLane(sel.id,EDITING_LANES[selectedLaneIndex-1])} className="flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-slate-800"><ChevronLeft size={12}/> Etapa anterior</button>}
                {selectedLane === 'para_editar' && <button onClick={()=>moveToLane(sel.id,'em_edicao')} className="flex items-center gap-1.5 rounded-md bg-sky-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-sky-400">Iniciar edição</button>}
                {(selectedLane === 'em_edicao' || selectedLane === 'aguardando') && <button onClick={enviarParaAprovacao} className="flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-emerald-400"><Send size={12} /> Enviar para revisão</button>}
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Selecione um projeto na lista para ver o detalhamento da edição.
          </div>
        )}
      </div>
      </div>

      </div>
      {sel && selectedLane === 'em_edicao' ? <div className="mmfilm-workspace-preview min-h-0 flex-1 overflow-auto" data-testid="editing-preview-timeline"><GraphicDraftProvider key={sel.id} scope={`${workScope || 'local'}:editing-mmfilm:${sel.id}`}><FilmCraftWorkspace previewAsset={(sel.materiais || []).filter(item => item.url || item.stream_url).map(item => ({...item,stream_url:item.stream_url || item.url,title:item.nome || item.filename,asset_type:item.tipo || 'video'}))[0] || null}/></GraphicDraftProvider></div> : sel ? <div className="min-h-0 flex-1 overflow-y-auto p-3"><EditingProjectPanels key={sel.id + selectedLane} project={sel} lane={selectedLane} onChange={field}/></div> : <p className="p-6 text-xs text-slate-400">Nenhuma entrega nesta etapa.</p>}

      <Dialog open={ajusteOpen} onOpenChange={setAjusteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-100"><RotateCcw size={16} className="text-rose-400" /> Solicitar ajuste ao videomaker</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-400">Descreva o ajuste. O projeto volta pra Gravação com essa observação e o videomaker é avisado.</p>
          <textarea value={ajusteObs} onChange={(e) => setAjusteObs(e.target.value)} rows={3} placeholder="Ex.: regravar a abertura, áudio do convidado baixo, cortar o trecho final..." className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setAjusteOpen(false)} className="rounded-md border border-slate-700 px-3 py-1.5 text-[11px] text-slate-400 hover:bg-slate-800">Cancelar</button>
            <button onClick={enviarAjuste} disabled={!ajusteObs.trim()} className="rounded-md bg-rose-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-rose-400 disabled:opacity-50">Enviar ajuste</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
