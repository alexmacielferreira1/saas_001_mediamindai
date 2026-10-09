export function buildMediaHandoff(project, destination, inPoint, outPoint) {
  return {
    id: `handoff-${project.id}-${destination}`,
    sourceId: project.id,
    destination,
    titulo: project.titulo,
    descricao: project.pauta || 'Mídia finalizada enviada pela produção.',
    programa: project.programa,
    episodio: project.episodio,
    responsavel: project.responsavel || 'Equipe',
    inPoint,
    outPoint,
    duracao: project.duracao || outPoint,
    createdAt: new Date().toISOString(),
  };
}

export function timecodeToMs(value) {
  const parts = String(value || '').split(':').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return 0;
  return ((parts[0] * 3600) + (parts[1] * 60) + parts[2]) * 1000;
}
