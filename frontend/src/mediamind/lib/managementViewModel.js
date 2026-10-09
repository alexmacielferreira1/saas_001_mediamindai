export function buildManagementKpis(overview) {
  const publications = overview?.publications || {};
  const assets = overview?.assets || {};
  const processing = overview?.processing || {};
  return [
    { id: 'published', label: 'Publicações realizadas', value: publications.published || 0, tone: 'emerald' },
    { id: 'scheduled', label: 'Publicações agendadas', value: publications.scheduled || 0, tone: 'sky' },
    { id: 'pending', label: 'Pendências editoriais', value: publications.pending || 0, tone: 'amber' },
    { id: 'approval', label: 'Taxa de aprovação', value: `${publications.approval_rate || 0}%`, tone: 'violet' },
    { id: 'assets', label: 'Arquivos no acervo', value: assets.total || 0, tone: 'sky' },
    { id: 'indexed', label: 'Indexados pela IA', value: assets.indexed || 0, tone: 'emerald' },
    { id: 'active', label: 'Processamentos ativos', value: processing.active || 0, tone: 'amber' },
    { id: 'failed', label: 'Erros recentes', value: (processing.failed || 0) + (assets.failures || 0), tone: 'rose' },
  ];
}

export function buildManagementAlerts(overview) {
  const alerts = [];
  if (overview?.publications?.pending) alerts.push({ kind: 'publication', label: `${overview.publications.pending} publicação(ões) aguardando revisão`, tone: 'amber' });
  if (overview?.processing?.active) alerts.push({ kind: 'processing', label: `${overview.processing.active} processamento(s) em andamento`, tone: 'sky' });
  if (overview?.assets?.failures || overview?.processing?.failed) {
    alerts.push({ kind: 'asset', label: `${(overview.assets?.failures || 0) + (overview.processing?.failed || 0)} falha(s) exigem atenção`, tone: 'rose' });
  }
  return alerts;
}
