import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, CheckCircle2, ChevronDown, ChevronUp, Download, ImagePlus, Info, Layers3, Plus, Sparkles, Upload, UserPlus, X,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { listMediaAssets } from '@/api/media';
import { useProducaoProjetos } from '../lib/producaoStore';
import {
  DEFAULT_COLORS, SIMERS_PRESETS, SIMERS_PROGRAMS, createThumbnailDraft, presetFor, suggestHighlight, validateSimersDraft,
} from '../lib/thumbnailStudio';
import { exportThumbnailElement } from '../lib/thumbnailExport';
import { createLocalCutout } from '../lib/thumbnailImage';
import ThumbnailCanvas from '../components/thumbnails/ThumbnailCanvas';

const TABS = ['Padrão SIMERS', 'Usar Referência', 'Criação Livre', 'Outros Templates'];

function Field({ label, children }) {
  return <label className="block text-xs font-bold text-slate-300"><span className="mb-1.5 block">{label}</span>{children}</label>;
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
    });
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
      ? { ...item, draft: typeof value === 'function' ? value(item.draft) : value }
      : item));
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
    Promise.all([
      base44.entities.Project.list('-created_date', 200).catch(() => []),
      base44.entities.Script.list('-created_date', 200).catch(() => []),
      listMediaAssets(),
    ]).then(([foundProjects, foundScripts, foundAssets]) => {
      if (!live) return;
      setCatalogProjects(Array.isArray(foundProjects) ? foundProjects : []);
      setScripts(Array.isArray(foundScripts) ? foundScripts : []);
      setAssets(Array.isArray(foundAssets) ? foundAssets : []);
    }).catch(() => {
      if (live) setDataError('O acervo está indisponível. Você ainda pode criar e enviar fotos localmente.');
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!manualCreation && projects[0] && (!draft.projectId || !projects.some((project) => String(project.id) === draft.projectId))) {
      const sameTitle = projects.find((project) => (project.titulo || project.title) === draft.title);
      selectProject(String((sameTitle || projects[0]).id));
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
    const next = createThumbnailDraft(project || {});
    const projectAssets = assets.filter((asset) => asset.asset_type === 'image' && (!asset.project_id || String(asset.project_id) === String(projectId)));
    next.photos = projectAssets.map((asset, index) => ({ id: String(asset.id), name: asset.title || asset.filename || 'Imagem do acervo', url: asset.stream_url || asset.file_url || '', selected: index === 0, source: 'Acervo' }));
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
    setDraft((current) => ({ ...current, people: [...current.people, { id, name: 'Nova pessoa', role: '', visible: true, showName: true, photo: '', source: 'Manual' }] }));
  }

  async function addPersonFromPhoto(file) {
    if (!file) return;
    const id = `manual-photo-${Date.now()}`;
    const fallbackName = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Nova pessoa';
    const name = fallbackName.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
    const originalPhoto = fileUrl(file);
    setDraft((current) => ({
      ...current,
      people: [...current.people, {
        id, name, role: '', visible: true, showName: false, photo: originalPhoto, originalPhoto, cutoutStatus: 'processing', source: 'Upload local',
      }],
    }));
    try {
      const photo = await createLocalCutout(file);
      updatePerson(id, { photo, cutoutPhoto: photo, cutoutStatus: 'done', useOriginal: false });
    } catch {
      updatePerson(id, { photo: originalPhoto, cutoutStatus: 'failed' });
    }
  }

  async function replacePersonPhoto(id, file) {
    if (!file) return;
    const originalPhoto = fileUrl(file);
    updatePerson(id, { photo: originalPhoto, originalPhoto, cutoutStatus: 'processing', useOriginal: true });
    try {
      const cutoutPhoto = await createLocalCutout(file);
      updatePerson(id, { photo: cutoutPhoto, cutoutPhoto, cutoutStatus: 'done', useOriginal: false });
    } catch {
      updatePerson(id, { photo: originalPhoto, cutoutStatus: 'failed', useOriginal: true });
    }
  }

  function addPhoto(file) {
    if (!file) return;
    const url = fileUrl(file);
    setDraft((current) => ({ ...current, photos: [...current.photos.map((photo) => ({ ...photo, selected: false })), { id: `upload-${Date.now()}`, name: file.name, url, selected: true, source: 'Upload local' }] }));
  }

  function applyProgram(program) {
    const colors = presetFor(program);
    setDraft((current) => ({ ...current, program, colors: colors?.defined ? { ...DEFAULT_COLORS, ...colors } : { ...DEFAULT_COLORS } }));
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
          const label = item.draft.title || item.draft.highlight || `Thumb ${String(index + 1).padStart(2, '0')}`;
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
              {tab === 'Padrão SIMERS' && preset?.defined && <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><div className="flex items-center justify-between"><strong className="text-xs">Padrão aplicado</strong><span className="text-[10px] text-emerald-300">SIMERS</span></div><div className="mt-3 grid grid-cols-3 gap-2">{[['Fundo', draft.colors.background], ['Texto', draft.colors.text], ['Destaque', draft.colors.accent]].map(([name, color]) => <div key={name}><span className="block h-7 rounded-lg border border-white/10" style={{ background: color }} /><small className="mt-1 block text-[9px] text-slate-500">{name}<br/>{color}</small></div>)}</div><p className="mt-3 text-[10px] text-slate-500">Chamada: Anton · nomes e metadados: Montserrat</p></div>}
              {draft.program && !preset?.defined && <p className="rounded-xl border border-amber-700/60 bg-amber-950/30 p-3 text-xs text-amber-200">{draft.program === 'No Front' ? 'O padrão de No Front ainda não está definido. Use Criação Livre ou uma referência aprovada.' : `${draft.program} não possui preset SIMERS aprovado nesta tela. Nenhuma paleta de outro programa será aplicada.`}</p>}
              <Field label="Episódio"><input aria-label="Episódio" className={control} value={draft.episode} onChange={(event) => update('episode', event.target.value)} /></Field>
              <Field label="Título principal"><textarea aria-label="Título principal" rows={2} className={control} value={draft.title} onChange={(event) => update('title', event.target.value)} /></Field>
              <Field label="Descrição / contexto"><textarea aria-label="Descrição / contexto" rows={3} className={control} value={draft.description} onChange={(event) => update('description', event.target.value)} /></Field>
              <Field label="Chamada / frase de destaque"><textarea aria-label="Chamada / frase de destaque" rows={2} className={control} value={draft.highlight} onChange={(event) => update('highlight', event.target.value)} /></Field>
              <button type="button" onClick={() => update('highlight', suggestHighlight(draft))} className="w2-button w-full justify-center"><Sparkles size={15} /> Sugerir a partir do título</button>
              {tab === 'Usar Referência' && <Field label="Imagem de referência"><input aria-label="Imagem de referência" type="file" accept="image/*" className={control} onChange={(event) => setReferenceUrl(fileUrl(event.target.files?.[0]))} /></Field>}
              {tab === 'Criação Livre' && <Field label="Orientação da composição"><textarea aria-label="Orientação da composição" rows={3} className={control} value={orientation} onChange={(event) => setOrientation(event.target.value)} placeholder="Ex.: pessoa à direita, chamada curta e alto contraste" /></Field>}
            </section>

            <section className="mm-panel space-y-3">
              <div className="flex items-center justify-between"><h2 className="font-bold">Pessoas na capa</h2><button type="button" onClick={addManualPerson} className="text-sky-300" aria-label="Adicionar pessoa"><UserPlus size={17} /></button></div>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-sky-700 bg-sky-950/20 px-3 py-2.5 text-xs font-bold text-sky-300 transition hover:bg-sky-950/40"><Upload size={15} /> Adicionar pessoa com foto<input type="file" accept="image/*" className="hidden" aria-label="Adicionar pessoa com foto" onChange={(event) => { addPersonFromPhoto(event.target.files?.[0]); event.target.value = ''; }} /></label>
              {draft.people.map((person) => <div key={person.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><div className="flex gap-3"><label className="grid h-12 w-12 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full bg-slate-800 text-xs font-bold text-slate-400">{person.photo ? <img src={person.photo} alt="" className="h-full w-full object-cover grayscale" /> : <Upload size={16} />}<input type="file" accept="image/*" className="hidden" aria-label={`Trocar foto de ${person.name}`} onChange={(event) => { replacePersonPhoto(person.id, event.target.files?.[0]); event.target.value = ''; }} /></label><div className="min-w-0 flex-1"><input aria-label={`Nome de ${person.name}`} className="w-full bg-transparent text-sm font-bold outline-none" value={person.name} onChange={(event) => updatePerson(person.id, { name: event.target.value })} /><input aria-label={`Papel de ${person.name}`} className="mt-1 w-full bg-transparent text-xs text-slate-500 outline-none" value={person.role} onChange={(event) => updatePerson(person.id, { role: event.target.value })} />{person.cutoutStatus === 'processing' && <small className="mt-1 block text-sky-300">Recortando fundo…</small>}{person.cutoutStatus === 'failed' && <small className="mt-1 block text-amber-300">Foto original mantida; envie PNG transparente para recorte perfeito.</small>}{person.cutoutPhoto && person.originalPhoto && <button type="button" className="mt-1 text-[10px] font-bold text-sky-300" onClick={() => updatePerson(person.id, person.useOriginal ? { photo: person.cutoutPhoto, useOriginal: false } : { photo: person.originalPhoto, useOriginal: true })}>{person.useOriginal ? 'Usar recorte automático' : 'Comparar com foto original'}</button>}</div></div><div className="mt-3 flex gap-4 text-xs"><label><input type="checkbox" checked={person.visible} onChange={(event) => updatePerson(person.id, { visible: event.target.checked })} /> <span className="ml-1">Aparecer</span></label><label><input type="checkbox" checked={person.showName} onChange={(event) => updatePerson(person.id, { showName: event.target.checked })} /> <span className="ml-1">Mostrar nome</span></label></div></div>)}
              {!draft.people.length && <p className="text-xs text-slate-500">Nenhuma pessoa associada. Adicione manualmente se necessário.</p>}
            </section>
          </aside>

          <main className="space-y-4">
            <section className="mm-panel">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">Preview</h2><p className="text-xs text-slate-500">Composições próprias por formato — não é recorte automático.</p></div><div className="flex gap-3 text-xs"><label><input type="checkbox" checked={formats.horizontal} onChange={(event) => setFormats((value) => ({ ...value, horizontal: event.target.checked }))} /> <span className="ml-1">Horizontal</span></label><label><input type="checkbox" checked={formats.vertical} onChange={(event) => setFormats((value) => ({ ...value, vertical: event.target.checked }))} /> <span className="ml-1">Vertical</span></label></div></div>
              {formats.horizontal && <div className="mb-4"><div className="mb-2 flex items-center justify-between text-xs"><strong>Horizontal 1920×1080</strong><button type="button" onClick={() => exportThumbnailElement(horizontalRef.current, { width: 1920, height: 1080, filename: 'thumb-horizontal.png' })} className="text-sky-300">Baixar PNG</button></div><ThumbnailCanvas ref={horizontalRef} draft={draft} format="horizontal" simers={tab === 'Padrão SIMERS'} referenceUrl={referenceUrl} /></div>}
              {formats.vertical && <div className="mx-auto max-w-[360px]"><div className="mb-2 flex items-center justify-between text-xs"><strong>Vertical 1080×1920</strong><button type="button" onClick={() => exportThumbnailElement(verticalRef.current, { width: 1080, height: 1920, filename: 'thumb-vertical.png' })} className="text-sky-300">Baixar PNG</button></div><ThumbnailCanvas ref={verticalRef} draft={draft} format="vertical" simers={tab === 'Padrão SIMERS'} referenceUrl={referenceUrl} /></div>}
              <button type="button" disabled={exporting || (!formats.horizontal && !formats.vertical)} onClick={exportSelected} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 py-3 text-sm font-extrabold text-slate-950 disabled:opacity-40"><Download size={17} /> {exporting ? 'Gerando…' : 'Baixar imagens selecionadas'}</button>
              {notice && <p className="mt-2 text-center text-xs text-sky-300">{notice}</p>}
            </section>
          </main>

          <aside className="space-y-4">
            <section className="mm-panel"><h2 className="font-bold">Dados do sistema</h2>{selectedProject ? <><p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-300"><CheckCircle2 size={14} /> Dados carregados do MediaMind</p><dl className="mt-3 grid grid-cols-[82px_1fr] gap-y-2 text-xs"><dt className="text-slate-500">Projeto</dt><dd>{selectedProject.titulo || selectedProject.title}</dd><dt className="text-slate-500">Programa</dt><dd>{selectedProject.programa || 'Não informado'}</dd><dt className="text-slate-500">Episódio</dt><dd>{selectedProject.episodio || 'Não informado'}</dd><dt className="text-slate-500">Roteiro</dt><dd>{matchingScript ? 'Encontrado' : (selectedProject.pauta ? 'Planejamento do projeto' : 'Não integrado')}</dd><dt className="text-slate-500">Pessoas</dt><dd>{draft.people.length}</dd><dt className="text-slate-500">Fotos</dt><dd>{relatedAssets.length}</dd></dl><Link to={`/corp?tab=producao&sub=${selectedProject.etapa || 'overview'}`} className="mt-4 block rounded-xl border border-slate-700 py-2 text-center text-xs font-bold text-sky-300">Abrir episódio</Link></> : <><p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-sky-300"><CheckCircle2 size={14} /> Criação nova</p><p className="mt-2 text-xs text-slate-500">Escolha tudo manualmente ou carregue um conteúdo do MediaMind. O registro original não será alterado.</p></>}{dataError && <p className="mt-3 rounded-lg bg-rose-950/30 p-2 text-xs text-rose-300">{dataError}</p>}</section>

            <section className="mm-panel"><div className="flex items-center justify-between gap-3"><h2 className="font-bold">Fotos / mídias</h2><label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-sky-800 px-2.5 py-1.5 text-[11px] font-bold text-sky-300"><ImagePlus size={14} /> Enviar foto<input type="file" accept="image/*" className="hidden" aria-label="Adicionar foto local" onChange={(event) => { addPhoto(event.target.files?.[0]); event.target.value = ''; }} /></label></div><div className="mt-3 grid grid-cols-2 gap-2">{[...draft.photos, ...relatedAssets.filter((asset) => !draft.photos.some((photo) => photo.id === String(asset.id))).map((asset) => ({ id: String(asset.id), name: asset.title || asset.filename || 'Imagem', url: asset.stream_url || '', selected: false, source: 'Acervo' }))].map((photo) => <button type="button" key={photo.id} onClick={() => setDraft((current) => ({ ...current, photos: [...current.photos.filter((item) => item.id !== photo.id).map((item) => ({ ...item, selected: false })), { ...photo, selected: true }] }))} className={`overflow-hidden rounded-xl border text-left ${photo.selected ? 'border-sky-400' : 'border-slate-800'}`}><div className="aspect-video bg-slate-950">{photo.url && <img src={photo.url} alt="" className="h-full w-full object-cover" />}</div><span className="block truncate p-2 text-[10px]">{photo.name}</span></button>)}</div>{!relatedAssets.length && !draft.photos.length && <p className="mt-3 text-xs text-slate-500">Nenhuma imagem relacionada encontrada.</p>}</section>

            <section className="mm-panel"><h2 className="font-bold">Validação SIMERS</h2><ul className="mt-3 space-y-2 text-xs">{validation.length ? validation.map((issue) => <li key={issue} className="flex gap-2 text-amber-300"><Info size={14} className="shrink-0" />{issue}</li>) : <li className="flex gap-2 text-emerald-300"><CheckCircle2 size={14} />Campos essenciais preenchidos</li>}<li className="flex gap-2 text-slate-400"><CheckCircle2 size={14} className="shrink-0" />Fundo contínuo, sem barra ou caixa de texto</li><li className="flex gap-2 text-slate-400"><CheckCircle2 size={14} className="shrink-0" />Horizontal e vertical têm composições próprias</li>{preset && !preset.defined && <li className="flex gap-2 text-amber-300"><Info size={14} />Padrão do programa ainda não definido</li>}</ul></section>
          </aside>
        </div>
      )}</>}

      {programPickerOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label="Escolher programa"><section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl"><header className="flex items-start justify-between"><div><h2 className="text-xl font-extrabold">Nova thumb</h2><p className="mt-1 text-sm text-slate-400">Dez padrões SIMERS aprovados. As cores abaixo são aplicadas sem substituições.</p></div><button type="button" aria-label="Fechar escolha de programa" onClick={() => setProgramPickerOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"><X size={20} /></button></header><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{SIMERS_PROGRAMS.map((name) => { const colors = presetFor(name); return <button type="button" key={name} aria-label={name} onClick={() => startNewThumb(name)} className="overflow-hidden rounded-xl border border-slate-800 text-left transition hover:-translate-y-0.5 hover:border-sky-400"><span className="block h-20 p-3" style={{ background: colors.background, color: colors.text }}><strong className="text-sm">{name}</strong><small className="mt-1 block opacity-70">{colors.background} · {colors.text}</small></span></button>; })}</div></section></div>}

      {guideOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label="Guia do padrão SIMERS"><section className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl"><header className="flex items-start justify-between"><div><h2 className="text-xl font-extrabold">Guia do padrão SIMERS</h2><p className="text-sm text-slate-400">Paletas e regras aplicadas pelo Thumbnail Studio.</p></div><button type="button" aria-label="Fechar guia" onClick={() => setGuideOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"><X size={20} /></button></header><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(SIMERS_PRESETS).map(([name, colors]) => <article key={name} className="rounded-xl border border-slate-800 p-3"><div className="mb-2 flex h-16 overflow-hidden rounded-lg">{colors.defined ? <><span className="flex-1" style={{ background: colors.background }} /><span className="w-1/3" style={{ background: colors.accent || colors.text }} /></> : <span className="grid flex-1 place-items-center bg-slate-900 text-xs text-slate-500">Não definido</span>}</div><strong className="text-sm">{name}</strong>{colors.defined && <p className="mt-1 font-mono text-[10px] text-slate-500">{[colors.background, colors.text, colors.accent].filter(Boolean).join(' · ')}</p>}</article>)}</div><div className="mt-5 grid gap-4 md:grid-cols-2"><div className="rounded-xl bg-slate-900 p-4"><h3 className="font-bold">Hierarquia e formatos</h3><p className="mt-2 text-sm leading-6 text-slate-400">Chamada principal &gt; nomes &gt; programa • episódio. Horizontal 1920×1080 e vertical 1080×1920 com composição própria.</p></div><div className="rounded-xl bg-slate-900 p-4"><h3 className="font-bold">Não fazer</h3><p className="mt-2 text-sm leading-6 text-slate-400">Não usar barras brancas, rodapés, tarjas ou caixas atrás do texto. Não repetir episódio, não excluir pessoas automaticamente e não alterar rostos.</p></div></div></section></div>}
    </div>
  );
}
