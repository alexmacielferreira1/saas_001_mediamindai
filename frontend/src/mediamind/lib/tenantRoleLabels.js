// Nome amigável (pt-BR) dos papéis de membro da empresa (tenant_role do backend).
// Valores desconhecidos ou já amigáveis (ex.: dados de demonstração) são mantidos.
export const TENANT_ROLE_LABELS = {
  superadmin: 'Superadministrador', admin: 'Administrador', mvp: 'MVP', viewer: 'Visitante',
  producer: 'Produtor', editor: 'Editor', journalist: 'Jornalista', reporter: 'Repórter',
  produtor_reportagem: 'Produtor de reportagem', diretor_programa: 'Diretor de programa',
  estagiario: 'Estagiário', programacao: 'Programação', qualidade: 'Controle de qualidade',
  design: 'Design', assessoria: 'Assessoria de Imprensa', audiovisual: 'Audiovisual',
  revistas: 'Revistas', endomarketing: 'Endomarketing', documentacao: 'Documentação',
  gestao: 'Gestão', cedoc: 'Cedoc', apresentador: 'Apresentador', locutor: 'Locutor',
  sonoplasta: 'Sonoplasta', fotografo: 'Fotógrafo', motion_designer: 'Motion designer',
  cenografo: 'Cenógrafo', roteirista: 'Roteirista', revisor: 'Revisor', tradutor: 'Tradutor',
  social_media: 'Social media', videomaker: 'Videomaker', coordenador_comunicacao: 'Coordenação de comunicação',
  juridico: 'Jurídico', ti_suporte: 'TI / Suporte',
};

export function tenantRoleLabel(role) {
  if (!role) return '—';
  return TENANT_ROLE_LABELS[role] || role;
}
