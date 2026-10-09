// ============================================================================
// Catálogo oficial de cargos/funções do IAcervo Corp + persistência de acessos.
//
// Cada cargo define as telas (ids de abas do Corp) que o usuário enxerga POR
// PADRÃO. O admin pode editar esses padrões e, por pessoa, adicionar/remover
// telas específicas (overrides). Tudo persiste em localStorage (mock); ao
// migrar para backend real, trocar a fonte de dados — a lógica fica aqui.
//
// Princípio: negar por padrão. O cargo "admin" tem acesso total ('*').
// ============================================================================

// Cargo id alinhado ao role do mock auth (admin/producer/editor/cedoc/...).
// defaultTabs reference ids de CORP_TABS. '*' = acesso total.
export const ROLE_CATALOG = [
  { id: 'superadmin', name: 'Superadministrador', description: 'Acesso total ao sistema e às empresas.', defaultTabs: '*' },
  { id: 'admin', name: 'Administrador', description: 'Acesso total ao sistema.', defaultTabs: '*' },
  { id: 'mvp', name: 'MVP', description: 'Percurso utilizável de produção audiovisual.', defaultTabs: ['producao'] },
  { id: 'producer', name: 'Produtor', description: 'Produção de conteúdo audiovisual.', defaultTabs: ['producao'] },
  { id: 'editor', name: 'Editor de vídeo', description: 'Edição e pós-produção.', defaultTabs: ['editor_video'] },
  { id: 'videomaker', name: 'Videomaker', description: 'Gravação e captação.', defaultTabs: ['videomaker'] },
  { id: 'reporter', name: 'Repórter', description: 'Reportagem em campo.', defaultTabs: ['reporter'] },
  { id: 'produtor_reportagem', name: 'Produtor de reportagem', defaultTabs: ['produtor_reportagem'] },
  { id: 'diretor_programa', name: 'Diretor de programa', description: 'Direção + gestão.', defaultTabs: ['diretor_programa', 'gestao'] },
  { id: 'estagiario', name: 'Estagiário', defaultTabs: ['estagiario'] },
  { id: 'programacao', name: 'Programação', defaultTabs: ['programacao'] },
  { id: 'qualidade', name: 'Controle de qualidade', defaultTabs: ['qualidade'] },
  { id: 'journalist', name: 'Redação / Jornalista', description: 'Textos e conteúdo editorial.', defaultTabs: ['redacao'] },
  { id: 'design', name: 'Designer', defaultTabs: ['design'] },
  { id: 'assessoria', name: 'Assessoria de Imprensa', defaultTabs: ['assessoria'] },
  { id: 'audiovisual', name: 'Audiovisual', defaultTabs: ['audiovisual'] },
  { id: 'revistas', name: 'Revistas', defaultTabs: ['revistas'] },
  { id: 'endomarketing', name: 'Endomarketing', defaultTabs: ['endomarketing'] },
  { id: 'documentacao', name: 'Documentação', defaultTabs: ['documentacao'] },
  { id: 'gestao', name: 'Gestão', defaultTabs: ['gestao'] },
  { id: 'cedoc', name: 'CEDOC', defaultTabs: ['cedoc'] },
  { id: 'apresentador', name: 'Apresentador', defaultTabs: ['apresentador'] },
  { id: 'locutor', name: 'Locutor', defaultTabs: ['locutor'] },
  { id: 'sonoplasta', name: 'Sonoplasta', defaultTabs: ['sonoplasta'] },
  { id: 'fotografo', name: 'Fotógrafo', defaultTabs: ['fotografo'] },
  { id: 'motion_designer', name: 'Motion Designer', defaultTabs: ['motion_designer'] },
  { id: 'cenografo', name: 'Cenógrafo', defaultTabs: ['cenografo'] },
  { id: 'roteirista', name: 'Roteirista', defaultTabs: ['roteirista'] },
  { id: 'revisor', name: 'Revisor', defaultTabs: ['revisor'] },
  { id: 'tradutor', name: 'Tradutor', defaultTabs: ['tradutor'] },
  { id: 'social_media', name: 'Social Media', defaultTabs: ['social_media'] },
  { id: 'coordenador_comunicacao', name: 'Coord. de Comunicação', description: 'Visão consolidada + aprovações.', defaultTabs: ['coordenador_comunicacao', 'gestao'] },
  { id: 'juridico', name: 'Jurídico', defaultTabs: ['juridico'] },
  { id: 'ti_suporte', name: 'TI / Suporte', defaultTabs: ['ti_suporte'] },
];

export const CARGO_BY_ID = Object.fromEntries(ROLE_CATALOG.map((c) => [c.id, c]));

const DEFAULTS_KEY = 'mm_role_defaults_v1';
const USERS_KEY = 'mm_user_access_v1';

function readJSON(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? fallback : v; } catch { return fallback; }
}
function writeJSON(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

// Padrão de telas de um cargo. Retorna null = acesso total (admin); array = ids.
export function getCargoDefaultTabs(cargoId) {
  const cargo = CARGO_BY_ID[cargoId];
  if (!cargo) return [];
  if (cargo.defaultTabs === '*') return null;
  const overrides = readJSON(DEFAULTS_KEY, {});
  return overrides[cargoId] ?? cargo.defaultTabs;
}

export function setCargoDefaultTabs(cargoId, tabs) {
  const overrides = readJSON(DEFAULTS_KEY, {});
  overrides[cargoId] = tabs;
  writeJSON(DEFAULTS_KEY, overrides);
}

// Acesso atribuído a um usuário: { role, extraTabs, removedTabs }.
export function getUserAccess(userId, fallbackRole) {
  const all = readJSON(USERS_KEY, {});
  return all[userId] || { role: fallbackRole || null, extraTabs: [], removedTabs: [] };
}

export function setUserAccess(userId, access) {
  const all = readJSON(USERS_KEY, {});
  all[userId] = access;
  writeJSON(USERS_KEY, all);
}

// Telas efetivas que o usuário enxerga, dado o catálogo de telas disponíveis.
// Admin vê tudo; demais cargos = padrão ∪ extraTabs − removedTabs.
export function effectiveTabsForUser(user, allTabIds) {
  if (!user) return [];
  if (user.role === 'admin' || user.role === 'superadmin') return allTabIds;
  const access = getUserAccess(user.id, user.role);
  const role = access.role || user.role;
  if (role === 'admin' || role === 'superadmin') return allTabIds;
  const def = getCargoDefaultTabs(role);
  const base = def === null ? allTabIds : (def || []);
  const set = new Set(base);
  (access.extraTabs || []).forEach((t) => set.add(t));
  (access.removedTabs || []).forEach((t) => set.delete(t));
  return allTabIds.filter((t) => set.has(t));
}
