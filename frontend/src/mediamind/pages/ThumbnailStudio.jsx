import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BookOpen, CheckCircle2, ChevronDown, ChevronUp, Download, ImagePlus, Info, Layers3, Plus, Upload, UserPlus, X,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { listMediaAssets, uploadMediaAsset, resolveMediaUrl } from '@/api/media';
import { useProducaoProjetos, mergePersistedProject } from '../lib/producaoStore';
import {
  DEFAULT_COLORS, SIMERS_PRESETS, SIMERS_PROGRAMS, createThumbnailDraft, presetFor, validateSimersDraft, normalizePerson, projectPeople, PROGRAM_LOGOS, restoreThumbnailStyle,
} from '../lib/thumbnailStudio';
import { exportThumbnailElement, thumbnailBlob } from '../lib/thumbnailExport';
import { createLocalCutout } from '../lib/thumbnailImage';
import ThumbnailCanvas from '../components/thumbnails/ThumbnailCanvas';
import ThumbnailTools from '../components/thumbnails/ThumbnailTools';
import ThumbnailAISettings from '../components/thumbnails/ThumbnailAISettings';
import { listSavedThumbnails, saveThumbnailVersion, markProjectThumbnail } from '../lib/thumbnailPersistence';

const TABS = ['Padrão SIMERS', 'Usar Referência', 'Criação Livre', 'Outros Templates'];

function Field({ label, children }) {
  return <div className="block text-xs font-bold text-slate-300"><span className="mb-1.5 block">{label}</span>{children}</div>;
}

const control = 'w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-sky-400';

function fileUrl(file) {
  return file ? URL.createObjectURL(file) : '';
}

