export const EDITING_LANES = ['para_editar', 'em_edicao', 'aguardando'];

export function laneForEditingStatus(status) {
  if (status === 'pronto_para_aprovacao') return 'aguardando';
  if (status === 'corte_fino' || status === 'revisao_interna') return 'em_edicao';
  return 'para_editar';
}

export function laneForEditingProject(project) {
  if (project?.etapa === 'para_editar') return 'para_editar';
  if (project?.etapa === 'aguardando_aprovacao' || project?.etapa === 'aguardando') return 'aguardando';
  return laneForEditingStatus(project?.edicao_status) === 'para_editar' && project?.etapa === 'em_edicao'
    ? 'em_edicao'
    : laneForEditingStatus(project?.edicao_status);
}

export function moveEditingLane(currentStatus, targetLane) {
  const currentLane = laneForEditingStatus(currentStatus);
  const from = EDITING_LANES.indexOf(currentLane);
  const to = EDITING_LANES.indexOf(targetLane);
  if (to < 0 || Math.abs(from - to) !== 1) return null;
  return { para_editar: 'rascunho_corte', em_edicao: 'corte_fino', aguardando: 'pronto_para_aprovacao' }[targetLane];
}

export function editingTransition(project, targetLane) {
  const currentLane = laneForEditingProject(project);
  const from = EDITING_LANES.indexOf(currentLane);
  const to = EDITING_LANES.indexOf(targetLane);
  if (to < 0 || Math.abs(from - to) !== 1) return null;
  return {
    etapa: { para_editar: 'para_editar', em_edicao: 'em_edicao', aguardando: 'aguardando_aprovacao' }[targetLane],
    edicao_status: { para_editar: 'rascunho_corte', em_edicao: 'corte_fino', aguardando: 'pronto_para_aprovacao' }[targetLane],
  };
}
