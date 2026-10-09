export const PRODUCTION_STAGES = [
  { id: 'rascunho', label: 'Rascunhos' },
  { id: 'agendamentos', label: 'Agendamentos' },
  { id: 'gravacoes', label: 'Gravações' },
  { id: 'para_editar', label: 'Material para editar' },
  { id: 'em_edicao', label: 'Em edição' },
  { id: 'aguardando_aprovacao', label: 'Alteração' },
  { id: 'em_aprovacao', label: 'Em revisão' },
  { id: 'finalizado', label: 'Finalizado' },
  { id: 'redes_sociais', label: 'Redes sociais' },
  { id: 'para_publicar', label: 'Para publicação' },
  { id: 'publicado', label: 'Publicado' },
  { id: 'analytics', label: 'Analytics' },
];

export const PRODUCTION_STAGE_ORDER = PRODUCTION_STAGES
  .map((stage) => stage.id)
  .filter((stage) => stage !== 'aguardando_aprovacao');

const LEGACY_STAGE_ALIASES = {
  aguardando: 'aguardando_aprovacao',
  gravacao: 'gravacoes',
  publicacoes: 'publicado',
};

export function normalizeProductionStage(stage) {
  const normalized = LEGACY_STAGE_ALIASES[stage] || stage;
  return PRODUCTION_STAGES.some((item) => item.id === normalized) ? normalized : 'revisar_classificacao';
}

export function resolveProjectProductionStage(project) {
  if (!project) return null;
  if (project.etapa === 'gravacao') {
    return project.gravada || project.grav_status === 'gravada' ? 'gravacoes' : 'agendamentos';
  }
  return normalizeProductionStage(project.etapa);
}

export function isProjectInProductionStage(project, stage) {
  return resolveProjectProductionStage(project) === normalizeProductionStage(stage);
}

export function isScheduleReady(project) {
  return Boolean(project?.gravacao?.data && project?.gravacao?.horario);
}

export function getAdjacentProductionStage(stage, direction) {
  const current = normalizeProductionStage(stage);
  if (current === 'aguardando_aprovacao') return direction > 0 ? 'em_aprovacao' : 'em_edicao';
  if (current === 'em_aprovacao' && direction < 0) return 'aguardando_aprovacao';
  const index = PRODUCTION_STAGE_ORDER.indexOf(current);
  if (index < 0) return null;
  return PRODUCTION_STAGE_ORDER[index + Math.sign(direction)] || null;
}

export function getProductionTransition(stage, direction) {
  if (direction !== -1 && direction !== 1) return { ok: false, reason: 'invalid_direction' };
  const from = normalizeProductionStage(stage);
  if (from === 'revisar_classificacao') return { ok: false, reason: 'unknown_stage' };
  const to = getAdjacentProductionStage(from, direction);
  if (!to) return { ok: false, reason: direction < 0 ? 'first_stage' : 'last_stage' };
  return { ok: true, from, to };
}

export function productionStageLabel(stage) {
  const normalized = normalizeProductionStage(stage);
  return PRODUCTION_STAGES.find((item) => item.id === normalized)?.label || 'Revisar classificação';
}
