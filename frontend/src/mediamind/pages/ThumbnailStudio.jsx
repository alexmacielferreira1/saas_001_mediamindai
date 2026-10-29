import { useWorkDraftState } from "../lib/workProtection";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BookOpen, CheckCircle2, Download, ImagePlus, Info, Layers3, Plus, Save, Upload, UserPlus, X,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { listMediaAssets, uploadMediaAsset, resolveMediaUrl } from '@/api/media';
import { useProducaoProjetos, mergePersistedProject } from '../lib/producaoStore';
import {
  DEFAULT_COLORS, SIMERS_PRESETS, SIMERS_PROGRAMS, createThumbnailDraft, presetFor, validateSimersDraft, normalizePerson, projectPeople, PROGRAM_LOGOS, restoreThumbnailStyle, personNameFromFilename,
} from '../lib/thumbnailStudio';
import { exportThumbnailElement, thumbnailBlob } from '../lib/thumbnailExport';
import { saveExportToLibrary, savedNote } from '../lib/exportSaved';
import { createLocalCutout } from '../lib/thumbnailImage';
import { thumbnailLayers } from '../lib/thumbnailRenderer';
import ThumbnailCanvas from '../components/thumbnails/ThumbnailCanvas';
import ThumbnailTools from '../components/thumbnails/ThumbnailTools';
import ThumbnailAISettings from '../components/thumbnails/ThumbnailAISettings';
import CarouselStudio from '../components/carousel/CarouselStudio';
import { listSavedThumbnails, saveThumbnailVersion, markProjectThumbnail } from '../lib/thumbnailPersistence';
import { generateImage, getImageGenerationStatus } from '@/api/generation';

const TABS = ['Padrão SIMERS', 'Criação Livre', 'Usar Referência', 'Meus modelos', 'Outros'];
const DARK_THUMB_FORMATS = [
  { id: 'youtube', label: 'YouTube · Thumbnail', width: 1280, height: 720 },
  { id: 'youtube-shorts', label: 'YouTube Shorts · Capa', width: 1080, height: 1920 },
  { id: 'tiktok', label: 'TikTok · Capa vertical', width: 1080, height: 1920 },
  { id: 'instagram-reels', label: 'Instagram Reels · Capa', width: 1080, height: 1920 },
  { id: 'instagram-feed', label: 'Instagram · Retrato 4:5', width: 1080, height: 1350 },
  { id: 'instagram-square', label: 'Instagram · Quadrado', width: 1080, height: 1080 },
  { id: 'facebook', label: 'Facebook · Vídeo / link', width: 1200, height: 630 },
  { id: 'linkedin', label: 'LinkedIn · Compartilhamento', width: 1200, height: 627 },
];
function validThumbDimensions(width, height) {
  return Number.isInteger(width) && Number.isInteger(height)
    && width >= 64 && height >= 64 && width <= 7680 && height <= 7680
    && width * height <= 20_000_000;
}
const SIMERS_MODEL_CATEGORIES = [
  { id: 'thumbs', label: 'Thumbs' },
  { id: 'single', label: 'Artes individuais' },
  { id: 'carousel', label: 'Carrosséis' },
];
const SINGLE_ART_MODELS = [
  { name: 'Lima institucional', image: 1, title: 'Médicos aprovam Convenção Coletiva de Trabalho com o Sindiberf', description: '', colors: { background: '#E3FF91', text: '#073B3B', accent: '#073B3B' } },
  { name: 'Turquesa institucional', image: 2, title: 'Simers se reúne com diretoria do Hospital Estrela para tratar do atendimento psiquiátrico', description: '', colors: { background: '#62D7C4', text: '#071B45', accent: '#071B45' } },
  { name: 'Lima escuro', image: 3, title: 'Nova Santa Rita: equipe do Simers faz visita a unidades de saúde', description: '', colors: { background: '#063B36', text: '#E3FF91', accent: '#E3FF91' } },
  { name: 'Verde profundo', image: 5, title: 'Canoas: Simers visita HNSG e se atualiza sobre avanço das reformas', description: '', colors: { background: '#00483F', text: '#00BD78', accent: '#00BD78' } },
  { name: 'Verde notícia', image: 6, title: 'Eleição tem 20 médicos candidatos à Câmara dos Deputados e à Assembleia Legislativa', description: '', colors: { background: '#063B36', text: '#DDFF86', accent: '#DDFF86' } },
];
const CAROUSEL_MODELS = [
  { name: 'Giro da Semana', image: '/reference/giro-semana-capa.png', source: '/reference/giro-semana-capa.png', title: 'Giro de notícias da semana', description: '03 a 09 de outubro', colors: { background: '#003B3B', text: '#FFFBEA', accent: '#00BD78' } },
  { name: 'Saúde em ondas', image: '/reference/carousel-saude-capa.png', source: '/reference/carousel-saude-capa.png', title: 'Saúde mental merece atenção', description: 'Cuidar da mente também é cuidar da sua vida.', colors: { background: '#F7F3E8', text: '#073B3D', accent: '#008B8B' } },
];

function Field({ label, children }) {
  return <div className="block text-xs font-bold text-slate-300"><span className="mb-1.5 block">{label}</span>{children}</div>;
}

const control = 'w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-sky-400';

function fileUrl(file) {
  return file ? URL.createObjectURL(file) : '';
}

