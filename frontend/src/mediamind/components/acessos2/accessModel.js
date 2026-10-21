import { canAccessModule } from '../../lib/moduleAccess';
import { CARGO_BY_ID, ROLE_CATALOG } from '../../lib/roleCatalog';
import { tenantRoleLabel, TENANT_ROLE_LABELS } from '../../lib/tenantRoleLabels';

// Modelo de leitura das Telas 2 de acessos. Só combina dados reais do
// servidor (usuários, memberships, perfis, auditoria) com as regras de acesso
// que o frontend já aplica (moduleAccess e catálogo de cargos). Nada é gravado.

export const MODULES = [
  { id: 'ingest', label: 'Ingest' },
  { id: 'workspace', label: 'Workspace 2' },
  { id: 'timeline2', label: 'Timeline 2' },
  { id: 'acervo', label: 'Acervo' },
  { id: 'corp', label: 'Produção (Corp)' },
  { id: 'social', label: 'Redes sociais' },
  { id: 'management', label: 'Gestão / Administração' },
  { id: 'assistente', label: 'Assistente IA' },
  { id: 'ai_tools', label: 'Ferramentas de IA' },
];

const AREA_EXTRA_LABELS = { producao: 'Produção', editor_video: 'Edição de vídeo', redacao: 'Redação', gestao: 'Gestão' };

export function areaLabel(id) {
  return AREA_EXTRA_LABELS[id] || TENANT_ROLE_LABELS[id] || id;
}

export function roleLabel(role) {
  return CARGO_BY_ID[role]?.name || tenantRoleLabel(role);
}

export const ROLE_OPTIONS = ROLE_CATALOG.map((cargo) => ({ id: cargo.id, label: cargo.name }));

export function isAdminRole(role) {
  return role === 'admin' || role === 'superadmin';
}

export function moduleAccessFor(role) {
  return MODULES.map((module) => ({ ...module, allowed: canAccessModule(role, module.id) }));
}

// Áreas da Produção (abas do Corp): padrão do cargo + exceções gravadas no
// servidor (extra_screens = Permitir, restricted_screens = Negar).
export function areaAccessFor(role, extra = [], restricted = []) {
  if (isAdminRole(role)) return { full: true, rows: [] };
  const defaults = CARGO_BY_ID[role]?.defaultTabs;
  const base = Array.isArray(defaults) ? defaults : [];
  const ids = [...new Set([...base, ...extra, ...restricted])];
  return {
    full: false,
    rows: ids.map((id) => {
      const fromRole = base.includes(id);
      const exception = restricted.includes(id) ? 'deny' : extra.includes(id) ? 'allow' : 'inherit';
      const effective = exception === 'deny' ? false : exception === 'allow' ? true : fromRole;
      return { id, label: areaLabel(id), fromRole, exception, effective };
    }),
  };
}

// Junta usuários administrativos (/admin/users) e memberships (/memberships).
export function buildPeople(users = [], memberships = []) {
  const byUser = new Map(memberships.map((item) => [String(item.user_id), item]));
  const people = users.map((user) => {
    const membership = byUser.get(String(user.id));
    return {
      id: String(user.id),
      name: user.full_name || user.email,
      email: user.email,
      role: membership?.role || user.tenant_role,
      profileName: user.profile_name || null,
      status: user.status,
      lastAccess: user.last_access_at || null,
      extra: membership?.extra_screens || [],
      restricted: membership?.restricted_screens || [],
      hasMembership: Boolean(membership),
    };
  });
  memberships.forEach((membership) => {
    if (people.some((person) => person.id === String(membership.user_id))) return;
    people.push({
      id: String(membership.user_id), name: membership.full_name || membership.email, email: membership.email,
      role: membership.role, profileName: null, status: 'active', lastAccess: null,
      extra: membership.extra_screens || [], restricted: membership.restricted_screens || [], hasMembership: true,
    });
  });
  return people.sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
}

const AUDIT_LABELS = {
  'user.suspended': 'Suspendeu usuário', 'user.reactivated': 'Reativou usuário',
  'user.sessions_revoked': 'Revogou sessões', 'record.created': 'Criou registro',
  'record.updated': 'Atualizou registro', 'record.deleted': 'Excluiu registro',
  'records.bulk_created': 'Importou registros', 'records.bulk_updated': 'Atualizou registros em lote',
  'creative_document.created': 'Criou documento criativo',
  'creative_document.updated': 'Atualizou documento criativo',
  'creative_document.approved': 'Aprovou documento criativo',
  'creative_export.ready': 'Concluiu exportação criativa',
  'membership.role_changed': 'Alterou o papel do membro',
  'membership.permission_group_changed': 'Alterou o grupo de permissões do membro',
  'membership.screens_changed': 'Alterou as telas do membro',
  'permission_group.created': 'Criou grupo de permissões',
  'permission_group.updated': 'Atualizou grupo de permissões',
  'permission_group.deactivated': 'Desativou grupo de permissões',
  'production.stage_changed': 'Mudou a etapa da produção',
  'settings.updated': 'Atualizou configurações',
  'thumbnail.settings_updated': 'Atualizou configurações de thumbnails',
  'thumbnail.cutout_created': 'Criou recorte de thumbnail',
  'dark_channel.created': 'Criou canal dark',
  'dark_channel.updated': 'Atualizou canal dark',
  'dark_script.created': 'Criou roteiro de canal dark',
  'dark_script.updated': 'Atualizou roteiro de canal dark',
  'mcp.tool.called': 'Executou ferramenta MCP',
  'mcp.queue.created': 'Criou fila MCP',
  'mcp.queue.executed': 'Executou fila MCP',
};

export function auditActionLabel(action = '') {
  return AUDIT_LABELS[action] || (action ? action.replaceAll('.', ' ').replaceAll('_', ' ') : 'Ação registrada');
}

export function auditReference(record) {
  return `AUD-${String(record?.id || '').slice(0, 8).toUpperCase() || '—'}`;
}
