export const SIMERS_PRESETS = Object.freeze({
  'Prontuário Jurídico': { background: '#A8D5E2', text: '#082447', accent: '#0066CC', defined: true },
  'Fronteiras da Saúde': { background: '#607354', text: '#FFFFFF', accent: '#D5E8B8', defined: true },
  'Sala de Prescrição': { background: '#B4CC00', text: '#003C35', accent: '#003C35', defined: true },
  Pediatrando: { background: '#B97E9A', text: '#FFFFFF', accent: '#530D32', defined: true },
  'Plantão do Rock': { background: '#EDC33D', text: '#10203D', accent: '#10203D', defined: true },
  'Ética na Mesa': { background: '#FAF8EF', text: '#073B3D', accent: '#188663', detail: '#C8E65B', defined: true },
  Anamnese: { background: '#122244', text: '#FFFFFF', accent: '#E5BE48', defined: true },
  'Solidariza+': { background: '#C4B4EF', text: '#1B1238', defined: true },
  'Corações e Mentes': { background: '#A11055', text: '#FFFFFF', defined: true },
  'No Front': { background: '#14AE72', text: '#FFFFFF', accent: '#063236', defined: true },
});

export const SIMERS_PROGRAMS = Object.freeze([
  'Prontuário Jurídico',
  'Fronteiras da Saúde',
  'Sala de Prescrição',
  'Pediatrando',
  'Plantão do Rock',
  'Ética na Mesa',
  'Anamnese',
  'Solidariza+',
  'Corações e Mentes',
  'No Front',
]);

export const DEFAULT_COLORS = Object.freeze({ background: '#202735', text: '#FFFFFF', accent: '#94A3B8' });

function person(name, role, presenter = false) {
  return {
    id: `${presenter ? 'presenter' : 'guest'}-${name}`,
    name,
    role: role || (presenter ? 'Apresentador(a)' : 'Convidado(a)'),
    visible: true,
    showName: !presenter,
    photo: '',
    source: 'MediaMind',
  };
}

export function createThumbnailDraft(project = {}) {
  const presenters = (project.apresentadores || [])
    .filter((item) => item?.nome)
    .map((item) => person(item.nome, item.cg, true));
  const guest = project.convidado_nome
    ? [person(project.convidado_nome, project.convidado_cg, false)]
    : [];
  const program = project.programa || project.program_name || '';
  const preset = SIMERS_PRESETS[program];
  return {
    projectId: project.id == null ? '' : String(project.id),
    program,
    episode: project.episodio || '',
    title: project.titulo || project.title || '',
    description: project.descricao || project.description || '',
    highlight: project.headline || '',
    planning: project.pauta || project.planning || '',
    people: [...presenters, ...guest],
    photos: [],
    colors: preset?.defined ? { ...DEFAULT_COLORS, ...preset } : { ...DEFAULT_COLORS },
  };
}

export function suggestHighlight({ title = '', description = '' } = {}) {
  const source = title.trim() || description.trim().split(/[.!?]/)[0];
  return source.slice(0, 72).trim().toUpperCase();
}

export function validateSimersDraft(draft) {
  const issues = [];
  if (!draft?.program?.trim()) issues.push('Selecione ou informe um programa.');
  if (!draft?.title?.trim()) issues.push('Informe o título principal.');
  return issues;
}

export function presetFor(program) {
  return SIMERS_PRESETS[program] || null;
}

export function formatEpisode(value = '') {
  const digits = String(value).match(/\d+/)?.[0];
  return digits ? `EP. ${digits.padStart(3, '0')}` : '';
}
