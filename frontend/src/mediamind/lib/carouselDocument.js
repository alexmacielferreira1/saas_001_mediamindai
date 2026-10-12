import { SOCIAL_FORMATS } from './socialFormats';

export const CAROUSEL_SCHEMA_VERSION = 1;

const FORMATS = new Set(SOCIAL_FORMATS.map((item) => item.id));
const TYPES = new Set(['cover', 'content', 'cta']);
const TYPE_ALIASES = { capa: 'cover', conteudo: 'content', conteúdo: 'content', cta: 'cta' };
const ROOT_FIELDS = new Set(['tema', 'title', 'slides', 'legenda', 'caption', 'hashtags']);
const SLIDE_FIELDS = new Set(['tipo', 'type', 'titulo', 'title', 'texto', 'body', 'badge', 'acao', 'action', 'imagem', 'image']);

function uid() {
  return globalThis.crypto?.randomUUID?.() || `carousel-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeHashtag(value) {
  const clean = String(value || '').trim().replace(/^#+/, '');
  return clean ? `#${clean}` : '';
}

function emphasisRuns(value) {
  const text = String(value || '');
  const runs = [];
  let position = 0;
  const pattern = /\*([^*]+)\*/g;
  for (const match of text.matchAll(pattern)) {
    if (match.index > position) runs.push({ text: text.slice(position, match.index), emphasis: false });
    runs.push({ text: match[1], emphasis: true });
    position = match.index + match[0].length;
  }
  if (position < text.length) runs.push({ text: text.slice(position), emphasis: false });
  return runs.length ? runs : [{ text, emphasis: false }];
}

export function createCarouselDocument(context = {}) {
  const project = context.project || null;
  const projectId = project?.id == null ? null : String(project.id);
  const projectTitle = project?.titulo || project?.title || '';
  return {
    id: uid(),
    schema_version: CAROUSEL_SCHEMA_VERSION,
    tool_type: 'carousel',
    project_id: projectId,
    title: projectTitle || 'Carrossel sem título',
    format: '4:5',
    template_id: 'institutional-dark',
    requested_slide_count: 8,
    briefing: {
      source: project ? 'project' : 'independent',
      audience: '',
      objective: '',
      tone: '',
    },
    slides: [],
    caption: '',
    hashtags: [],
    references: projectId ? [{ type: 'project', id: projectId, label: projectTitle || `Projeto ${projectId}` }] : [],
  };
}

function parseRoot(raw) {
  let parsed;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : structuredClone(raw);
  } catch {
    throw new Error('JSON inválido');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('JSON inválido');
  const unknown = Object.keys(parsed).find((field) => !ROOT_FIELDS.has(field));
  if (unknown) throw new Error(`Campo não reconhecido: ${unknown}`);
  if (!Array.isArray(parsed.slides)) throw new Error('Campo obrigatório ausente: slides');
  return parsed;
}

function normalizeSlide(slide) {
  if (!slide || typeof slide !== 'object' || Array.isArray(slide)) throw new Error('Slide inválido');
  const unknown = Object.keys(slide).find((field) => !SLIDE_FIELDS.has(field));
  if (unknown) throw new Error(`Campo de slide não reconhecido: ${unknown}`);
  const rawType = String(slide.tipo || slide.type || '').toLowerCase();
  const type = TYPE_ALIASES[rawType] || rawType;
  if (!TYPES.has(type)) throw new Error(`Tipo de slide não reconhecido: ${rawType}`);
  const title = String(slide.titulo ?? slide.title ?? '').trim();
  const body = String(slide.texto ?? slide.body ?? '').trim();
  return {
    id: uid(),
    type,
    title: title.replaceAll('*', ''),
    title_runs: emphasisRuns(title),
    body: body.replaceAll('*', ''),
    body_runs: emphasisRuns(body),
    badge: String(slide.badge || ''),
    action: String(slide.acao ?? slide.action ?? ''),
    image: slide.imagem ?? slide.image ?? null,
  };
}

export function parseCarouselImport(raw, current) {
  const parsed = parseRoot(raw);
  const slides = parsed.slides.map(normalizeSlide);
  const document = {
    ...structuredClone(current),
    title: String(parsed.tema ?? parsed.title ?? current.title).trim() || current.title,
    slides,
    caption: String(parsed.legenda ?? parsed.caption ?? ''),
    hashtags: (parsed.hashtags || []).map(normalizeHashtag).filter(Boolean),
  };
  const warnings = slides.length !== Number(current.requested_slide_count)
    ? [`Foram importados ${slides.length} slides; o briefing solicita ${current.requested_slide_count}.`]
    : [];
  return { document, warnings };
}

export function validateCarouselDocument(document) {
  const errors = [];
  if (!FORMATS.has(document?.format) && !/^custom:[^:]+:\d+x\d+$/.test(document?.format || '')) errors.push({ path: 'format', message: 'Formato de rede social não reconhecido.' });
  for (const [index, slide] of (document?.slides || []).entries()) {
    if (!TYPES.has(slide.type)) errors.push({ path: `slides[${index}].type`, message: 'Tipo de slide inválido.' });
    if (!String(slide.title || '').trim()) errors.push({ path: `slides[${index}].title`, message: 'Título do slide é obrigatório.' });
  }
  return errors;
}

export function reorderCarouselSlides(document, from, to) {
  const slides = document.slides.map((slide) => ({ ...slide }));
  if (from < 0 || from >= slides.length || to < 0 || to >= slides.length) return { ...document, slides };
  const [moved] = slides.splice(from, 1);
  slides.splice(to, 0, moved);
  return { ...document, slides };
}

function slug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export function carouselExportName(index, slide) {
  const number = String(index + 1).padStart(2, '0');
  if (slide.type === 'cover') return `${number}-capa.png`;
  if (slide.type === 'cta') return `${number}-cta.png`;
  return `${number}-${slug(slide.title) || 'slide'}.png`;
}