function createThumbSession(project, program) {
  const draft = createThumbnailDraft(program ? { programa: program } : (project || {}));
  draft.pieceType = (project || program) ? 'thumb' : 'blank';
  return {
    id: `thumb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    draft,
    tab: TABS[0],
    formats: { horizontal: true, vertical: true },
    manualCreation: Boolean(program),
    referenceUrl: '',
    orientation: '',
    targetChannels: ['youtube'],
    platformFormat: 'youtube',
    customWidth: 1280,
    customHeight: 720,
    expanded: true,
  };
}

export default function ThumbnailStudio(props = {}) {
  return props.darkChannelId
    ? <ThumbnailStudioEditor {...props} productionProjects={[]} />
    : <MediaMindThumbnailStudio {...props} />;
}

function MediaMindThumbnailStudio(props) {
  const productionProjects = useProducaoProjetos();
  return <ThumbnailStudioEditor {...props} productionProjects={productionProjects} />;
}

function ThumbnailStudioEditor({ darkChannelId = "", darkScriptId = "", workspaceKey = "", initialTitle = "", initialChannelName = "", thumbnailContext = {}, productionProjects = [] } = {}) {
  const darkChannelMode = Boolean(darkChannelId);
  const draftKey = (key) => workspaceKey ? `${workspaceKey}:${key}` : `pages/ThumbnailStudio.jsx:${key}`;
  const [searchParams] = useSearchParams();
  const [personCatalog, setPersonCatalog] = useState([]);
  const [personSearch, setPersonSearch] = useState('');
  const [savedThumbs, setSavedThumbs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editFormat, setEditFormat] = useWorkDraftState(draftKey("editFormat"), 'horizontal');
  const [showGuides, setShowGuides] = useWorkDraftState(draftKey("showGuides"), true);
  const [selectedLayer, setSelectedLayer] = useWorkDraftState(draftKey("selectedLayer"), '');
  const history = useRef(new Map());
  const redoHistory = useRef(new Map());
  const photoVersions = useRef(new Map());
  const [targetPerson, setTargetPerson] = useWorkDraftState(draftKey("targetPerson"), '');
  const [catalogProjects, setCatalogProjects] = useState([]);
  const [scripts, setScripts] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const projects = useMemo(() => {
    if (darkChannelMode) return [];
    const seen = new Set();
    return [...productionProjects, ...catalogProjects].filter((item) => {
      const id = String(item.id ?? item._entityId ?? '');
      if (!id || seen.has(id) || !(item.titulo || item.title)) return false;
      seen.add(id);
      return true;
    }).map((p) => ({ ...p, id: p._entityId || p.id }));
  }, [darkChannelMode, productionProjects, catalogProjects]);
  const projectKey = useMemo(() => projects.map((project) => String(project.id)).join('|'), [projects]);
  const [thumbs, setThumbs] = useWorkDraftState(draftKey("thumbs"), () => {
    const first = createThumbSession(darkChannelMode ? null : productionProjects[0]);
    if (darkChannelMode) {
      first.tab = 'Criação';
      first.manualCreation = true;
      first.draft.pieceType = 'thumb';
      first.draft.brandMode = 'dark';
      first.draft.channelName = initialChannelName;
      first.draft.channelLogo = '';
      first.draft.programLogo = '';
      first.draft.program = '';
      first.draft.episode = '';
      first.draft.colors = { background: '#101827', text: '#FFFFFF', accent: '#22D3EE' };
      first.draft.title = initialTitle;
      first.draft.highlight = initialTitle;
    }
    return [first];
  });
  const [activeId, setActiveId] = useWorkDraftState(draftKey("activeId"), () => null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [modesOpen, setModesOpen] = useState(true);
  const [modelCategory, setModelCategory] = useState('thumbs');
  const [customCategories, setCustomCategories] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mm-simers-art-categories') || '[]'); } catch { return []; }
  });
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState('');
  const [imagePrompt, setImagePrompt] = useWorkDraftState(draftKey('darkImagePrompt'), '');
  const [selectedContextIds, setSelectedContextIds] = useWorkDraftState(draftKey('selectedThumbnailContext'), []);
  const [imageProvider, setImageProvider] = useState({ configured: false, loading: false });
  const [generatingImage, setGeneratingImage] = useState(false);
  const horizontalRef = useRef(null);
  const verticalRef = useRef(null);
  const darkPreviewRef = useRef(null);
  const activeThumb = thumbs.find((item) => item.id === activeId) || thumbs.find((item) => item.expanded) || thumbs[0];
  const draft = activeThumb?.draft || createThumbnailDraft();
  const tab = activeThumb?.tab || TABS[0];
  const formats = activeThumb?.formats || { horizontal: true, vertical: true };
  const manualCreation = activeThumb?.manualCreation || false;
  const referenceUrl = activeThumb?.referenceUrl || '';
  const orientation = activeThumb?.orientation || '';
  const targetChannels = activeThumb?.targetChannels || ['youtube'];
  const platformFormat = activeThumb?.platformFormat || 'youtube';
  const selectedOutputFormat = DARK_THUMB_FORMATS.find((item) => item.id === platformFormat);
  const outputWidth = selectedOutputFormat?.width ?? Number(activeThumb?.customWidth ?? 1280);
  const outputHeight = selectedOutputFormat?.height ?? Number(activeThumb?.customHeight ?? 720);
  const darkOutputValid = validThumbDimensions(outputWidth, outputHeight);
  const darkFormat = outputWidth / outputHeight < 0.9 ? 'vertical' : 'horizontal';
  const visibleTabs = darkChannelMode ? ['Criação'] : TABS;
  const darkContextItems = useMemo(() => {
    if (!darkChannelMode) return [];
    const channel = thumbnailContext.channel || {};
    const selectedScript = thumbnailContext.selectedScript;
    const scripts = thumbnailContext.scripts || [];
    const materials = [...(selectedScript?.materials || []), ...(thumbnailContext.materials || [])];
    return [
      { id: 'channel', label: 'Perfil do canal', text: [channel.name, channel.niche && `Nicho: ${channel.niche}`, channel.audience && `Público: ${channel.audience}`, channel.language && `Idioma: ${channel.language}`, channel.format && `Formato: ${channel.format}`, (thumbnailContext.folders || []).length && `Pastas: ${thumbnailContext.folders.join(', ')}`].filter(Boolean).join('\n') },
      selectedScript && { id: 'script', label: 'Roteiro atual', text: [selectedScript.title, selectedScript.topic, selectedScript.script].filter(Boolean).join('\n').slice(0, 8000) },
      scripts.length > 1 && { id: 'other-scripts', label: 'Outros roteiros do canal', text: scripts.filter((item) => item.title !== selectedScript?.title).map((item) => [item.title, item.topic, item.script].filter(Boolean).join('\n')).join('\n\n').slice(0, 6000) },
      materials.length > 0 && { id: 'materials', label: 'Materiais organizados', text: materials.map((item) => [item.title, item.kind, item.reference].filter(Boolean).join(' · ')).join('\n').slice(0, 4000) },
    ].filter((item) => item?.text);
  }, [darkChannelMode, thumbnailContext]);

  useEffect(() => {
    if (!darkChannelMode) return undefined;
    let live = true;
    setImageProvider({ configured: false, loading: true });
    getImageGenerationStatus().then((status) => {
      if (live) setImageProvider({ ...status, loading: false });
    }).catch(() => { if (live) setImageProvider({ configured: false, loading: false }); });
    return () => { live = false; };
  }, [darkChannelMode]);

  useEffect(() => {
    if (!darkChannelMode || !activeThumb || !darkScriptId) return;
    if (activeThumb.draft.sourceScriptId === darkScriptId) return;
    setThumbs((items) => items.map((item) => item.id === activeThumb.id ? {
      ...item,
      manualCreation: true,
      tab: 'Criação Livre',
      draft: { ...item.draft, projectId: '', program: '', pieceType: 'thumb', title: initialTitle, highlight: initialTitle, sourceScriptId: darkScriptId },
    } : item));
  }, [darkChannelMode, darkScriptId, initialTitle, activeThumb, setThumbs]);

  useEffect(() => {
    if (!darkChannelMode) return;
    setThumbs((items) => items.map((item) => item.draft.brandMode === 'dark'
      && item.draft.channelName === initialChannelName && !item.draft.program && !item.draft.episode && !item.draft.channelLogo
      ? (['Criação Livre', 'Usar Referência'].includes(item.tab) ? { ...item, tab: 'Criação' } : item)
      : { ...item, tab: ['Criação Livre', 'Usar Referência'].includes(item.tab) ? 'Criação' : item.tab, draft: { ...item.draft, brandMode: 'dark', channelName: initialChannelName, channelLogo: '', programLogo: '', program: '', episode: '', colors: item.draft.brandMode === 'dark' ? item.draft.colors : { background: '#101827', text: '#FFFFFF', accent: '#22D3EE' } } }));
  }, [darkChannelMode, initialChannelName, setThumbs]);

  function updateActive(patch) {
    if (!activeThumb) return;
    setThumbs((items) => items.map((item) => item.id === activeThumb.id ? { ...item, ...patch } : item));
  }

  function setDraft(value) {
    if (!activeThumb) return;
    const targetId = activeThumb.id;
    setThumbs((items) => items.map((item) => item.id === targetId
      ? (() => {
        const stack = history.current.get(targetId) || [];
        history.current.set(targetId, [...stack.slice(-79), item.draft]); redoHistory.current.set(targetId, []);
        return { ...item, draft: typeof value === 'function' ? value(item.draft) : value };
      })() : item));
  }

  function setTab(value) { updateActive({ tab: value }); }
  function setFormats(value) {
    if (!activeThumb) return;
    const targetId = activeThumb.id;
    setThumbs((items) => items.map((item) => item.id === targetId
      ? { ...item, formats: typeof value === 'function' ? value(item.formats) : value }
      : item));
  }
  function setManualCreation(value) { updateActive({ manualCreation: value }); }
  function setReferenceUrl(value) { updateActive({ referenceUrl: value }); }
  function setOrientation(value) { updateActive({ orientation: value }); }
  function setTargetChannels(value) { updateActive({ targetChannels: value }); }
  function chooseDarkFormat(value) {
    updateActive({ platformFormat: value });
    const preset = DARK_THUMB_FORMATS.find((item) => item.id === value);
    const width = preset?.width ?? Number(activeThumb?.customWidth ?? 1280);
    const height = preset?.height ?? Number(activeThumb?.customHeight ?? 720);
    setEditFormat(width / height < 0.9 ? 'vertical' : 'horizontal');
  }

  async function generateDarkImage() {
    if (!imagePrompt.trim() || !imageProvider.configured || generatingImage) return;
    setGeneratingImage(true); setNotice('');
    try {
      const result = await generateImage({ prompt: imagePrompt.trim(), aspect: editFormat === 'vertical' ? '9:16' : '16:9', count: 1 });
      const imageUrl = result.images?.[0]?.url;
      if (!imageUrl) throw new Error('O provedor não retornou uma imagem.');
      const id = `ai-image-${Date.now()}`;
      setDraft((current) => ({ ...current, people: [...current.people, { id, name: 'Imagem gerada por IA', role: '', visible: true, showName: false, photo: imageUrl, originalPhoto: imageUrl, useOriginal: true, source: 'IA' }] }));
      setNotice('Imagem gerada e adicionada à composição. Você pode movê-la e redimensioná-la na prévia.');
    } catch (error) { setNotice(error.message || 'Não foi possível gerar a imagem.'); }
    finally { setGeneratingImage(false); }
  }

  function addSelectedContextToPrompt() {
    const selected = darkContextItems.filter((item) => selectedContextIds.includes(item.id));
    if (!selected.length) return;
    const context = selected.map((item) => `### ${item.label}\n${item.text}`).join('\n\n');
    setImagePrompt((current) => [current.trim(), context].filter(Boolean).join('\n\n'));
    setNotice('O contexto marcado foi acrescentado ao prompt. Revise o texto antes de gerar.');
  }

  function applyCreativeModel(model, category) {
    const targetType = category === 'Carrossel' ? 'carousel' : 'single';
    if (targetType === 'carousel') {
      const template = model.name === 'Giro da Semana' ? 'giro' : 'health';
      updateActive({ artTemplate: template });
      setDraft((current) => ({
        ...current,
        pieceType: 'carousel',
        modelName: model.name,
        modelCategory: category,
        title: model.title,
        highlight: model.title,
      }));
      setNotice(`${model.name} aberto neste trabalho.`);
      return;
    }
    updateActive({ artTemplate: '' });
    setDraft((current) => ({
      ...(current.pieceType === targetType ? current : createThumbnailDraft()),
      pieceType: targetType,
      program: '',
      programLogo: '',
      modelName: model.name,
      modelCategory: category,
      modelColors: { ...model.colors },
      colors: { ...DEFAULT_COLORS, ...model.colors },
      title: model.title || '',
      highlight: model.title || '',
      description: model.description || '',
      artReferenceUrl: targetType === 'single' ? `/reference/arte-unica-${model.image}.png` : model.source || model.image || '',
      layouts: {},
    }));
    setFormats(category === 'Carrossel' ? { horizontal: false, vertical: true } : { horizontal: false, vertical: true });
    setEditFormat('vertical');
    setNotice(`${model.name} aplicado. Todos os elementos continuam editáveis.`);
  }

  function addModelCategory() {
    const name = categoryName.trim();
    if (!name) return;
    const item = { id: `custom-${Date.now()}`, label: name };
    const next = [...customCategories, item];
    setCustomCategories(next);
    localStorage.setItem('mm-simers-art-categories', JSON.stringify(next));
    setModelCategory(item.id); setCategoryName(''); setAddingCategory(false);
  }

  function restoreCurrentPattern() {
    setDraft((current) => current.modelColors
      ? { ...restoreThumbnailStyle(current), colors: { ...current.colors, ...current.modelColors }, layouts: {} }
      : restoreThumbnailStyle(current));
    setNotice('Padrão original restaurado.');
  }

  useEffect(() => {
    if (darkChannelMode) {
      setLoading(false);
      setCatalogProjects([]); setScripts([]); setAssets([]); setPersonCatalog([]); setSavedThumbs([]);
      return () => {};
    }
    let live = true;
    Promise.allSettled([
      base44.entities.ProducaoProjeto.list('-created_date', 500),
      base44.entities.Script.list('-created_date', 200),
      listMediaAssets(),
      base44.entities.Person.list('-created_date', 500),
      listSavedThumbnails(),
    ]).then((results) => {
      if (!live) return;
      const value = (i) => results[i].status === 'fulfilled' && Array.isArray(results[i].value) ? results[i].value : [];
      setCatalogProjects(value(0)); setScripts(value(1));
      setAssets(value(2).map((asset) => ({ ...asset, stream_url: resolveMediaUrl(asset.stream_url || asset.file_url) })));
      setPersonCatalog(value(3).map((p) => normalizePerson(p)));
      setSavedThumbs(value(4));
      const requested = value(4).find((r) => r.id === searchParams.get('thumb'));
      if (requested?.content?.draft) openSaved(requested);
      const failed = results.map((r, i) => r.status === 'rejected' ? ['projetos', 'roteiros', 'acervo', 'pessoas', 'thumbs salvas'][i] : null).filter(Boolean);
      if (failed.length) setDataError(`Não foi possível carregar: ${failed.join(', ')}. Verifique sua sessão e permissões.`);
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [darkChannelMode]);

  useEffect(() => {
    if (!manualCreation && projects[0] && (!draft.projectId || !projects.some((project) => String(project.id) === draft.projectId))) {
      const requestedProject = projects.find((p) => String(p.id) === (searchParams.get('project') || searchParams.get('project_id')));
      const sameTitle = projects.find((project) => (project.titulo || project.title) === draft.title);
      selectProject(String((requestedProject || sameTitle || projects[0]).id));
    }
  }, [projectKey, manualCreation]);

  const selectedProject = projects.find((project) => String(project.id) === draft.projectId);
  const matchingScript = scripts.find((script) => String(script.project_id || script.projectId || '') === draft.projectId
    || (script.title && selectedProject?.titulo && script.title === selectedProject.titulo));
  const relatedAssets = assets.filter((asset) => {
    if (asset.asset_type !== 'image') return false;
    const assetProject = String(asset.project_id || asset.projectId || '');
    return !assetProject || assetProject === draft.projectId;
  });
  const preset = presetFor(draft.program);
  const validation = draft.pieceType === 'thumb' || draft.program
    ? validateSimersDraft(draft)
    : draft.pieceType !== 'blank' && !(draft.highlight || draft.title || '').trim()
      ? ['Informe a chamada da arte.']
      : [];
  const modelDrafts = useMemo(() => Object.fromEntries(SIMERS_PROGRAMS.map((name) => {
    const item = createThumbnailDraft({ programa: name, titulo: name === 'Anamnese' ? 'CIÊNCIA, ENSINO E INOVAÇÃO' : 'NOVA CHAMADA DO PROGRAMA', episodio: 'EP. 000' });
    return [name, { ...item, highlight: item.title || 'NOVA CHAMADA DO PROGRAMA' }];
  })), []);

  function selectProject(projectId) {
    if (!projectId) {
      setDraft((current) => ({ ...current, projectId: '', people: [], photos: [] }));
      setManualCreation(true);
      return;
    }
    const project = projects.find((item) => String(item.id) === String(projectId));
    if (activeThumb?.sourceDocumentId) {
      setDraft((current) => ({ ...current, projectId: String(projectId), projectEntity: 'ProducaoProjeto' }));
      setManualCreation(false); return;
    }
    const next = createThumbnailDraft(project || {});
    const projectAssets = assets.filter((asset) => asset.asset_type === 'image' && (!asset.project_id || String(asset.project_id) === String(projectId)));
    next.photos = projectAssets.map((asset, index) => ({ id: String(asset.id), name: asset.title || asset.filename || 'Imagem do acervo', url: resolveMediaUrl(asset.stream_url || asset.file_url || ''), selected: index === 0, source: 'Acervo' }));
    setDraft(next);
    setManualCreation(false);
  }

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updatePerson(id, patch) {
    setDraft((current) => ({ ...current, people: current.people.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  }

  function addManualPerson() {
    const id = `manual-${Date.now()}`;
    setDraft((current) => ({ ...current, people: [...current.people, { id, name: 'Nova pessoa', role: 'Entrevistado(a)', visible: true, showName: true, photo: '', source: 'Manual' }] }));
  }

  async function addPersonFromPhoto(file) {
    if (targetPerson) { await replacePersonPhoto(targetPerson, file); return; }
    if (!file) return;
    const id = `manual-photo-${Date.now()}`;
    const name = personNameFromFilename(file.name);
    const originalPhoto = fileUrl(file);
    setDraft((current) => ({
      ...current,
      people: [...current.people, {
        id, name, role: '', visible: true, showName: true, photo: originalPhoto, originalPhoto, cutoutStatus: 'processing', source: 'Upload local',
      }],
    }));
    const token = Symbol(); photoVersions.current.set(id, token);
    try {
      const photo = await createLocalCutout(file);
      if (photoVersions.current.get(id) !== token) return;
      updatePerson(id, { photo, cutoutPhoto: photo, cutoutStatus: 'done', useOriginal: false });
    } catch (e) {
      if (photoVersions.current.get(id) !== token) return;
      updatePerson(id, { photo: originalPhoto, cutoutStatus: 'failed', cutoutError: e.message });
    }
  }

  async function replacePersonPhoto(id, file) {
    if (!file) return;
    const originalPhoto = fileUrl(file);
    updatePerson(id, { photo: originalPhoto, originalPhoto, cutoutStatus: 'processing', useOriginal: true });
    const token = Symbol(); photoVersions.current.set(id, token);
    try {
      const cutoutPhoto = await createLocalCutout(file);
      if (photoVersions.current.get(id) !== token) return;
      updatePerson(id, { photo: cutoutPhoto, cutoutPhoto, cutoutStatus: 'done', useOriginal: false });
    } catch (e) {
      if (photoVersions.current.get(id) !== token) return;
      updatePerson(id, { photo: originalPhoto, cutoutStatus: 'failed', useOriginal: true, cutoutError: e.message });
    }
  }

  function addPhoto(file) {
    if (!file) return;
    addPersonFromPhoto(file);
    const url = fileUrl(file);
    setDraft((current) => ({ ...current, photos: [...current.photos.map((photo) => ({ ...photo, selected: false })), { id: `upload-${Date.now()}`, name: file.name, url, selected: true, source: 'Upload local' }] }));
  }

  function applyProgram(program) {
    const colors = presetFor(program);
    updateActive({ artTemplate: '' });
    setDraft((current) => ({ ...(current.pieceType === 'thumb' ? current : createThumbnailDraft()), pieceType: 'thumb', program, modelName: '', modelCategory: 'Thumb', modelColors: null, programLogo: PROGRAM_LOGOS[program] || '', colors: colors?.defined ? { ...DEFAULT_COLORS, ...colors } : { ...DEFAULT_COLORS } }));
    setFormats({ horizontal: true, vertical: true });
    setEditFormat('horizontal');
    setSelectedLayer('');
  }

  function startNewThumb(program, creationTab = TABS[0]) {
    const next = createThumbSession(null, darkChannelMode ? '' : program);
    if (darkChannelMode) {
      creationTab = 'Criação';
      next.manualCreation = true;
      next.draft.pieceType = 'thumb';
      next.draft.brandMode = 'dark';
      next.draft.channelName = initialChannelName;
      next.draft.channelLogo = '';
      next.draft.programLogo = '';
      next.draft.program = '';
      next.draft.episode = '';
      next.draft.colors = { background: '#101827', text: '#FFFFFF', accent: '#22D3EE' };
      next.draft.title = initialTitle;
      next.draft.highlight = initialTitle;
      next.draft.sourceScriptId = darkScriptId;
    }
    next.tab = creationTab;
    setThumbs((items) => [...items.map((item) => ({ ...item, expanded: false })), next]);
    setActiveId(next.id);
    setNotice('');
  }

  function toggleThumb(id) {
    setThumbs((items) => items.map((item) => ({ ...item, expanded: item.id === id })));
    setActiveId(id);
    setNotice('');
  }

  const sourceProjects = manualCreation && draft.program
    ? projects.filter((project) => !project.programa || project.programa === draft.program)
    : projects;

  const allPeople = useMemo(() => {
    const people = [...personCatalog, ...projects.flatMap(projectPeople)]; const seen = new Set();
    return people.filter((p) => { const key = p.name.trim().toLocaleLowerCase(); if (!key || seen.has(key)) return false; seen.add(key); return true; });
  }, [personCatalog, projects]);

  function choosePerson(person) {
    if (draft.people.some((p) => p.name.toLocaleLowerCase() === person.name.toLocaleLowerCase())) return;
    setDraft((current) => ({ ...current, people: [...current.people, { ...person, visible: true, showName: true }] }));
    setPersonSearch('');
  }
  async function registerPerson(person) {
    try {
      const record = await base44.entities.Person.create({ name: person.name, role: person.role });
      setPersonCatalog((items) => [...items, normalizePerson(record)]); updatePerson(person.id, { catalogId: record.id });
      setNotice('Pessoa cadastrada. O nome de exibição da thumb continua editável.');
    } catch (e) { setNotice(e.message); }
  }
  async function applyAssetPhoto(photo) {
    try {
      const response = await fetch(resolveMediaUrl(photo.url), { credentials: 'include' });
      if (!response.ok) throw new Error('Foto indisponível no acervo.');
      const blob = await response.blob();
      await addPersonFromPhoto(new File([blob], `${photo.name}.png`, { type: blob.type }));
    } catch (e) { setNotice(e.message); }
  }
  async function retryPhoto(person) {
    try {
      const response = await fetch(resolveMediaUrl(person.originalPhoto), { credentials: 'include' });
      if (!response.ok) throw new Error('Foto original indisponível.');
      const blob = await response.blob(); await replacePersonPhoto(person.id, new File([blob], 'portrait.png', { type: blob.type }));
    } catch (e) { setNotice(e.message); }
  }
  function changeLayout(format, id, patch) {
    setDraft((current) => { const layout = { ...current.layouts?.[format] }; if (patch === null) delete layout[id]; else layout[id] = { ...layout[id], ...patch }; return { ...current, layouts: { ...current.layouts, [format]: layout } }; });
  }
  function undo(redo = false) {
    if (!activeThumb) return;
    const from = (redo ? redoHistory : history).current; const to = (redo ? history : redoHistory).current;
    const stack = from.get(activeThumb.id) || []; if (!stack.length) return;
    const previous = stack.pop(); from.set(activeThumb.id, stack); to.set(activeThumb.id, [...(to.get(activeThumb.id) || []), draft]);
    setThumbs((items) => items.map((item) => item.id === activeThumb.id ? { ...item, draft: previous } : item));
  }
  function openSaved(record, copy = false) {
    if (!record.content?.draft) return;
    const next = { ...record.content, draft: { ...record.content.draft }, id: copy ? `thumb-${crypto.randomUUID()}` : `saved-${record.id}`,
      savedId: copy ? null : record.id, sourceDocumentId: copy ? record.id : record.source_document_id,
      revision: copy ? 0 : record.revision, expanded: true };
    if (copy) next.draft.projectId = '';
    next.manualCreation = !next.draft.projectId;
    setThumbs((items) => [...items.filter((i) => i.id !== next.id).map((i) => ({ ...i, expanded: false })), next]);
    setActiveId(next.id); setNotice(copy ? 'Cópia criada. Escolha o projeto de destino antes de salvar.' : 'Versão salva reaberta.');
  }
  async function saveProjectStyle() {
    try {
      if (!draft.projectId) return;
      const saved = await base44.entities.ProducaoProjeto.update(draft.projectId, { thumbnail_style: draft.style, thumbnail_channel_logo: draft.channelLogo?.startsWith('blob:') ? undefined : draft.channelLogo });
      mergePersistedProject(draft.projectId, { thumbnail_style: draft.style, ...(saved?.updated_date ? { _updatedDate: saved.updated_date } : {}) });
      setNotice('Fontes e efeitos definidos como padrão do projeto.');
    } catch (e) { setNotice(e.message); }
  }
  async function saveThumb(withImages = false, asCover = false) {
    if (darkChannelMode) {
      if (withImages) {
        await exportSelected();
        return;
      }
      setThumbs((items) => items.map((item) => item.id === activeThumb.id ? { ...item, revision: (item.revision || 0) + 1, updatedAt: new Date().toISOString() } : item));
      setNotice('Rascunho da thumb salvo localmente no espaço exclusivo deste canal.');
      return;
    }
    if (asCover && !draft.projectId) { setNotice('Selecione um projeto antes de definir a capa.'); return; }
    if (draft.people.some((p) => p.cutoutStatus === 'processing')) { setNotice('Aguarde o recorte das fotos antes de salvar.'); return; }
    setSaving(true); setNotice('');
    try {
      const exported = [];
      if (withImages) {
        const generated = [];
        for (const format of ['horizontal', 'vertical']) {
          if (!formats[format]) continue;
          const blob = await thumbnailBlob(format === 'horizontal' ? horizontalRef.current : verticalRef.current, { width: format === 'vertical' ? 1080 : 1920, height: format === 'vertical' ? 1920 : 1080 });
          generated.push({ format, blob });
        }
        if (!generated.length) throw new Error('Selecione ao menos um formato.');
        for (const { format, blob } of generated) {
          const asset = await uploadMediaAsset(new File([blob], `thumb-${draft.projectId || 'livre'}-${format}-v${(activeThumb.revision || 0) + 1}.png`, { type: 'image/png' }), { origin: 'thumbnail', project_id: draft.projectId });
          exported.push({ format, assetId: asset.id, url: resolveMediaUrl(asset.stream_url) });
        }
      }
      const targetId = activeThumb.id;
      const saved = await saveThumbnailVersion(activeThumb, { exports: exported });
      if (asCover) await markProjectThumbnail(saved, exported);
      setThumbs((items) => items.map((item) => item.id === targetId ? saved : item));
      try { setSavedThumbs(await listSavedThumbnails()); setAssets(await listMediaAssets()); } catch { /* Saved record is authoritative; a later catalog refresh can be retried. */ }
      setNotice(asCover ? 'Thumb salva e definida como capa do projeto.' : withImages ? 'Composição e imagens salvas, vinculadas ao projeto e disponíveis no acervo.' : 'Rascunho salvo. Você pode reabrir após sair do sistema.');
    } catch (e) { setNotice(`Não foi possível concluir o salvamento: ${e.message}`); }
    finally { setSaving(false); }
  }
  // PNG baixado também vai para o Acervo e para a pasta de destino; se o Acervo recusar, o
  // download já foi feito e a mensagem diz o motivo.
  async function keepExport(blob, filename) {
    try { return savedNote(await saveExportToLibrary(blob, filename)); }
    catch (error) { return ` · baixado, mas não foi salvo no Acervo: ${error?.message || 'erro desconhecido'}`; }
  }

  async function downloadOne(format) {
    setExporting(true); setNotice('');
    const filename = `thumb-${draft.projectId || 'livre'}-${draft.episode || 'episodio'}-${format}.png`;
    try {
      const blob = await exportThumbnailElement(format === 'horizontal' ? horizontalRef.current : verticalRef.current, { width: format === 'vertical' ? 1080 : 1920, height: format === 'vertical' ? 1920 : 1080, filename });
      setNotice(`PNG exportado: ${filename}${await keepExport(blob, filename)}`);
    }
    catch (e) { setNotice(e.message); } finally { setExporting(false); }
  }

  async function exportSelected() {
    const slug = `${draft.program || 'thumb'}-${draft.episode || draft.title || 'sem-titulo'}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    setExporting(true);
    setNotice('');
    try {
      if (darkChannelMode) {
        if (!darkOutputValid) throw new Error('Use dimensões inteiras de 64 a 7680 px, com área máxima de 20 megapixels.');
        const filename = `thumb-${draft.channelName || 'canal'}-${outputWidth}x${outputHeight}.png`.toLowerCase().replace(/[^a-z0-9.-]+/g, '-');
        const blob = await exportThumbnailElement(darkPreviewRef.current, { width: outputWidth, height: outputHeight, filename });
        setNotice(`PNG exportado em ${outputWidth} × ${outputHeight} px.${await keepExport(blob, filename)}`);
        return;
      }
      const notes = [];
      if (formats.horizontal) {
        const blob = await exportThumbnailElement(horizontalRef.current, { width: 1920, height: 1080, filename: `${slug}-horizontal.png` });
        notes.push(`horizontal${await keepExport(blob, `${slug}-horizontal.png`)}`);
      }
      if (formats.vertical) {
        const blob = await exportThumbnailElement(verticalRef.current, { width: 1080, height: 1920, filename: `${slug}-vertical.png` });
        notes.push(`vertical${await keepExport(blob, `${slug}-vertical.png`)}`);
      }
      setNotice(`Imagem(ns) gerada(s) em PNG: ${notes.join('; ')}.`);
    } catch (error) {
      setNotice(error.message || 'Não foi possível gerar a imagem.');
    } finally { setExporting(false); }
  }

  return (
    <div className="space-y-5">
      <header className="space-y-3 border-b border-slate-800 bg-slate-950/30 px-1 pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <div role="tablist" aria-label="Artes abertas" className="flex min-w-[260px] flex-1 items-center gap-2 overflow-x-auto">
            {thumbs.map((item, index) => { const typeLabel = item.draft.pieceType === 'thumb' || item.draft.program ? 'Thumb' : 'Arte'; const fallback = `${typeLabel} ${index + 1}`; return <button key={item.id} type="button" role="tab" aria-selected={item.id === activeThumb?.id} aria-label={`Abrir ${item.draft.highlight || item.draft.title || fallback}`} onClick={() => toggleThumb(item.id)} className={`flex min-w-[130px] max-w-[210px] items-center gap-2 rounded-lg border px-3 py-2 text-left ${item.id === activeThumb?.id ? 'border-sky-400 bg-sky-950/50 text-white' : 'border-slate-800 bg-slate-900/60 text-slate-400'}`}><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[10px] font-black" style={{ background: item.draft.colors?.background, color: item.draft.colors?.text }}>{String(index + 1).padStart(2, '0')}</span><span className="min-w-0"><strong className="block truncate text-xs">{fallback}</strong><small className="block truncate text-[10px] opacity-70">{darkChannelMode ? initialTitle || 'Canais Dark' : item.draft.program || item.draft.modelName || 'Sem modelo'}</small></span></button>; })}
            <button type="button" onClick={() => startNewThumb('', darkChannelMode ? 'Criação Livre' : 'Padrão SIMERS')} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-dashed border-slate-700 text-sky-300" aria-label="Adicionar outra arte"><Plus size={16} /></button>
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-end gap-4">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" disabled={saving || exporting} onClick={() => saveThumb(true)} className="w2-button disabled:opacity-40"><Save size={16} /> {saving ? 'Salvando…' : 'Salvar versão'}</button>
          </div>
        </div>
      </header>

      {darkChannelMode && <p className="rounded-xl border border-cyan-900/60 bg-cyan-950/20 px-4 py-2 text-xs text-cyan-100">Estúdio de Arte para “{initialTitle || 'roteiro sem título'}” · independente do acervo MediaMind · rascunho protegido por canal e roteiro.</p>}

      {activeThumb?.expanded && <><div className="border-b border-slate-800 bg-mm-bar"><button type="button" aria-expanded={modesOpen} onClick={() => setModesOpen((value) => !value)} className="flex w-full items-center justify-between px-5 py-2 text-xs font-bold text-slate-300"><span>Modo: {tab}</span><span>{modesOpen ? 'Recolher ▴' : 'Expandir ▾'}</span></button>{modesOpen && <div role="tablist" aria-label="Modos de criação" className="grid border-t border-slate-800 sm:grid-cols-5">
        {visibleTabs.map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={`px-4 py-3 text-sm font-bold transition ${tab === item ? 'border-b-2 border-cyan-400 bg-cyan-950/40 text-cyan-200' : 'border-b-2 border-transparent text-slate-400 hover:bg-slate-900 hover:text-white'}`}>{item}</button>)}
      </div>}</div>

      {modesOpen && tab === 'Padrão SIMERS' && <section aria-label="Modelos SIMERS para thumbs" className="mm-panel">
        <div className="flex items-end justify-between gap-3"><div><h2 className="text-sm font-extrabold text-white">Modelos SIMERS</h2><p className="mt-1 text-xs text-slate-400">Primeiro escolha o tipo de peça; depois escolha o modelo. Nada é substituído fora da arte ativa.</p></div><button type="button" onClick={() => setGuideOpen(true)} className="text-xs font-bold text-sky-300">Ver guia</button></div>
        <div role="tablist" aria-label="Categorias de modelos SIMERS" className="mt-3 flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
          {[...SIMERS_MODEL_CATEGORIES, ...customCategories].map((category) => <button key={category.id} type="button" role="tab" aria-selected={modelCategory === category.id} onClick={() => setModelCategory(category.id)} className={`rounded-lg border px-3 py-2 text-xs font-bold ${modelCategory === category.id ? 'border-cyan-400 bg-cyan-950/50 text-cyan-200' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}>{category.label}</button>)}
          <button type="button" onClick={() => setAddingCategory(true)} className="rounded-lg border border-dashed border-slate-600 px-3 py-2 text-xs font-bold text-slate-300">+ Categoria</button>
        </div>
        {addingCategory && <div className="mt-3 flex max-w-xl gap-2"><input aria-label="Nome da nova categoria" autoFocus className={control} value={categoryName} onChange={(event) => setCategoryName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addModelCategory(); if (event.key === 'Escape') setAddingCategory(false); }} placeholder="Nome da categoria" /><button type="button" onClick={addModelCategory} className="w2-button bg-cyan-500 text-slate-950">Adicionar</button><button type="button" onClick={() => setAddingCategory(false)} className="w2-button">Cancelar</button></div>}
        {modelCategory === 'thumbs' && <div className="mt-3 flex flex-wrap gap-3 pb-2">{SIMERS_PROGRAMS.map((name) => { const selected = draft.program === name; return <button type="button" key={name} aria-label={`Aplicar modelo ${name}`} onClick={() => applyProgram(name)} className={`w-44 shrink-0 overflow-hidden rounded-xl border bg-slate-950 p-1 text-left transition ${selected ? 'border-sky-400 ring-2 ring-sky-400/20' : 'border-slate-700 hover:border-slate-500'}`}><ThumbnailCanvas draft={modelDrafts[name]} format="horizontal" simers /><span className="block truncate px-2 py-2 text-[10px] font-bold text-slate-200">{name}</span></button>; })}</div>}
        {modelCategory === 'single' && <div className="mt-3 flex flex-wrap gap-3 pb-2">{SINGLE_ART_MODELS.map((model) => <button type="button" key={model.name} aria-label={`Aplicar modelo ${model.name}`} onClick={() => applyCreativeModel(model, 'Arte individual')} className={`w-28 shrink-0 overflow-hidden rounded-xl border bg-slate-950 p-1 text-left transition ${draft.modelName === model.name ? 'border-cyan-400 ring-2 ring-cyan-400/20' : 'border-slate-700 hover:border-slate-500'}`}><img src={`/reference/arte-unica-${model.image}.png`} alt="" className="aspect-[4/5] w-full rounded-lg object-cover object-top" /><span className="block truncate px-2 py-2 text-[10px] font-bold text-slate-200">{model.name}</span></button>)}</div>}
        {modelCategory === 'carousel' && <div className="mt-3 flex flex-wrap gap-3 pb-2">{CAROUSEL_MODELS.map((model) => <button type="button" key={model.name} aria-label={`Aplicar modelo ${model.name}`} onClick={() => applyCreativeModel(model, 'Carrossel')} className={`w-28 shrink-0 overflow-hidden rounded-xl border bg-slate-950 p-1 text-left transition ${draft.modelName === model.name ? 'border-cyan-400 ring-2 ring-cyan-400/20' : 'border-slate-700 hover:border-slate-500'}`}><img src={model.image} alt="" className="aspect-[4/5] w-full rounded-lg object-cover object-top" /><span className="block truncate px-2 py-2 text-[10px] font-bold text-slate-200">{model.name}</span></button>)}</div>}
        {modelCategory.startsWith('custom-') && <div className="mt-3 grid min-h-36 place-items-center rounded-xl border border-dashed border-slate-700 text-center"><div><Layers3 className="mx-auto text-slate-600" size={32} /><p className="mt-2 text-sm font-bold text-slate-300">Categoria pronta para receber modelos</p><p className="mt-1 text-xs text-slate-500">Os modelos cadastrados nesta categoria aparecerão aqui.</p></div></div>}
      </section>}

      {activeThumb?.artTemplate ? (
        <CarouselStudio
          key={`${activeThumb.id}-${activeThumb.artTemplate}`}
          projectId={draft.projectId || null}
          initialMode="single"
          initialTemplate={activeThumb.artTemplate}
          embedded
        />
      ) : modesOpen && tab === 'Meus modelos' ? (
        <section className="mm-panel grid min-h-[420px] place-items-center text-center"><div><Layers3 className="mx-auto text-slate-600" size={48} /><h2 className="mt-4 text-xl font-bold">Nenhum outro template funcional cadastrado</h2><p className="mx-auto mt-2 max-w-lg text-sm text-slate-400">Quando novos canais ou clientes tiverem presets aprovados, eles aparecerão aqui. Use Criação Livre ou Usar Referência agora.</p></div></section>
      ) : modesOpen && tab === 'Outros' ? <section className="mm-panel grid min-h-[280px] place-items-center text-center"><div><Layers3 className="mx-auto text-slate-600" size={42} /><h2 className="mt-3 text-lg font-bold">Outras identidades</h2><p className="mt-2 max-w-lg text-sm text-slate-400">Modelos de outros canais e clientes aparecerão aqui quando forem cadastrados. Para criar agora, use Criação Livre.</p></div></section> : (
        <div className="grid gap-4 xl:grid-cols-[minmax(280px,330px)_minmax(480px,1fr)_minmax(260px,310px)]">
          <aside className="space-y-4">
            <section className="mm-panel space-y-3">
              <div className="flex items-center justify-between"><h2 className="font-bold">{darkChannelMode ? 'Thumbnail do canal' : 'Dados da arte'}</h2>{loading && <span className="text-[10px] text-sky-300">Carregando…</span>}</div>
              {!darkChannelMode && (draft.modelName ? <Field label="Modelo"><div className="flex gap-2"><input aria-label="Modelo" className={control} value={draft.modelName} onChange={(event) => setDraft((current) => ({ ...current, modelName: event.target.value }))} /><button type="button" onClick={restoreCurrentPattern} className="w2-button shrink-0">Restaurar padrão</button></div><small className="mt-1 block font-normal text-slate-500">{draft.modelCategory}</small></Field> : draft.pieceType === 'blank' ? <div className="rounded-xl border border-dashed border-cyan-800 bg-cyan-950/20 p-3 text-xs text-slate-300"><strong className="block text-cyan-200">Arte sem modelo</strong><span className="mt-1 block text-slate-500">Escolha uma categoria e um modelo acima, ou use Criação Livre.</span></div> : <Field label="Programa / modelo"><select aria-label="Programa" className={control} value={draft.program} onChange={(event) => applyProgram(event.target.value)}><option value="">Selecione</option>{[...new Set([draft.program, ...SIMERS_PROGRAMS].filter(Boolean))].map((program) => <option key={program}>{program}</option>)}</select></Field>)}
              {tab === 'Padrão SIMERS' && preset?.defined && <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><div className="flex items-center justify-between"><strong className="text-xs">Padrão aplicado</strong><span className="text-[10px] text-emerald-300">SIMERS</span></div><div className="mt-3 grid grid-cols-3 gap-2">{[['Fundo', draft.colors.background], ['Texto', draft.colors.text], ['Destaque', draft.colors.accent]].map(([name, color]) => <div key={name}><span className="block h-7 rounded-lg border border-white/10" style={{ background: color }} /><small className="mt-1 block text-[9px] text-slate-500">{name}<br/>{color}</small></div>)}</div><p className="mt-3 text-[10px] text-slate-500">Chamada: {draft.style?.headlineFont || 'Anton'} · nomes: {draft.style?.bodyFont || 'Montserrat'}</p></div>}
              {draft.program && !preset?.defined && <p className="rounded-xl border border-amber-700/60 bg-amber-950/30 p-3 text-xs text-amber-200">{draft.program === 'No Front' ? 'O padrão de No Front ainda não está definido. Use Criação Livre ou uma referência aprovada.' : `${draft.program} não possui preset SIMERS aprovado nesta tela. Nenhuma paleta de outro programa será aplicada.`}</p>}
              {(draft.pieceType === 'thumb' || draft.program) && !draft.programLogo && <p className="text-xs text-amber-200">Logo oficial deste programa não fornecido. Envie-o em Fontes, cores e efeitos.</p>}
              {!darkChannelMode && <Field label="Episódio"><input aria-label="Episódio" className={control} value={draft.episode} onChange={(event) => update('episode', event.target.value)} /></Field>}
              <Field label={darkChannelMode ? 'Título da thumbnail' : draft.pieceType === 'thumb' ? 'Chamada da thumb' : 'Chamada da arte'}><textarea aria-label={darkChannelMode ? 'Título da thumbnail' : draft.pieceType === 'thumb' ? 'Chamada da thumb' : 'Chamada da arte'} rows={3} className={control} value={draft.highlight ?? draft.title} onChange={(event) => { update('highlight', event.target.value); if (darkChannelMode) update('title', event.target.value); }} /></Field>
              <Field label={darkChannelMode ? 'Ideia / contexto visual' : 'Descrição / contexto'}><textarea aria-label={darkChannelMode ? 'Ideia / contexto visual' : 'Descrição / contexto'} rows={3} className={control} value={draft.description} onChange={(event) => update('description', event.target.value)} /></Field>
              {(darkChannelMode || tab === 'Usar Referência') && <Field label={darkChannelMode ? 'Foto ou referência para compor a thumb' : 'Imagem de referência'}><input aria-label={darkChannelMode ? 'Foto de referência da thumbnail' : 'Imagem de referência'} type="file" accept="image/*" className={control} onChange={(event) => setReferenceUrl(fileUrl(event.target.files?.[0]))} /></Field>}
              {(darkChannelMode || tab === 'Criação Livre') && <Field label="Orientação da composição"><textarea aria-label="Orientação da composição" rows={3} className={control} value={orientation} onChange={(event) => setOrientation(event.target.value)} placeholder="Ex.: imagem à direita, título curto, clima misterioso e alto contraste" /></Field>}
            </section>

            <section className="mm-panel space-y-3">
              <div className="flex items-center justify-between"><h2 className="font-bold">{darkChannelMode ? 'Imagens da thumbnail' : 'Pessoas na capa'}</h2>{!darkChannelMode && <button type="button" onClick={addManualPerson} className="text-sky-300" aria-label="Adicionar pessoa"><UserPlus size={17} /></button>}</div>
              {!darkChannelMode && <Field label="Selecionar entrevistado"><input aria-label="Buscar entrevistado" className={control} value={personSearch} onChange={(e) => setPersonSearch(e.target.value)} placeholder="Buscar em todas as pessoas" /><select aria-label="Selecionar entrevistado" className={control} value="" onChange={(e) => { const found = allPeople.find((p) => p.id === e.target.value); if (found) choosePerson(found); }}><option value="">Adicionar entrevistado à capa</option>{allPeople.filter((p) => p.name.toLocaleLowerCase().includes(personSearch.toLocaleLowerCase())).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
              {!darkChannelMode && <Field label="Atribuir próxima foto a"><select aria-label="Atribuir próxima foto a" className={control} value={targetPerson} onChange={(e) => setTargetPerson(e.target.value)}><option value="">Nova pessoa / grupo</option>{draft.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-sky-700 bg-sky-950/20 px-3 py-2.5 text-xs font-bold text-sky-300 transition hover:bg-sky-950/40"><Upload size={15} /> {darkChannelMode ? 'Enviar imagem e recortar fundo' : 'Adicionar pessoa com foto'}<input type="file" accept="image/*" className="hidden" aria-label={darkChannelMode ? 'Enviar imagem da thumbnail' : 'Adicionar pessoa com foto'} onChange={(event) => { addPersonFromPhoto(event.target.files?.[0]); event.target.value = ''; }} /></label>
              {draft.people.map((person) => <div key={person.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><div className="flex gap-3"><label className="grid h-12 w-12 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full bg-slate-800 text-xs font-bold text-slate-400">{person.photo ? <img src={person.photo} alt="" className="h-full w-full object-cover grayscale" /> : <Upload size={16} />}<input type="file" accept="image/*" className="hidden" aria-label={`Trocar foto de ${person.name}`} onChange={(event) => { replacePersonPhoto(person.id, event.target.files?.[0]); event.target.value = ''; }} /></label><div className="min-w-0 flex-1">{!darkChannelMode && <><input aria-label={`Nome de ${person.name}`} className="w-full bg-transparent text-sm font-bold outline-none" value={person.name} onChange={(event) => updatePerson(person.id, { name: event.target.value })} /><input aria-label={`Papel de ${person.name}`} className="mt-1 w-full bg-transparent text-xs text-slate-500 outline-none" value={person.role} onChange={(event) => updatePerson(person.id, { role: event.target.value })} /></>}{person.cutoutStatus === 'processing' && <small className="mt-1 block text-sky-300">Recortando fundo…</small>}{person.cutoutStatus === 'failed' && <small className="mt-1 block text-amber-300">{person.cutoutError || 'Recorte indisponível; foto original preservada.'}</small>}{person.cutoutPhoto && person.originalPhoto && <button type="button" className="mt-1 text-[10px] font-bold text-sky-300" onClick={() => updatePerson(person.id, person.useOriginal ? { photo: person.cutoutPhoto, useOriginal: false } : { photo: person.originalPhoto, useOriginal: true })}>{person.useOriginal ? 'Usar recorte automático' : 'Comparar com foto original'}</button>}</div></div><div className="mt-2 flex flex-wrap gap-2">{!darkChannelMode && <button type="button" className="text-xs text-sky-300" onClick={() => registerPerson(person)}>Cadastrar pessoa</button>}{person.originalPhoto && <button type="button" disabled={person.cutoutStatus === 'processing'} className="text-xs text-sky-300 disabled:opacity-40" onClick={() => retryPhoto(person)}>{person.cutoutStatus === 'failed' ? 'Tentar recorte novamente' : 'Remover fundo com IA'}</button>}<button type="button" className="text-xs text-slate-400" onClick={() => setDraft((d) => { const list = [...d.people]; const i = list.findIndex((p) => p.id === person.id); if (i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]]; return { ...d, people: list }; })}>Mover antes</button><button type="button" className="text-xs text-rose-300" onClick={() => { photoVersions.current.delete(person.id); setDraft((d) => ({ ...d, people: d.people.filter((p) => p.id !== person.id) })); }}>Remover da capa</button></div>{!darkChannelMode && <div className="mt-3 flex gap-4 text-xs"><label><input type="checkbox" checked={person.visible} onChange={(event) => updatePerson(person.id, { visible: event.target.checked })} /> <span className="ml-1">Aparecer</span></label><label><input type="checkbox" checked={person.showName} onChange={(event) => updatePerson(person.id, { showName: event.target.checked })} /> <span className="ml-1">Mostrar nome</span></label></div>}</div>)}
              {!draft.people.length && <p className="text-xs text-slate-500">{darkChannelMode ? 'Adicione uma foto, imagem gerada por IA ou comece somente com texto.' : 'Nenhuma pessoa associada. Adicione manualmente se necessário.'}</p>}
            </section>
            {!darkChannelMode && <section className="mm-panel"><div className="flex items-center justify-between gap-3"><h2 className="font-bold">Fotos dos participantes</h2><label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-sky-800 px-2.5 py-1.5 text-[11px] font-bold text-sky-300"><ImagePlus size={14} /> Enviar foto<input type="file" accept="image/*" className="hidden" aria-label="Adicionar foto local" onChange={(event) => { addPhoto(event.target.files?.[0]); event.target.value = ''; }} /></label></div><div className="mt-3 grid grid-cols-2 gap-2">{[...draft.photos, ...relatedAssets.filter((asset) => !draft.photos.some((photo) => photo.id === String(asset.id))).map((asset) => ({ id: String(asset.id), name: asset.title || asset.filename || 'Imagem', url: resolveMediaUrl(asset.stream_url || asset.file_url || ''), selected: false, source: 'Acervo' }))].map((photo) => <button type="button" key={photo.id} onClick={() => applyAssetPhoto(photo)} className={`overflow-hidden rounded-xl border text-left ${photo.selected ? 'border-sky-400' : 'border-slate-800'}`}><div className="aspect-video bg-slate-950">{photo.url && <img src={photo.url} alt="" className="h-full w-full object-cover" />}</div><span className="block truncate p-2 text-[10px]">{photo.name}</span></button>)}</div>{!relatedAssets.length && !draft.photos.length && <p className="mt-3 text-xs text-slate-500">Nenhuma imagem relacionada encontrada.</p>}</section>}
          </aside>

          <main className="space-y-4">
            <section className="mm-panel flex flex-wrap items-end gap-3">
              <div className="min-w-[240px] flex-1">{darkChannelMode ? <><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Canal / roteiro</span><div className="rounded-xl border border-cyan-900/60 bg-cyan-950/20 px-3 py-2.5 text-sm text-cyan-100">Canais Dark · {initialTitle || "Roteiro sem título"}</div></> : <><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Projeto / episódio</span><select aria-label="Projeto" className={control} value={draft.projectId} onChange={(event) => selectProject(event.target.value)}><option value="">Preencher manualmente</option>{sourceProjects.map((project) => <option key={project.id} value={String(project.id)}>{project.titulo || project.title || `Projeto ${project.id}`}</option>)}</select></>}</div>
              <div className="flex flex-wrap items-end gap-2 pb-0.5">
                {darkChannelMode ? <>
                  <label className="min-w-56 flex-1 text-[10px] font-bold text-slate-400">Formato de saída<select aria-label="Formato de saída" className={`${control} mt-1`} value={platformFormat} onChange={(event) => chooseDarkFormat(event.target.value)}>{DARK_THUMB_FORMATS.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.width} × {item.height}</option>)}<option value="custom">Tamanho personalizado</option></select></label>
                  {platformFormat === 'custom' && <>
                    <label className="w-36 text-[10px] font-bold text-slate-400">Largura personalizada (px)<input aria-label="Largura personalizada (px)" type="number" min="64" max="7680" step="1" className={`${control} mt-1`} value={activeThumb?.customWidth ?? 1280} onChange={(event) => { const width = event.target.value === '' ? '' : Number(event.target.value); updateActive({ customWidth: width }); if (Number(width) / outputHeight < 0.9) setEditFormat('vertical'); else setEditFormat('horizontal'); }} /></label>
                    <label className="w-36 text-[10px] font-bold text-slate-400">Altura personalizada (px)<input aria-label="Altura personalizada (px)" type="number" min="64" max="7680" step="1" className={`${control} mt-1`} value={activeThumb?.customHeight ?? 720} onChange={(event) => { const height = event.target.value === '' ? '' : Number(event.target.value); updateActive({ customHeight: height }); if (outputWidth / Number(height) < 0.9) setEditFormat('vertical'); else setEditFormat('horizontal'); }} /></label>
                  </>}
                  {!darkOutputValid && <p role="alert" className="basis-full text-xs text-amber-300">Use dimensões inteiras de 64–7680 px e até 20 megapixels.</p>}
                  <button type="button" disabled={exporting || !darkOutputValid} onClick={exportSelected} className="w2-button bg-sky-500 text-slate-950 disabled:opacity-40"><Download size={15} /> {exporting ? 'Gerando…' : `Exportar PNG ${outputWidth} × ${outputHeight}`}</button>
                </> : <>
                  {['single', 'carousel'].includes(draft.pieceType) ? <span className="rounded-lg border border-cyan-400 bg-cyan-950/50 px-3 py-2 text-xs font-bold text-cyan-200">Instagram / Facebook · 1080 × 1350 (4:5)</span> : <><button type="button" aria-pressed={formats.horizontal} onClick={() => { setFormats((value) => ({ ...value, horizontal: !value.horizontal })); setEditFormat('horizontal'); }} className={`rounded-lg border px-3 py-2 text-xs font-bold ${formats.horizontal ? 'border-cyan-400 bg-cyan-950/50 text-cyan-200' : 'border-slate-700 text-slate-400'}`}>Horizontal</button><button type="button" aria-pressed={formats.vertical} onClick={() => { setFormats((value) => ({ ...value, vertical: !value.vertical })); setEditFormat('vertical'); }} className={`rounded-lg border px-3 py-2 text-xs font-bold ${formats.vertical ? 'border-cyan-400 bg-cyan-950/50 text-cyan-200' : 'border-slate-700 text-slate-400'}`}>Vertical</button></>}
                  <button type="button" disabled={exporting || (!formats.horizontal && !formats.vertical)} onClick={exportSelected} className="w2-button bg-sky-500 text-slate-950 disabled:opacity-40"><Download size={15} /> {exporting ? 'Gerando…' : `Baixar (${Number(formats.horizontal) + Number(formats.vertical)})`}</button>
                </>}
              </div>
            </section>
            {darkChannelMode && <section className="mm-panel space-y-3" aria-label="Canais de destino da thumbnail"><h2 className="font-bold">Plataformas de destino</h2><p className="text-xs text-slate-400">Selecione onde esta thumb será usada. Esta seleção fica salva no rascunho; não publica automaticamente.</p><div className="flex flex-wrap gap-3">{[['youtube','YouTube'],['youtube_shorts','YouTube Shorts'],['instagram','Instagram'],['tiktok','TikTok'],['facebook','Facebook']].map(([value,label]) => <label key={value} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs"><input type="checkbox" checked={targetChannels.includes(value)} onChange={(event) => setTargetChannels(event.target.checked ? [...targetChannels, value] : targetChannels.filter((item) => item !== value))} />{label}</label>)}</div></section>}
            <section className="mm-panel">
              <div className="mb-3 flex flex-wrap items-center gap-2"><button type="button" className="w2-button" onClick={() => undo()}>↶</button><button type="button" className="w2-button" onClick={() => undo(true)}>↷</button><span className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold">80%</span><label className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">Guias <input type="checkbox" checked={showGuides} onChange={(event) => setShowGuides(event.target.checked)} /></label></div>
              {['single', 'carousel'].includes(draft.pieceType) && <div role="region" aria-label="Arte em edição" className="mx-auto w-full max-w-[620px]"><div className="mb-2 flex items-center justify-between text-xs"><strong>{draft.pieceType === 'carousel' ? 'Página de carrossel 1080×1350' : 'Retrato 1080×1350'}</strong><button type="button" disabled={exporting || saving} onClick={() => downloadOne('vertical')} className="text-sky-300">Baixar PNG</button></div><ThumbnailCanvas ref={verticalRef} draft={draft} format="vertical" simers={tab === 'Padrão SIMERS'} referenceUrl={referenceUrl} selectedLayer={selectedLayer} onSelectLayer={(id, format) => { setSelectedLayer(id); setEditFormat(format); }} onLayoutChange={changeLayout} showGuides={showGuides} /></div>}
              {!darkChannelMode && formats.horizontal && <div className="mb-4"><div className="mb-2 flex items-center justify-between text-xs"><strong>Horizontal 1920×1080</strong><button type="button" disabled={exporting || saving} onClick={() => downloadOne('horizontal')} className="text-sky-300">Baixar PNG</button></div><ThumbnailCanvas ref={horizontalRef} draft={draft} format="horizontal" simers={tab === 'Padrão SIMERS'} referenceUrl={referenceUrl} selectedLayer={editFormat === 'horizontal' ? selectedLayer : ''} onSelectLayer={(id, format) => { setSelectedLayer(id); setEditFormat(format); }} onLayoutChange={changeLayout} showGuides={showGuides} /></div>}
              {darkChannelMode && <div className="mx-auto w-full max-w-[720px]"><div className="mb-2 flex items-center justify-between text-xs"><strong>{selectedOutputFormat?.label || 'Tamanho personalizado'} · {outputWidth} × {outputHeight} px</strong><span className="text-slate-400">Prévia na proporção selecionada</span></div><ThumbnailCanvas ref={darkPreviewRef} draft={draft} format={darkFormat} dimensions={{ width: outputWidth, height: outputHeight }} simers={false} referenceUrl={referenceUrl} selectedLayer={selectedLayer} onSelectLayer={(id, format) => { setSelectedLayer(id); setEditFormat(format); }} onLayoutChange={changeLayout} showGuides={showGuides} /></div>}
              <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="w2-button" disabled={saving || exporting} onClick={() => saveThumb()}>Salvar rascunho</button>{darkChannelMode ? <button type="button" className="w2-button" disabled={saving || exporting} onClick={() => saveThumb(true)}>Exportar PNG</button> : <><button type="button" className="w2-button" disabled={saving || exporting} onClick={() => saveThumb(true)}>Salvar imagens no projeto</button><button type="button" className="w2-button disabled:opacity-40" disabled={saving || exporting || !draft.projectId} onClick={() => saveThumb(true, true)}>Salvar e definir capa do projeto</button></>}</div>
              {saving && <p className="mt-2 text-xs">Salvando versão e arquivos…</p>}
              {notice && <p className="mt-2 text-center text-xs text-sky-300">{notice}</p>}
            </section>
            <section className="mm-panel grid gap-4 md:grid-cols-[180px_1fr]" aria-label="Formatos e camadas">
              {!darkChannelMode && formats.vertical && !['single', 'carousel'].includes(draft.pieceType) && <div><div className="mb-2 flex items-center justify-between text-[10px]"><strong>Vertical</strong><button type="button" disabled={exporting || saving} onClick={() => downloadOne('vertical')} className="text-sky-300">PNG</button></div><ThumbnailCanvas ref={verticalRef} draft={draft} format="vertical" simers={tab === 'Padrão SIMERS'} referenceUrl={referenceUrl} selectedLayer={editFormat === 'vertical' ? selectedLayer : ''} onSelectLayer={(id, format) => { setSelectedLayer(id); setEditFormat(format); }} onLayoutChange={changeLayout} showGuides={showGuides} /></div>}
              <div className="space-y-4"><div><h2 className="font-bold">Formatos de saída</h2>{darkChannelMode ? <div className="mt-3 rounded-xl border border-cyan-800 bg-cyan-950/30 p-3 text-xs text-cyan-100"><strong className="block text-sm">{selectedOutputFormat?.label || 'Tamanho personalizado'}</strong><span className="mt-1 block">{outputWidth} × {outputHeight} px</span><small className="mt-2 block text-slate-400">Destinos: {targetChannels.length ? targetChannels.join(', ') : 'a escolher'}</small></div> : ['single', 'carousel'].includes(draft.pieceType) ? <div className="mt-3 rounded-xl border border-sky-400 bg-sky-950/40 p-3 text-left text-xs text-sky-200"><strong className="block text-sm">Retrato 4:5</strong>1080 × 1350</div> : <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => { setFormats((value) => ({ ...value, horizontal: true })); setEditFormat('horizontal'); }} className={`rounded-xl border p-3 text-left text-xs ${editFormat === 'horizontal' ? 'border-sky-400 bg-sky-950/40 text-sky-200' : 'border-slate-800 text-slate-400'}`}><strong className="block text-sm">Horizontal</strong>1920 × 1080</button><button type="button" onClick={() => { setFormats((value) => ({ ...value, vertical: true })); setEditFormat('vertical'); }} className={`rounded-xl border p-3 text-left text-xs ${editFormat === 'vertical' ? 'border-sky-400 bg-sky-950/40 text-sky-200' : 'border-slate-800 text-slate-400'}`}><strong className="block text-sm">Vertical</strong>1080 × 1920</button></div>}</div><div><h2 className="font-bold">Camadas (ordem de exibição)</h2><div className="mt-3 flex flex-wrap gap-2">{thumbnailLayers(draft, darkChannelMode ? darkFormat : editFormat).map((layer) => <button type="button" key={layer.id} onClick={() => setSelectedLayer(layer.id)} className={`rounded-lg border px-2.5 py-2 text-xs ${selectedLayer === layer.id ? 'border-sky-400 bg-sky-950/40 text-sky-200' : 'border-slate-800 text-slate-400'}`}>{layer.label}</button>)}</div></div></div>
            </section>
            <section className="mm-panel"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">Versões do projeto</h2><p className="mt-1 text-xs text-slate-400">Composições editáveis e PNGs reutilizáveis.</p></div><span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-300">{savedThumbs.filter((r) => !draft.projectId || String(r.project_id) === draft.projectId).length}</span></div><div className="mt-3 space-y-2">{savedThumbs.filter((r) => !draft.projectId || String(r.project_id) === draft.projectId).map((r) => <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 p-2 text-xs"><span className="min-w-0 flex-1">{r.title} · v{r.revision} · {r.program}</span><button type="button" className="text-sky-300" onClick={() => openSaved(r)}>Reabrir</button><button type="button" className="text-sky-300" onClick={() => openSaved(r, true)}>Duplicar</button>{r.exports?.map((e) => <a key={e.assetId} href={resolveMediaUrl(e.url)} target="_blank" rel="noreferrer" className="text-emerald-300">PNG {e.format}</a>)}</div>)}</div>{!savedThumbs.filter((r) => !draft.projectId || String(r.project_id) === draft.projectId).length && <p className="mt-3 text-xs text-slate-500">Nenhuma versão salva para este projeto.</p>}</section>
          </main>

          <aside className="space-y-4">
            <ThumbnailTools draft={draft} format={editFormat} setFormat={setEditFormat} selectedLayer={selectedLayer} onSelect={setSelectedLayer} onLayoutChange={changeLayout} onPersonChange={updatePerson} onStyleChange={(patch) => setDraft((d) => ({ ...d, style: { ...d.style, ...patch } }))} onColorsChange={(patch) => setDraft((d) => ({ ...d, colors: { ...d.colors, ...patch } }))} onRestore={(format) => format ? setDraft((d) => ({ ...restoreThumbnailStyle(d, format), colors: d.modelColors ? { ...d.colors, ...d.modelColors } : restoreThumbnailStyle(d, format).colors })) : restoreCurrentPattern()} onUndo={() => undo()} onRedo={() => undo(true)} onSaveProjectStyle={saveProjectStyle} onLogoUpload={(field, file) => { if (file) update(field, fileUrl(file)); }} />
            {darkChannelMode && <section className="mm-panel space-y-3"><div><h2 className="font-bold">Criar imagem com IA</h2><p className="mt-1 text-xs text-slate-400">Escolha se quer aproveitar informações já criadas. Somente os itens marcados serão copiados para o prompt.</p></div>{darkContextItems.length > 0 && <div className="space-y-2 rounded-xl border border-slate-800 p-3">{darkContextItems.map((item) => <details key={item.id} className="rounded-lg bg-slate-950/50 p-2"><summary className="flex cursor-pointer list-none items-center gap-2 text-xs"><input aria-label={`Usar ${item.label}`} type="checkbox" checked={selectedContextIds.includes(item.id)} onClick={(event) => event.stopPropagation()} onChange={(event) => setSelectedContextIds(event.target.checked ? [...selectedContextIds, item.id] : selectedContextIds.filter((id) => id !== item.id))}/><span className="font-semibold">{item.label}</span><span className="ml-auto text-slate-500">ver texto</span></summary><pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-[10px] text-slate-400">{item.text}</pre></details>)}<button type="button" disabled={!selectedContextIds.some((id) => darkContextItems.some((item) => item.id === id))} onClick={addSelectedContextToPrompt} className="w2-button w-full disabled:opacity-40">Inserir seleção no prompt</button></div>}<textarea aria-label="Prompt para imagem da thumbnail" className={control} rows={5} value={imagePrompt} onChange={(event) => setImagePrompt(event.target.value)} placeholder="Escreva sua ideia ou revise/apague trechos do contexto inserido: cena cinematográfica, sem texto, alto contraste…"/><button type="button" disabled={!imageProvider.configured || !imagePrompt.trim() || generatingImage} onClick={generateDarkImage} className="w2-button w-full disabled:opacity-40"><ImagePlus size={15}/>{generatingImage ? 'Gerando imagem…' : 'Gerar e adicionar à thumb'}</button><p className="text-[11px] text-slate-500">{imageProvider.loading ? 'Verificando provedor…' : imageProvider.configured ? `Provedor conectado: ${imageProvider.provider || 'configurado'}` : <><span>Geração de imagem não configurada. </span><Link to="/configuracoes/ia" className="text-sky-300">Configurar IA</Link></>}</p></section>}
            {!darkChannelMode && <button type="button" onClick={() => setGuideOpen(true)} className="mm-panel flex w-full items-center gap-3 text-left transition hover:border-emerald-400/60 hover:bg-emerald-400/5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300"><BookOpen size={18} /></span>
              <span className="min-w-0 flex-1"><strong className="block text-sm">Guia Padrão SIMERS</strong><small className="mt-0.5 block text-slate-400">Paletas, tipografia e regras oficiais.</small></span>
              <span className="text-xs font-bold text-emerald-300">Abrir quadro →</span>
            </button>}
            <ThumbnailAISettings />
            {!darkChannelMode && <section className="mm-panel"><h2 className="font-bold">Dados do sistema</h2>{selectedProject ? <><p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-300"><CheckCircle2 size={14} /> Dados carregados do MediaMind</p><dl className="mt-3 grid grid-cols-[82px_1fr] gap-y-2 text-xs"><dt className="text-slate-500">Projeto</dt><dd>{selectedProject.titulo || selectedProject.title}</dd><dt className="text-slate-500">Programa</dt><dd>{selectedProject.programa || 'Não informado'}</dd><dt className="text-slate-500">Episódio</dt><dd>{selectedProject.episodio || 'Não informado'}</dd><dt className="text-slate-500">Roteiro</dt><dd>{matchingScript ? 'Encontrado' : (selectedProject.pauta ? 'Planejamento do projeto' : 'Não integrado')}</dd><dt className="text-slate-500">Pessoas</dt><dd>{draft.people.length}</dd><dt className="text-slate-500">Fotos</dt><dd>{relatedAssets.length}</dd></dl><Link to={`/corp?tab=producao&sub=${selectedProject.etapa || 'overview'}`} className="mt-4 block rounded-xl border border-slate-700 py-2 text-center text-xs font-bold text-sky-300">Abrir episódio</Link></> : <><p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-sky-300"><CheckCircle2 size={14} /> Criação nova</p><p className="mt-2 text-xs text-slate-500">Escolha tudo manualmente ou carregue um conteúdo do MediaMind. O registro original não será alterado.</p></>}{dataError && <p className="mt-3 rounded-lg bg-rose-950/30 p-2 text-xs text-rose-300">{dataError}</p>}</section>}

            {!darkChannelMode && <section className="mm-panel"><h2 className="font-bold">Validação SIMERS</h2><ul className="mt-3 space-y-2 text-xs">{validation.length ? validation.map((issue) => <li key={issue} className="flex gap-2 text-amber-300"><Info size={14} className="shrink-0" />{issue}</li>) : <li className="flex gap-2 text-emerald-300"><CheckCircle2 size={14} />Campos essenciais preenchidos</li>}<li className="flex gap-2 text-slate-400"><CheckCircle2 size={14} className="shrink-0" />Fundo contínuo, sem barra ou caixa de texto</li><li className="flex gap-2 text-slate-400"><CheckCircle2 size={14} className="shrink-0" />Horizontal e vertical têm composições próprias</li>{preset && !preset.defined && <li className="flex gap-2 text-amber-300"><Info size={14} />Padrão do programa ainda não definido</li>}</ul></section>}
          </aside>
        </div>
      )}</>}

      {guideOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label="Guia do padrão SIMERS"><section className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl"><header className="flex items-start justify-between"><div><h2 className="text-xl font-extrabold">Guia do padrão SIMERS</h2><p className="text-sm text-slate-400">Paletas e regras aplicadas pelo Thumbnail Studio.</p></div><button type="button" aria-label="Fechar guia" onClick={() => setGuideOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"><X size={20} /></button></header><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(SIMERS_PRESETS).map(([name, colors]) => <article key={name} className="rounded-xl border border-slate-800 p-3"><div className="mb-2 flex h-16 overflow-hidden rounded-lg">{colors.defined ? <><span className="flex-1" style={{ background: colors.background }} /><span className="w-1/3" style={{ background: colors.accent || colors.text }} /></> : <span className="grid flex-1 place-items-center bg-slate-900 text-xs text-slate-500">Não definido</span>}</div><strong className="text-sm">{name}</strong>{colors.defined && <p className="mt-1 font-mono text-[10px] text-slate-500">{[colors.background, colors.text, colors.accent].filter(Boolean).join(' · ')}</p>}</article>)}</div><div className="mt-5 grid gap-4 md:grid-cols-2"><div className="rounded-xl bg-slate-900 p-4"><h3 className="font-bold">Hierarquia e formatos</h3><p className="mt-2 text-sm leading-6 text-slate-400">Chamada principal &gt; nomes &gt; programa • episódio. Horizontal 1920×1080 e vertical 1080×1920 com composição própria.</p></div><div className="rounded-xl bg-slate-900 p-4"><h3 className="font-bold">Não fazer</h3><p className="mt-2 text-sm leading-6 text-slate-400">Não usar barras brancas, rodapés, tarjas ou caixas atrás do texto. Não repetir episódio, não excluir pessoas automaticamente e não alterar rostos.</p></div></div></section></div>}
    </div>
  );
}
