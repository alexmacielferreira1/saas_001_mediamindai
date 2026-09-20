const ADMIN = ['admin', 'superadmin'];

export const MODULE_ROLES = {
  home: '*',
  search: '*',
  assistente: '*',
  ingest: [...ADMIN, 'producer', 'cedoc', 'videomaker'],
  workspace: [...ADMIN, 'producer', 'editor', 'cedoc', 'videomaker', 'reporter', 'journalist'],
  timeline: [...ADMIN, 'producer', 'editor', 'videomaker'],
  social: [...ADMIN, 'editor', 'social_media', 'coordenador_comunicacao'],
  acervo: [...ADMIN, 'cedoc', 'editor', 'producer', 'reporter', 'journalist'],
  management: ADMIN,
  corp: [...ADMIN, 'producer', 'editor', 'cedoc', 'videomaker', 'reporter', 'journalist',
    'apresentador', 'locutor', 'sonoplasta', 'fotografo', 'motion_designer', 'cenografo',
    'roteirista', 'revisor', 'tradutor', 'social_media', 'coordenador_comunicacao',
    'juridico', 'ti_suporte'],
};

export function canAccessModule(role, moduleId) {
  const allowed = MODULE_ROLES[moduleId];
  if (allowed === '*') return Boolean(role);
  return Boolean(role && allowed?.includes(role));
}
