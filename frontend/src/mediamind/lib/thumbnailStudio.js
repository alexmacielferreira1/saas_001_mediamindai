export const SIMERS_PRESETS = Object.freeze({
  'Prontuário Jurídico': { background: '#A8D5E2', text: '#082447', accent: '#0066CC', defined: true },
  'Fronteiras da Saúde': { background: '#607354', text: '#FFFFFF', accent: '#D5E8B8', defined: true },
  'Sala de Prescrição': { background: '#B4CC00', text: '#003C35', accent: '#003C35', defined: true },
  Pediatrando: { background: '#B97E9A', text: '#FFFFFF', accent: '#530D32', defined: true },
  'Plantão do Rock': { background: '#EDC33D', text: '#10203D', accent: '#10203D', defined: true },
  'Ética na Mesa': { background: '#FAF8EF', text: '#073B3D', accent: '#188663', detail: '#C8E65B', defined: true },
  Anamnese: { background: '#122244', text: '#FFFFFF', accent: '#E5BE48', defined: true },
  'Solidariza+': { background: '#C4B4EF', text: '#1B1238', defined: true },
  'Em Debate': { background: '#202735', text: '#FFFFFF', accent: '#94A3B8', defined: false },
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
  'Em Debate',
]);

export const DEFAULT_COLORS = Object.freeze({ background: '#202735', text: '#FFFFFF', accent: '#94A3B8' });

export const PROGRAM_LOGOS = Object.freeze({
  'Prontuário Jurídico': '/brand/programs/Prontuario_Juridico.png',
  'Fronteiras da Saúde': '/brand/programs/Fronteiras_da_Saude.png',
  'Sala de Prescrição': '/brand/programs/Sala_de_Prescricao.png',
  'Plantão do Rock': '/brand/programs/Plantao_do_Rock.png',
  Anamnese: '/brand/programs/Anamnese.png',
  'Solidariza+': '/brand/programs/SOLIDARIZA.png',
  'Corações e Mentes': '/brand/programs/Coracoes_e_Mentes.png',
  'No Front': '/brand/programs/No_Front.png',
  'Em Debate': '/brand/programs/Em_Debate.png',
});
export const THUMBNAIL_FONTS = ['Anton', 'Montserrat', 'Archivo Black', 'Arial', 'Georgia'];
export const DEFAULT_STYLE = Object.freeze({
  headlineFont: 'Anton', bodyFont: 'Montserrat', fontScale: 1,
  lineHeight: 0.98, letterSpacing: 0, grayscale: true,
  outline: 4, outlineColor: '#FFFFFF', shadow: 12,
  shadowOpacity: 0.28, shadowX: 0, shadowY: 10, waveOpacity: 0.14,
});

export function normalizePerson(item, presenter = false) {
  const raw = typeof item === 'string' ? { nome: item } : (item || {});
  const name = raw.name || raw.nome || raw.full_name || '';
  return {
    ...raw, id: String(raw.id || `${presenter ? 'presenter' : 'guest'}-${name}`),
    name, role: raw.role || raw.papel || raw.cg || (presenter ? 'Apresentador(a)' : 'Entrevistado(a)'),
    visible: raw.visible ?? true, showName: raw.showName ?? !presenter,
    photo: raw.photo || raw.foto_url || raw.photo_url || '', source: raw.source || 'MediaMind',
  };
}

export function projectPeople(project = {}) {
  const guests = [ ...(project.convidados || []), ...(project.entrevistados || []), ...(project.participantes || []) ];
  if (project.convidado_nome) guests.push({ nome: project.convidado_nome, cg: project.convidado_cg });
  const result = [...(project.apresentadores || []).map((p) => normalizePerson(p, true)), ...guests.map((p) => normalizePerson(p))];
  const seen = new Set();
  return result.filter((p) => { const key = p.name.trim().toLocaleLowerCase(); if (!key || seen.has(key)) return false; seen.add(key); return true; });
}

export function createThumbnailDraft(project = {}) {
  const program = project.programa || project.program_name || '';
  const preset = SIMERS_PRESETS[program];
  return {
    projectId: project.id == null ? '' : String(project._entityId || project.id),
    projectEntity: project._entityType || 'ProducaoProjeto',
    program, episode: project.episodio || '',
    title: project.titulo || project.title || '',
    description: project.descricao || project.description || '',
    highlight: project.headline || project.titulo || project.title || '',
    planning: project.pauta || project.planning || '',
    people: projectPeople(project), photos: [],
    colors: preset?.defined ? { ...DEFAULT_COLORS, ...preset } : { ...DEFAULT_COLORS },
    style: { ...DEFAULT_STYLE, ...(project.thumbnail_style || {}) }, layouts: {},
    channelLogo: project.thumbnail_channel_logo || '/brand/canal-simers-white.png',
    programLogo: PROGRAM_LOGOS[program] || '',
  };
}

export function restoreThumbnailStyle(draft, format) {
  return { ...draft, style: { ...DEFAULT_STYLE }, colors: { ...DEFAULT_COLORS, ...presetFor(draft.program) },
    layouts: format ? { ...draft.layouts, [format]: {} } : {},
    people: draft.people.map((p) => ({ ...p, zoom: 1, offsetX: 0, offsetY: 0, framing: 'portrait', flip: false })),
  };
}

export function suggestHighlight({ title = '', description = '' } = {}) {
  const source = title.trim() || description.trim().split(/[.!?]/)[0];
  return source.slice(0, 72).trim().toUpperCase();
}

export function validateSimersDraft(draft) {
  const issues = [];
  if (!draft?.program?.trim()) issues.push('Selecione ou informe um programa.');
  if (!(draft?.highlight || draft?.title)?.trim()) issues.push('Informe a chamada da thumb.');
  return issues;
}

export function presetFor(program) {
  return SIMERS_PRESETS[program] || null;
}

export function formatEpisode(value = '') {
  const digits = String(value).match(/\d+/)?.[0];
  return digits ? `EP. ${digits.padStart(3, '0')}` : '';
}
