import { useState, useEffect, useMemo } from 'react';
import {
  MOCK_CORP_RECORDINGS, MOCK_ASSETS, MOCK_CORP_EDITS, MOCK_CORP_DRAFTS,
  MOCK_CORP_ARTICLES, MOCK_CORP_PUBLICATIONS,
  MOCK_CORP_APPROVAL_QUEUE, MOCK_CORP_RELEASES, MOCK_MONITORING,
  MOCK_CORP_PRODUCTIONS, MOCK_TASKS, CORP_STATUS_LABELS,
  MOCK_CORP_DESIGNS, MOCK_CORP_MAGAZINES, MOCK_CORP_CAMPAIGNS,
  MOCK_CORP_AGENDA_EVENTS, MOCK_CORP_AGENDA_EDICAO,
} from '../data';
import { FolderKanban, Activity, CheckCircle2, Archive } from 'lucide-react';
import { useProducaoProjetos } from './producaoStore';
import { loadOrSeedPublicacoes } from './corpPublicacoes';
import { loadOrSeedAprovacoes } from './corpAprovacoes';
import { loadOrSeedReleases } from './corpAssessoria';
import { loadOrSeedAgenda } from './corpAgenda';
import { CARGO_BY_ID } from './roleCatalog';

// Prettify de status variados (keys snake_case ou strings já legíveis).
const STATUS_PRETTY = {
  em_producao: 'Em produção', gravado: 'Gravado', em_edicao: 'Em edição',
  aguardando_aprovacao: 'Aprovação', aprovado: 'Aprovado', publicado: 'Publicado',
  rascunho: 'Rascunho', agendada: 'Agendada', gravada: 'Gravada',
  planejada: 'Planejada', confirmada: 'Confirmada', programado: 'Programado',
  in_progress: 'Em andamento', not_started: 'Não iniciado', delivered: 'Entregue',
  approved: 'Aprovado', published: 'Publicado', pending_review: 'Em revisão',
  ok: 'OK', warning: 'Atenção', active: 'Ativo',
  pendente: 'Pendente', reprovado: 'Reprovado',
};
function prettify(s) {
  if (!s && s !== 0) return '—';
  if (STATUS_PRETTY[s]) return STATUS_PRETTY[s];
  return String(s).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

// Cada função aponta para o seu "trabalho" (items) + como extrair título/sub/status.
// `done` define o que já está concluído (array de statuses ou função).
const CONFIG = {
  superadmin: { label: 'Operação completa', emoji: '🛡️', items: MOCK_CORP_PRODUCTIONS, title: (r) => r.titulo, sub: (r) => `${r.programa} · ${r.episodio}`, status: (r) => r.status, done: ['publicado'] },
  admin: { label: 'Operação completa', emoji: '⚙️', items: MOCK_CORP_PRODUCTIONS, title: (r) => r.titulo, sub: (r) => `${r.programa} · ${r.episodio}`, status: (r) => r.status, done: ['publicado'] },
  mvp: { label: 'Percurso MVP', emoji: '🎬', items: [], title: (r) => r.titulo, sub: (r) => r.programa, status: (r) => r.status, done: [] },
  producer: { label: 'Produções', emoji: '🎬', items: MOCK_CORP_PRODUCTIONS, title: (r) => r.titulo, sub: (r) => `${r.programa} · ${r.episodio}`, status: (r) => r.status, done: ['publicado'] },
  editor: { label: 'Edições', emoji: '✂️', items: MOCK_CORP_EDITS, title: (r) => r.titulo, sub: (r) => r.programa, status: (r) => r.status, done: (r) => r.progresso >= 100 },
  videomaker: { label: 'Captações', emoji: '🎥', items: MOCK_CORP_RECORDINGS, title: (r) => `${r.episodio} — ${r.titulo}`, sub: (r) => `${r.programa} · ${r.estudio}`, status: (r) => r.status, done: ['gravada'] },
  journalist: { label: 'Matérias', emoji: '📝', items: MOCK_CORP_ARTICLES, title: (r) => r.titulo, sub: (r) => r.canal, status: (r) => r.status, done: ['publicado'] },
  gestao: { label: 'Produções', emoji: '📊', items: MOCK_CORP_PRODUCTIONS, title: (r) => r.titulo, sub: (r) => `${r.programa} · ${r.episodio}`, status: (r) => r.status, done: ['publicado'] },
  cedoc: { label: 'Itens do acervo', emoji: '🗄️', items: MOCK_ASSETS, title: (r) => r.title, sub: (r) => r.program_name, status: (r) => r.ai_status, done: ['complete'] },
  apresentador: { label: 'Gravações', emoji: '🎬', items: MOCK_CORP_RECORDINGS, title: (r) => `${r.episodio} — ${r.titulo}`, sub: (r) => `${r.programa} · ${r.data} ${r.horario}`, status: (r) => r.status, done: ['gravada'] },
  cenografo: { label: 'Cenografia', emoji: '🎭', items: MOCK_CORP_RECORDINGS, title: (r) => `${r.episodio} — ${r.titulo}`, sub: (r) => `${r.programa} · ${r.estudio}`, status: (r) => r.status, done: ['gravada'] },
  locutor: { label: 'Locução', emoji: '🎙️', items: MOCK_CORP_RECORDINGS, title: (r) => `${r.episodio} — ${r.titulo}`, sub: (r) => `${r.programa} · ${r.horario}`, status: (r) => r.status, done: ['gravada'] },
  sonoplasta: { label: 'Áudio', emoji: '🎧', items: MOCK_CORP_RECORDINGS, title: (r) => `${r.episodio} — ${r.titulo}`, sub: (r) => `${r.programa} · ${r.estudio}`, status: (r) => r.status, done: ['gravada'] },
  fotografo: { label: 'Coberturas', emoji: '📷', items: MOCK_ASSETS, title: (r) => r.title, sub: (r) => r.program_name, status: (r) => r.ai_status, done: ['complete'] },
  motion_designer: { label: 'Motion', emoji: '🎞️', items: MOCK_CORP_EDITS, title: (r) => r.titulo, sub: (r) => r.programa, status: (r) => r.status, done: (r) => r.progresso >= 100 },
  roteirista: { label: 'Roteiros', emoji: '✍️', items: MOCK_CORP_DRAFTS, title: (r) => r.titulo, sub: (r) => r.programa, status: (r) => r.status, done: ['gravada'] },
  revisor: { label: 'Matérias', emoji: '📝', items: MOCK_CORP_ARTICLES, title: (r) => r.titulo, sub: (r) => r.canal, status: (r) => r.status, done: ['publicado'] },
  tradutor: { label: 'Legendas', emoji: '🌐', items: MOCK_CORP_PUBLICATIONS, title: (r) => r.titulo, sub: (r) => r.plataforma, status: (r) => r.status, done: ['publicado'] },
  social_media: { label: 'Publicações', emoji: '📱', items: MOCK_CORP_PUBLICATIONS, title: (r) => r.titulo, sub: (r) => r.plataforma, status: (r) => r.status, done: ['publicado'] },
  coordenador_comunicacao: { label: 'Aprovações', emoji: '✅', items: MOCK_CORP_APPROVAL_QUEUE, title: (r) => r.titulo, sub: (r) => `${r.segmento} · ${r.tipo}`, status: (r) => r.status, done: ['aprovado'] },
  juridico: { label: 'Releases', emoji: '⚖️', items: MOCK_CORP_RELEASES, title: (r) => r.titulo, sub: (r) => `${r.veiculos} veículos · ${r.data}`, status: (r) => r.status, done: ['publicado'] },
  ti_suporte: { label: 'Serviços', emoji: '🖥️', items: MOCK_MONITORING.services, title: (r) => r.label, sub: (r) => r.detail, status: (r) => r.status, done: [] },
  reporter: { label: 'Reportagens', emoji: '📰', items: MOCK_CORP_ARTICLES, title: (r) => r.titulo, sub: (r) => r.canal, status: (r) => r.status, done: ['publicado'] },
  produtor_reportagem: { label: 'Reportagens', emoji: '📰', items: MOCK_CORP_ARTICLES, title: (r) => r.titulo, sub: (r) => r.canal, status: (r) => r.status, done: ['publicado'] },
  diretor_programa: { label: 'Produções', emoji: '🎬', items: MOCK_CORP_PRODUCTIONS, title: (r) => r.titulo, sub: (r) => `${r.programa} · ${r.episodio}`, status: (r) => r.status, done: ['publicado'] },
  estagiario: { label: 'Tarefas', emoji: '📋', items: MOCK_TASKS, title: (r) => r.title, sub: (r) => r.project_name, status: (r) => r.status, done: ['approved'] },
  programacao: { label: 'Grade', emoji: '📅', items: MOCK_CORP_PUBLICATIONS, title: (r) => r.titulo, sub: (r) => r.plataforma, status: (r) => r.status, done: ['publicado'] },
  qualidade: { label: 'QC', emoji: '🔍', items: MOCK_CORP_APPROVAL_QUEUE, title: (r) => r.titulo, sub: (r) => `${r.segmento} · ${r.tipo}`, status: (r) => r.status, done: ['aprovado'] },
  redacao: { label: 'Matérias', emoji: '📝', items: MOCK_CORP_ARTICLES, title: (r) => r.titulo, sub: (r) => r.canal, status: (r) => r.status, done: ['publicado'] },
  design: { label: 'Artes', emoji: '🎨', items: MOCK_CORP_DESIGNS, title: (r) => r.titulo, sub: (r) => r.tipo, status: (r) => r.status, done: ['entregue'] },
  assessoria: { label: 'Releases', emoji: '📰', items: MOCK_CORP_RELEASES, title: (r) => r.titulo, sub: (r) => `${r.veiculos} veículos · ${r.data}`, status: (r) => r.status, done: ['publicado'] },
  audiovisual: { label: 'Edições', emoji: '🎬', items: MOCK_CORP_EDITS, title: (r) => r.titulo, sub: (r) => r.programa, status: (r) => r.status, done: (r) => r.progresso >= 100 },
  revistas: { label: 'Revistas', emoji: '📖', items: MOCK_CORP_MAGAZINES, title: (r) => r.titulo, sub: (r) => `Edição ${r.edicao}`, status: (r) => r.status, done: ['publicada'] },
  endomarketing: { label: 'Campanhas', emoji: '👥', items: MOCK_CORP_CAMPAIGNS, title: (r) => r.titulo, sub: (r) => `Alcance ${r.alcance}`, status: (r) => r.status, done: [] },
  documentacao: { label: 'Documentos', emoji: '📄', items: MOCK_CORP_ARTICLES, title: (r) => r.titulo, sub: (r) => r.canal, status: (r) => r.status, done: ['publicado'] },
};

const ALL_AGENDA_TYPES = ['gravacao', 'edicao', 'aprovacao', 'publicacao'];
const AGENDA_TYPES = {
  superadmin: ALL_AGENDA_TYPES,
  admin: ALL_AGENDA_TYPES,
  gestao: ALL_AGENDA_TYPES,
  diretor_programa: ALL_AGENDA_TYPES,
  coordenador_comunicacao: ALL_AGENDA_TYPES,
  producer: ['gravacao', 'edicao', 'aprovacao', 'publicacao'],
  mvp: [],
  editor: ['edicao'], motion_designer: ['edicao'], audiovisual: ['edicao'],
  videomaker: ['gravacao'], apresentador: ['gravacao'], cenografo: ['gravacao'],
  locutor: ['gravacao'], sonoplasta: ['gravacao'], fotografo: ['gravacao'],
  roteirista: ['gravacao'], reporter: ['gravacao'], produtor_reportagem: ['gravacao'],
  estagiario: ['gravacao'], cedoc: ['gravacao', 'publicacao'],
  qualidade: ['aprovacao'], revisor: ['aprovacao'], juridico: ['aprovacao'],
  design: ['aprovacao'], revistas: ['aprovacao', 'publicacao'], documentacao: ['aprovacao'],
  social_media: ['publicacao'], programacao: ['publicacao'], tradutor: ['publicacao'],
  assessoria: ['publicacao'], endomarketing: ['publicacao'], redacao: ['publicacao'],
  journalist: ['publicacao'], ti_suporte: ALL_AGENDA_TYPES,
};

export function personalizedAgenda(roleId, events) {
  const types = AGENDA_TYPES[roleId];
  if (!CONFIG[roleId] || !types) return [];
  return events.filter((event) => types.includes(event.type));
}

export function mergeAgendaEvents(persisted, defaults) {
  const byId = new Map(defaults.map((event) => [String(event.id), event]));
  persisted.forEach((event) => byId.set(String(event.id), event));
  return [...byId.values()];
}

const ROLE_WORK_TABS = {
  editor: 'em_edicao', videomaker: 'gravacoes', cedoc: 'midias',
  design: 'solicitacoes', audiovisual: 'edicoes', assessoria: 'releases',
  redacao: 'materias', journalist: 'materias', revistas: 'materias',
  endomarketing: 'campanhas', documentacao: 'docs', gestao: 'relatorios',
  social_media: 'publicacoes', programacao: 'publicacoes', producer: 'gravacoes',
};

export function workTabForRole(roleId, status = '') {
  const normalized = String(status).toLowerCase().replace(/\s+/g, '_');
  if (roleId === 'producer') {
    if (normalized.includes('aprov')) return 'em_aprovacao';
    if (normalized.includes('edi')) return 'em_edicao';
    if (normalized.includes('public')) return 'publicacoes';
    if (normalized.includes('final')) return 'finalizado';
  }
  return ROLE_WORK_TABS[roleId] || 'workspace';
}

function isDone(item, done) {
  if (!done) return false;
  if (Array.isArray(done)) return done.includes(item.status);
  return !!done(item);
}

// Roles cujo "trabalho" vem de uma entidade persistente (load/seed).
const ENTITY_LOADERS = {
  tradutor: loadOrSeedPublicacoes,
  social_media: loadOrSeedPublicacoes,
  programacao: loadOrSeedPublicacoes,
  coordenador_comunicacao: loadOrSeedAprovacoes,
  qualidade: loadOrSeedAprovacoes,
  assessoria: loadOrSeedReleases,
  juridico: loadOrSeedReleases,
};

// Monta o "Início" padrão de uma função a partir de items + projetos.
function computeData(roleId, cfg, items, projetos, agenda = []) {
  const doneCount = items.filter((i) => isDone(i, cfg.done)).length;
  const pending = items.length - doneCount;

  const resumeItems = items
    .filter((i) => !isDone(i, cfg.done))
    .slice(0, 6)
    .map((i, idx) => ({
      id: i.id ?? idx,
      title: cfg.title(i),
      subtitle: cfg.sub(i),
      status: cfg.status(i),
      statusLabel: prettify(cfg.status(i)),
      workTab: workTabForRole(roleId, cfg.status(i)),
    }));

  const tasks = items.map((i, idx) => ({
    id: i.id ?? idx,
    title: cfg.title(i),
    subtitle: cfg.sub(i),
    status: cfg.status(i),
      statusLabel: prettify(cfg.status(i)),
      workTab: workTabForRole(roleId, cfg.status(i)),
  }));

  const projects = projetos.slice(0, 4).map((p) => ({
    id: p.id,
    name: p.titulo,
    meta: `${p.programa} · ${p.episodio}`,
    status: p.etapa,
    statusLabel: CORP_STATUS_LABELS[p.etapa] || prettify(p.etapa),
    emoji: '🎬',
    workTab: workTabForRole(roleId, p.etapa),
  }));

  const stats = [
    { title: cfg.label, value: items.length, icon: FolderKanban, tone: 'sky' },
    { title: 'Em andamento', value: pending, icon: Activity, tone: 'amber' },
    { title: 'Concluídos', value: doneCount, icon: CheckCircle2, tone: 'emerald' },
    { title: 'Produções', value: projetos.length, icon: Archive, tone: 'violet' },
  ];

  return {
    roleName: CARGO_BY_ID[roleId]?.name || cfg.label,
    roleDescription: CARGO_BY_ID[roleId]?.description || `Visão de trabalho: ${cfg.label}`,
    stats, resumeItems, tasks, projects,
    agenda: personalizedAgenda(roleId, agenda),
  };
}

// Hook assíncrono: carrega o trabalho da função da entidade quando ela tem
// loader próprio (Publicacao/AprovacaoItem/Release) e dos projetos do
// producaoStore; roles sem loader continuam lendo o mock (síncrono, sem flash).
export function useRoleInicioData(roleId) {
  const cfg = CONFIG[roleId];
  const projetos = useProducaoProjetos();
  const [items, setItems] = useState(cfg?.items || []);
  const isEntity = !!ENTITY_LOADERS[roleId];
  const [loading, setLoading] = useState(isEntity);
  const [agenda, setAgenda] = useState([...MOCK_CORP_AGENDA_EVENTS, ...MOCK_CORP_AGENDA_EDICAO]);

  useEffect(() => {
    const loader = ENTITY_LOADERS[roleId];
    if (!loader) return;
    let alive = true;
    setLoading(true);
    loader()
      .then((loaded) => {
        if (!alive) return;
        setItems(loaded.length > 0 ? loaded : (cfg?.items || []));
      })
      .catch(() => { if (alive) setItems(cfg?.items || []); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [roleId]);

  useEffect(() => {
    let alive = true;
    const fallback = [...MOCK_CORP_AGENDA_EVENTS, ...MOCK_CORP_AGENDA_EDICAO];
    loadOrSeedAgenda(fallback)
      .then((loaded) => { if (alive) setAgenda(mergeAgendaEvents(loaded, fallback)); })
      .catch(() => { if (alive) setAgenda(fallback); });
    return () => { alive = false; };
  }, []);

  const data = useMemo(
    () => (cfg ? computeData(roleId, cfg, items, projetos, agenda) : null),
    [agenda, cfg, items, projetos, roleId],
  );

  if (!cfg) return { data: null, loading: false };
  return { data, loading };
}

// Versão síncrona (mock) mantida para compatibilidade.
export function roleInicioData(roleId) {
  const cfg = CONFIG[roleId];
  if (!cfg) return null;
  return computeData(
    roleId,
    cfg,
    cfg.items || [],
    MOCK_CORP_PRODUCTIONS,
    [...MOCK_CORP_AGENDA_EVENTS, ...MOCK_CORP_AGENDA_EDICAO],
  );
}
