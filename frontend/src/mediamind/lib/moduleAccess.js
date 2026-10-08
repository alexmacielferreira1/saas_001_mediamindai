const ADMIN = ['admin', 'superadmin'];

export const MODULE_ROLES = {
  home: '*',
  search: '*',
  assistente: '*',
  thumbnails: '*',
  ai_tools: '*',
  ingest: [...ADMIN, 'producer', 'cedoc', 'videomaker'],
  workspace: [...ADMIN, 'producer', 'editor', 'cedoc', 'videomaker', 'reporter', 'journalist', 'mvp'],
  workspace2: [...ADMIN, 'producer', 'editor', 'cedoc', 'videomaker', 'reporter', 'journalist', 'mvp'],
  timeline: [...ADMIN, 'producer', 'editor', 'videomaker'],
  timeline2: [...ADMIN, 'producer', 'editor', 'videomaker', 'mvp'],
  social: [...ADMIN, 'editor', 'social_media', 'coordenador_comunicacao'],
  acervo: [...ADMIN, 'cedoc', 'editor', 'producer', 'reporter', 'journalist', 'mvp'],
  management: ADMIN,
  corp: [...ADMIN, 'producer', 'editor', 'cedoc', 'videomaker', 'reporter', 'journalist',
    'apresentador', 'locutor', 'sonoplasta', 'fotografo', 'motion_designer', 'cenografo',
    'roteirista', 'revisor', 'tradutor', 'social_media', 'coordenador_comunicacao',
    'juridico', 'ti_suporte', 'mvp'],
};

export function canAccessModule(role, moduleId) {
  if (role === 'mvp') {
    return ['home', 'corp', 'acervo', 'workspace2', 'timeline2'].includes(moduleId);
  }
  const allowed = MODULE_ROLES[moduleId];
  if (allowed === '*') return Boolean(role);
  return Boolean(role && allowed?.includes(role));
}
