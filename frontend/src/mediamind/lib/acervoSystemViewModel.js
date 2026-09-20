export function buildAcervoSystemSummary(overview) {
  const processing = overview?.processing || {};
  const assets = overview?.assets || {};
  const services = overview?.services || [];
  const indexedRate = assets.total ? Math.round(((assets.indexed || 0) / assets.total) * 100) : 0;
  return [
    { id: 'active', label: 'Processamentos ativos', value: processing.active || 0, tone: 'sky' },
    { id: 'completed', label: 'Concluídos', value: processing.completed || 0, tone: 'emerald' },
    { id: 'failures', label: 'Falhas', value: (processing.failed || 0) + (assets.failures || 0), tone: 'amber' },
    { id: 'indexed', label: 'Taxa de indexação', value: `${indexedRate}%`, tone: 'violet' },
    { id: 'services', label: 'Serviços monitorados', value: services.length, tone: 'sky' },
  ];
}
