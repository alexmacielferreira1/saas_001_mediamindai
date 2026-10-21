// Campos próprios das entradas de auditoria (before/after/reason/correlation_id/actor_role).
// Registros antigos não os têm; o motivo antigo fica em details.reason.
export function formatAuditValue(value) {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) return value.length ? value.map(formatAuditValue).join(', ') : 'nenhum';
  if (typeof value !== 'object') return String(value);
  const parts = Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .map(([key, item]) => `${key}: ${item === null ? '—' : formatAuditValue(item) || '—'}`);
  return parts.join(' · ');
}

export function auditChangeFields(item = {}) {
  const reason = item.reason || item.details?.reason || '';
  return [
    ['Antes', formatAuditValue(item.before)],
    ['Depois', formatAuditValue(item.after)],
    ['Motivo', reason],
    ['Cargo do responsável', item.actor_role || ''],
    ['Correlação', item.correlation_id || ''],
  ].filter(([, value]) => value);
}