function createThumbSession(project, program) {
  return {
    id: `thumb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    draft: createThumbnailDraft(program ? { programa: program } : project),
    tab: TABS[0],
    formats: { horizontal: true, vertical: true },
    manualCreation: Boolean(program),
    referenceUrl: '',
    orientation: '',
    expanded: true,
  };
}

export default function ThumbnailStudio() {
  const productionProjects = useProducaoProjetos();
  const [searchParams] = useSearchParams();
  const [personCatalog, setPersonCatalog] = useState([]);
  const [personSearch, setPersonSearch] = useState('');
  const [savedThumbs, setSavedThumbs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editFormat, setEditFormat] = useState('horizontal');
  const [selectedLayer, setSelectedLayer] = useState('');
  const history = useRef(new Map());
  const redoHistory = useRef(new Map());
  const photoVersions = useRef(new Map());
  const [targetPerson, setTargetPerson] = useState('');
  const [catalogProjects, setCatalogProjects] = useState([]);
  const [scripts, setScripts] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const projects = useMemo(() => {
    const seen = new Set();
    return [...productionProjects, ...catalogProjects].filter((item) => {
      const id = String(item.id ?? item._entityId ?? '');
      if (!id || seen.has(id) || !(item.titulo || item.title)) return false;
      seen.add(id);
      return true;
    }).map((p) => ({ ...p, id: p._entityId || p.id }));
  }, [productionProjects, catalogProjects]);
  const projectKey = useMemo(() => projects.map((project) => String(project.id)).join('|'), [projects]);
  const [thumbs, setThumbs] = useState(() => [createThumbSession(productionProjects[0])]);
  const [activeId, setActiveId] = useState(() => null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [programPickerOpen, setProgramPickerOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState('');
  const horizontalRef = useRef(null);
  const verticalRef = useRef(null);
  const activeThumb = thumbs.find((item) => item.id === activeId) || thumbs.find((item) => item.expanded) || thumbs[0];
  const draft = activeThumb?.draft || createThumbnailDraft();
  const tab = activeThumb?.tab || TABS[0];
  const formats = activeThumb?.formats || { horizontal: true, vertical: true };
  const manualCreation = activeThumb?.manualCreation || false;
  const referenceUrl = activeThumb?.referenceUrl || '';
  const orientation = activeThumb?.orientation || '';

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

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!manualCreation && projects[0] && (!draft.projectId || !projects.some((project) => String(project.id) === draft.projectId))) {
      const requestedProject = projects.find((p) => String(p.id) === searchParams.get('project'));
      const sameTitle = projects.find((project) => (project.titulo || project.title) === draft.title);
      selectProject(String((requestedProject || sameTitle || projects[0]).id));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const validation = validateSimersDraft(draft);

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
    const fallbackName = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Nova pessoa';
    const name = fallbackName.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
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
    setDraft((current) => ({ ...current, program, programLogo: PROGRAM_LOGOS[program] || '', colors: colors?.defined ? { ...DEFAULT_COLORS, ...colors } : { ...DEFAULT_COLORS } }));
  }

  function startNewThumb(program) {
    const next = createThumbSession(null, program);
    setThumbs((items) => [...items.map((item) => ({ ...item, expanded: false })), next]);
    setActiveId(next.id);
    setNotice('');
    setProgramPickerOpen(false);
  }

  function toggleThumb(id) {
    setThumbs((items) => items.map((item) => item.id === id
      ? { ...item, expanded: !item.expanded }
      : { ...item, expanded: false }));
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
  async function useAssetPhoto(photo) {
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
      await base44.entities.ProducaoProjeto.update(draft.projectId, { thumbnail_style: draft.style, thumbnail_channel_logo: draft.channelLogo?.startsWith('blob:') ? undefined : draft.channelLogo });
      mergePersistedProject(draft.projectId, { thumbnail_style: draft.style });
      setNotice('Fontes e efeitos definidos como padrão do projeto.');
    } catch (e) { setNotice(e.message); }
  }
  async function saveThumb(withImages = false, asCover = false) {
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
  async function downloadOne(format) {
    setExporting(true); setNotice('');
    try { await exportThumbnailElement(format === 'horizontal' ? horizontalRef.current : verticalRef.current, { width: format === 'vertical' ? 1080 : 1920, height: format === 'vertical' ? 1920 : 1080, filename: `thumb-${draft.projectId || 'livre'}-${draft.episode || 'episodio'}-${format}.png` }); }
    catch (e) { setNotice(e.message); } finally { setExporting(false); }
  }

  async function exportSelected() {
    const slug = `${draft.program || 'thumb'}-${draft.episode || draft.title || 'sem-titulo'}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    setExporting(true);
    setNotice('');
    try {
      if (formats.horizontal) await exportThumbnailElement(horizontalRef.current, { width: 1920, height: 1080, filename: `${slug}-horizontal.png` });
      if (formats.vertical) await exportThumbnailElement(verticalRef.current, { width: 1080, height: 1920, filename: `${slug}-vertical.png` });
      setNotice('Imagem(ns) gerada(s) em PNG.');
    } catch (error) {
      setNotice(error.message || 'Não foi possível gerar a imagem.');
    } finally { setExporting(false); }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[.2em] text-sky-400">Thumbnail Studio</p><h1 className="mt-1 text-3xl font-extrabold text-white">Criar Thumbs</h1><p className="mt-1 text-sm text-slate-400">Crie capas conectadas ao planejamento e ao acervo do MediaMind.</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setProgramPickerOpen(true)} className="w2-button bg-sky-500 text-slate-950 hover:bg-sky-400" aria-label="Nova thumb"><Plus size={16} /> Nova thumb</button><button type="button" onClick={() => setGuideOpen(true)} className="w2-button"><BookOpen size={16} /> Ver guia do padrão</button></div>
      </header>

      <section aria-label="Thumbs em criação" className="space-y-2">
        <div className="flex items-center justify-between"><h2 className="text-sm font-extrabold text-white">Thumbs em criação</h2><span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-300">{thumbs.length}</span></div>
        {thumbs.map((item, index) => {
          const label = item.draft.highlight || item.draft.title || `Thumb ${String(index + 1).padStart(2, '0')}`;
          return <article key={item.id} className={`overflow-hidden rounded-2xl border transition ${item.expanded ? 'border-sky-500 bg-sky-950/20' : 'border-slate-800 bg-slate-900/60'}`}>
            <button type="button" onClick={() => toggleThumb(item.id)} aria-expanded={item.expanded} aria-label={`${item.expanded ? 'Recolher' : 'Expandir'} ${label}`} className="flex w-full items-center gap-3 px-4 py-3 text-left">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-black" style={{ background: item.draft.colors?.background, color: item.draft.colors?.text }}>{String(index + 1).padStart(2, '0')}</span>
              <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-white">{label}</strong><small className="block truncate text-slate-400">{item.draft.program || 'Programa não escolhido'} · {item.formats.horizontal && item.formats.vertical ? '2 formatos' : '1 formato'}</small></span>
              {item.expanded ? <ChevronUp size={18} className="text-sky-300" /> : <ChevronDown size={18} className="text-slate-400" />}
            </button>
          </article>;
        })}
      </section>

      {activeThumb?.expanded && <><div role="tablist" aria-label="Modos de criação" className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 p-1.5">
        {TABS.map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition ${tab === item ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>{item}</button>)}
      </div>

      {tab === 'Outros Templates' ? (
        <section className="mm-panel grid min-h-[420px] place-items-center text-center"><div><Layers3 className="mx-auto text-slate-600" size={48} /><h2 className="mt-4 text-xl font-bold">Nenhum outro template funcional cadastrado</h2><p className="mx-auto mt-2 max-w-lg text-sm text-slate-400">Quando novos canais ou clientes tiverem presets aprovados, eles aparecerão aqui. Use Criação Livre ou Usar Referência agora.</p></div></section>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(280px,330px)_minmax(480px,1fr)_minmax(260px,310px)]">
          <aside className="space-y-4">
            <section className="mm-panel space-y-3">
              <div className="flex items-center justify-between"><h2 className="font-bold">Dados da thumb</h2>{loading && <span className="text-[10px] text-sky-300">Carregando…</span>}</div>
              <Field label="Programa"><select aria-label="Programa" className={control} value={draft.program} onChange={(event) => applyProgram(event.target.value)}><option value="">Selecione</option>{[...new Set([draft.program, ...SIMERS_PROGRAMS].filter(Boolean))].map((program) => <option key={program}>{program}</option>)}</select></Field>
              <Field label={manualCreation ? 'Conteúdo fonte (opcional)' : 'Projeto'}><select aria-label="Projeto" className={control} value={draft.projectId} onChange={(event) => selectProject(event.target.value)}><option value="">Preencher manualmente</option>{sourceProjects.map((project) => <option key={project.id} value={String(project.id)}>{project.titulo || project.title || `Projeto ${project.id}`}</option>)}</select></Field>
              {tab === 'Padrão SIMERS' && preset?.defined && <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><div className="flex items-center justify-between"><strong className="text-xs">Padrão aplicado</strong><span className="text-[10px] text-emerald-300">SIMERS</span></div><div className="mt-3 grid grid-cols-3 gap-2">{[['Fundo', draft.colors.background], ['Texto', draft.colors.text], ['Destaque', draft.colors.accent]].map(([name, color]) => <div key={name}><span className="block h-7 rounded-lg border border-white/10" style={{ background: color }} /><small className="mt-1 block text-[9px] text-slate-500">{name}<br/>{color}</small></div>)}</div><p className="mt-3 text-[10px] text-slate-500">Chamada: {draft.style?.headlineFont || 'Anton'} · nomes: {draft.style?.bodyFont || 'Montserrat'}</p></div>}
              {draft.program && !preset?.defined && <p className="rounded-xl border border-amber-700/60 bg-amber-950/30 p-3 text-xs text-amber-200">{draft.program === 'No Front' ? 'O padrão de No Front ainda não está definido. Use Criação Livre ou uma referência aprovada.' : `${draft.program} não possui preset SIMERS aprovado nesta tela. Nenhuma paleta de outro programa será aplicada.`}</p>}
              {!draft.programLogo && <p className="text-xs text-amber-200">Logo oficial deste programa não fornecido. Envie-o em Fontes, cores e efeitos.</p>}
              <Field label="Episódio"><input aria-label="Episódio" className={control} value={draft.episode} onChange={(event) => update('episode', event.target.value)} /></Field>
              <Field label="Chamada da thumb"><textarea aria-label="Chamada da thumb" rows={3} className={control} value={draft.highlight ?? draft.title} onChange={(event) => update('highlight', event.target.value)} /></Field>
              <Field label="Descrição / contexto"><textarea aria-label="Descrição / contexto" rows={3} className={control} value={draft.description} onChange={(event) => update('description', event.target.value)} /></Field>
              {tab === 'Usar Referência' && <Field label="Imagem de referência"><input aria-label="Imagem de referência" type="file" accept="image/*" className={control} onChange={(event) => setReferenceUrl(fileUrl(event.target.files?.[0]))} /></Field>}
              {tab === 'Criação Livre' && <Field label="Orientação da composição"><textarea aria-label="Orientação da composição" rows={3} className={control} value={orientation} onChange={(event) => setOrientation(event.target.value)} placeholder="Ex.: pessoa à direita, chamada curta e alto contraste" /></Field>}
            </section>

            <section className="mm-panel space-y-3">
              <div className="flex items-center justify-between"><h2 className="font-bold">Pessoas na capa</h2><button type="button" onClick={addManualPerson} className="text-sky-300" aria-label="Adicionar pessoa"><UserPlus size={17} /></button></div>
              <Field label="Selecionar entrevistado"><input aria-label="Buscar entrevistado" className={control} value={personSearch} onChange={(e) => setPersonSearch(e.target.value)} placeholder="Buscar em todas as pessoas" /><select aria-label="Selecionar entrevistado" className={control} value="" onChange={(e) => { const found = allPeople.find((p) => p.id === e.target.value); if (found) choosePerson(found); }}><option value="">Adicionar entrevistado à capa</option>{allPeople.filter((p) => p.name.toLocaleLowerCase().includes(personSearch.toLocaleLowerCase())).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
              <Field label="Atribuir próxima foto a"><select aria-label="Atribuir próxima foto a" className={control} value={targetPerson} onChange={(e) => setTargetPerson(e.target.value)}><option value="">Nova pessoa / grupo</option>{draft.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-sky-700 bg-sky-950/20 px-3 py-2.5 text-xs font-bold text-sky-300 transition hover:bg-sky-950/40"><Upload size={15} /> Adicionar pessoa com foto<input type="file" accept="image/*" className="hidden" aria-label="Adicionar pessoa com foto" onChange={(event) => { addPersonFromPhoto(event.target.files?.[0]); event.target.value = ''; }} /></label>
              {draft.people.map((person) => <div key={person.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><div className="flex gap-3"><label className="grid h-12 w-12 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full bg-slate-800 text-xs font-bold text-slate-400">{person.photo ? <img src={person.photo} alt="" className="h-full w-full object-cover grayscale" /> : <Upload size={16} />}<input type="file" accept="image/*" className="hidden" aria-label={`Trocar foto de ${person.name}`} onChange={(event) => { replacePersonPhoto(person.id, event.target.files?.[0]); event.target.value = ''; }} /></label><div className="min-w-0 flex-1"><input aria-label={`Nome de ${person.name}`} className="w-full bg-transparent text-sm font-bold outline-none" value={person.name} onChange={(event) => updatePerson(person.id, { name: event.target.value })} /><input aria-label={`Papel de ${person.name}`} className="mt-1 w-full bg-transparent text-xs text-slate-500 outline-none" value={person.role} onChange={(event) => updatePerson(person.id, { role: event.target.value })} />{person.cutoutStatus === 'processing' && <small className="mt-1 block text-sky-300">Recortando fundo…</small>}{person.cutoutStatus === 'failed' && <small className="mt-1 block text-amber-300">{person.cutoutError || 'Recorte indisponível; foto original preservada.'}</small>}{person.cutoutPhoto && person.originalPhoto && <button type="button" className="mt-1 text-[10px] font-bold text-sky-300" onClick={() => updatePerson(person.id, person.useOriginal ? { photo: person.cutoutPhoto, useOriginal: false } : { photo: person.originalPhoto, useOriginal: true })}>{person.useOriginal ? 'Usar recorte automático' : 'Comparar com foto original'}</button>}</div></div><div className="mt-2 flex flex-wrap gap-2"><button type="button" className="text-xs text-sky-300" onClick={() => registerPerson(person)}>Cadastrar pessoa</button>{person.originalPhoto && <button type="button" disabled={person.cutoutStatus === 'processing'} className="text-xs text-sky-300 disabled:opacity-40" onClick={() => retryPhoto(person)}>{person.cutoutStatus === 'failed' ? 'Tentar recorte novamente' : 'Remover fundo com IA'}</button>}<button type="button" className="text-xs text-slate-400" onClick={() => setDraft((d) => { const list = [...d.people]; const i = list.findIndex((p) => p.id === person.id); if (i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]]; return { ...d, people: list }; })}>Mover antes</button><button type="button" className="text-xs text-rose-300" onClick={() => { photoVersions.current.delete(person.id); setDraft((d) => ({ ...d, people: d.people.filter((p) => p.id !== person.id) })); }}>Remover da capa</button></div><div className="mt-3 flex gap-4 text-xs"><label><input type="checkbox" checked={person.visible} onChange={(event) => updatePerson(person.id, { visible: event.target.checked })} /> <span className="ml-1">Aparecer</span></label><label><input type="checkbox" checked={person.showName} onChange={(event) => updatePerson(person.id, { showName: event.target.checked })} /> <span className="ml-1">Mostrar nome</span></label></div></div>)}
              {!draft.people.length && <p className="text-xs text-slate-500">Nenhuma pessoa associada. Adicione manualmente se necessário.</p>}
            </section>
            <ThumbnailTools draft={draft} format={editFormat} setFormat={setEditFormat} selectedLayer={selectedLayer} onSelect={setSelectedLayer} onLayoutChange={changeLayout} onPersonChange={updatePerson} onStyleChange={(patch) => setDraft((d) => ({ ...d, style: { ...d.style, ...patch } }))} onColorsChange={(patch) => setDraft((d) => ({ ...d, colors: { ...d.colors, ...patch } }))} onRestore={(format) => setDraft((d) => restoreThumbnailStyle(d, format))} onUndo={() => undo()} onRedo={() => undo(true)} onSaveProjectStyle={saveProjectStyle} onLogoUpload={(field, file) => { if (file) update(field, fileUrl(file)); }} />
          </aside>

          <main className="space-y-4">
            <section className="mm-panel">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">Preview</h2><p className="text-xs text-slate-500">Arraste as camadas ou use os controles. Preview e PNG usam a mesma composição.</p></div><div className="flex gap-3 text-xs"><label><input type="checkbox" checked={formats.horizontal} onChange={(event) => setFormats((value) => ({ ...value, horizontal: event.target.checked }))} /> <span className="ml-1">Horizontal</span></label><label><input type="checkbox" checked={formats.vertical} onChange={(event) => setFormats((value) => ({ ...value, vertical: event.target.checked }))} /> <span className="ml-1">Vertical</span></label></div></div>
              {formats.horizontal && <div className="mb-4"><div className="mb-2 flex items-center justify-between text-xs"><strong>Horizontal 1920×1080</strong><button type="button" disabled={exporting || saving} onClick={() => downloadOne('horizontal')} className="text-sky-300">Baixar PNG</button></div><ThumbnailCanvas ref={horizontalRef} draft={draft} format="horizontal" simers={tab === 'Padrão SIMERS'} referenceUrl={referenceUrl} selectedLayer={editFormat === 'horizontal' ? selectedLayer : ''} onSelectLayer={(id, format) => { setSelectedLayer(id); setEditFormat(format); }} onLayoutChange={changeLayout} /></div>}
              {formats.vertical && <div className="mx-auto max-w-[360px]"><div className="mb-2 flex items-center justify-between text-xs"><strong>Vertical 1080×1920</strong><button type="button" disabled={exporting || saving} onClick={() => downloadOne('vertical')} className="text-sky-300">Baixar PNG</button></div><ThumbnailCanvas ref={verticalRef} draft={draft} format="vertical" simers={tab === 'Padrão SIMERS'} referenceUrl={referenceUrl} selectedLayer={editFormat === 'vertical' ? selectedLayer : ''} onSelectLayer={(id, format) => { setSelectedLayer(id); setEditFormat(format); }} onLayoutChange={changeLayout} /></div>}
              <button type="button" disabled={exporting || (!formats.horizontal && !formats.vertical)} onClick={exportSelected} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 py-3 text-sm font-extrabold text-slate-950 disabled:opacity-40"><Download size={17} /> {exporting ? 'Gerando…' : 'Baixar imagens selecionadas'}</button>
              <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="w2-button" disabled={saving || exporting} onClick={() => saveThumb()}>Salvar rascunho</button><button type="button" className="w2-button" disabled={saving || exporting} onClick={() => saveThumb(true)}>Salvar imagens no projeto</button><button type="button" className="w2-button disabled:opacity-40" disabled={saving || exporting || !draft.projectId} onClick={() => saveThumb(true, true)}>Salvar e definir capa do projeto</button></div>
              {saving && <p className="mt-2 text-xs">Salvando versão e arquivos…</p>}
              {notice && <p className="mt-2 text-center text-xs text-sky-300">{notice}</p>}
            </section>
          </main>

          <aside className="space-y-4">
            <ThumbnailAISettings />
            <section className="mm-panel"><h2 className="font-bold">Dados do sistema</h2>{selectedProject ? <><p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-300"><CheckCircle2 size={14} /> Dados carregados do MediaMind</p><dl className="mt-3 grid grid-cols-[82px_1fr] gap-y-2 text-xs"><dt className="text-slate-500">Projeto</dt><dd>{selectedProject.titulo || selectedProject.title}</dd><dt className="text-slate-500">Programa</dt><dd>{selectedProject.programa || 'Não informado'}</dd><dt className="text-slate-500">Episódio</dt><dd>{selectedProject.episodio || 'Não informado'}</dd><dt className="text-slate-500">Roteiro</dt><dd>{matchingScript ? 'Encontrado' : (selectedProject.pauta ? 'Planejamento do projeto' : 'Não integrado')}</dd><dt className="text-slate-500">Pessoas</dt><dd>{draft.people.length}</dd><dt className="text-slate-500">Fotos</dt><dd>{relatedAssets.length}</dd></dl><Link to={`/corp?tab=producao&sub=${selectedProject.etapa || 'overview'}`} className="mt-4 block rounded-xl border border-slate-700 py-2 text-center text-xs font-bold text-sky-300">Abrir episódio</Link></> : <><p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-sky-300"><CheckCircle2 size={14} /> Criação nova</p><p className="mt-2 text-xs text-slate-500">Escolha tudo manualmente ou carregue um conteúdo do MediaMind. O registro original não será alterado.</p></>}{dataError && <p className="mt-3 rounded-lg bg-rose-950/30 p-2 text-xs text-rose-300">{dataError}</p>}</section>

            <section className="mm-panel"><div className="flex items-center justify-between gap-3"><h2 className="font-bold">Fotos / mídias</h2><label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-sky-800 px-2.5 py-1.5 text-[11px] font-bold text-sky-300"><ImagePlus size={14} /> Enviar foto<input type="file" accept="image/*" className="hidden" aria-label="Adicionar foto local" onChange={(event) => { addPhoto(event.target.files?.[0]); event.target.value = ''; }} /></label></div><div className="mt-3 grid grid-cols-2 gap-2">{[...draft.photos, ...relatedAssets.filter((asset) => !draft.photos.some((photo) => photo.id === String(asset.id))).map((asset) => ({ id: String(asset.id), name: asset.title || asset.filename || 'Imagem', url: resolveMediaUrl(asset.stream_url || asset.file_url || ''), selected: false, source: 'Acervo' }))].map((photo) => <button type="button" key={photo.id} onClick={() => useAssetPhoto(photo)} className={`overflow-hidden rounded-xl border text-left ${photo.selected ? 'border-sky-400' : 'border-slate-800'}`}><div className="aspect-video bg-slate-950">{photo.url && <img src={photo.url} alt="" className="h-full w-full object-cover" />}</div><span className="block truncate p-2 text-[10px]">{photo.name}</span></button>)}</div>{!relatedAssets.length && !draft.photos.length && <p className="mt-3 text-xs text-slate-500">Nenhuma imagem relacionada encontrada.</p>}</section>

            <section className="mm-panel"><h2 className="font-bold">Validação SIMERS</h2><ul className="mt-3 space-y-2 text-xs">{validation.length ? validation.map((issue) => <li key={issue} className="flex gap-2 text-amber-300"><Info size={14} className="shrink-0" />{issue}</li>) : <li className="flex gap-2 text-emerald-300"><CheckCircle2 size={14} />Campos essenciais preenchidos</li>}<li className="flex gap-2 text-slate-400"><CheckCircle2 size={14} className="shrink-0" />Fundo contínuo, sem barra ou caixa de texto</li><li className="flex gap-2 text-slate-400"><CheckCircle2 size={14} className="shrink-0" />Horizontal e vertical têm composições próprias</li>{preset && !preset.defined && <li className="flex gap-2 text-amber-300"><Info size={14} />Padrão do programa ainda não definido</li>}</ul></section>
          </aside>
        </div>
      )}</>}

      <section className="mm-panel"><h2 className="font-bold">Thumbs salvas / versões do projeto</h2><p className="mt-1 text-xs text-slate-400">Composições editáveis e arquivos reutilizáveis. Cópias mantêm referência à origem.</p><div className="mt-3 space-y-2">{savedThumbs.filter((r) => !draft.projectId || String(r.project_id) === draft.projectId).map((r) => <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 p-2 text-xs"><span className="min-w-0 flex-1">{r.title} · v{r.revision} · {r.program}</span><button type="button" className="text-sky-300" onClick={() => openSaved(r)}>Reabrir</button><button type="button" className="text-sky-300" onClick={() => openSaved(r, true)}>Duplicar para reutilizar</button>{r.exports?.map((e) => <a key={e.assetId} href={resolveMediaUrl(e.url)} target="_blank" rel="noreferrer" className="text-emerald-300">PNG {e.format}</a>)}</div>)}</div>{!savedThumbs.length && <p className="mt-3 text-xs text-slate-500">Nenhuma thumb salva ainda.</p>}</section>

      {programPickerOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label="Escolher programa"><section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl"><header className="flex items-start justify-between"><div><h2 className="text-xl font-extrabold">Nova thumb</h2><p className="mt-1 text-sm text-slate-400">Padrões SIMERS disponíveis. Confira os assets oficiais de cada programa. As cores abaixo são aplicadas sem substituições.</p></div><button type="button" aria-label="Fechar escolha de programa" onClick={() => setProgramPickerOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"><X size={20} /></button></header><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{SIMERS_PROGRAMS.map((name) => { const colors = presetFor(name); return <button type="button" key={name} aria-label={name} onClick={() => startNewThumb(name)} className="overflow-hidden rounded-xl border border-slate-800 text-left transition hover:-translate-y-0.5 hover:border-sky-400"><span className="block h-20 p-3" style={{ background: colors.background, color: colors.text }}><strong className="text-sm">{name}</strong><small className="mt-1 block opacity-70">{colors.background} · {colors.text}</small></span></button>; })}</div></section></div>}

      {guideOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label="Guia do padrão SIMERS"><section className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl"><header className="flex items-start justify-between"><div><h2 className="text-xl font-extrabold">Guia do padrão SIMERS</h2><p className="text-sm text-slate-400">Paletas e regras aplicadas pelo Thumbnail Studio.</p></div><button type="button" aria-label="Fechar guia" onClick={() => setGuideOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"><X size={20} /></button></header><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(SIMERS_PRESETS).map(([name, colors]) => <article key={name} className="rounded-xl border border-slate-800 p-3"><div className="mb-2 flex h-16 overflow-hidden rounded-lg">{colors.defined ? <><span className="flex-1" style={{ background: colors.background }} /><span className="w-1/3" style={{ background: colors.accent || colors.text }} /></> : <span className="grid flex-1 place-items-center bg-slate-900 text-xs text-slate-500">Não definido</span>}</div><strong className="text-sm">{name}</strong>{colors.defined && <p className="mt-1 font-mono text-[10px] text-slate-500">{[colors.background, colors.text, colors.accent].filter(Boolean).join(' · ')}</p>}</article>)}</div><div className="mt-5 grid gap-4 md:grid-cols-2"><div className="rounded-xl bg-slate-900 p-4"><h3 className="font-bold">Hierarquia e formatos</h3><p className="mt-2 text-sm leading-6 text-slate-400">Chamada principal &gt; nomes &gt; programa • episódio. Horizontal 1920×1080 e vertical 1080×1920 com composição própria.</p></div><div className="rounded-xl bg-slate-900 p-4"><h3 className="font-bold">Não fazer</h3><p className="mt-2 text-sm leading-6 text-slate-400">Não usar barras brancas, rodapés, tarjas ou caixas atrás do texto. Não repetir episódio, não excluir pessoas automaticamente e não alterar rostos.</p></div></div></section></div>}
    </div>
  );
}
