import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, Plus, Save, Trash2, Upload } from 'lucide-react';
import { createCarouselDocument, parseCarouselImport } from '../../lib/carouselDocument';
import { approveCreativeDocument, createCreativeDocument, creativeExportDownloadUrl, listCreativeDocuments, updateCreativeDocument, uploadCreativeExport } from '../../lib/creativeToolsApi';
import { buildCarouselZip } from '../../lib/carouselExport';
import { useProducaoProjetos } from '../../lib/producaoStore';
import CarouselSlideCanvas from './CarouselSlideCanvas';

export default function CarouselStudio({ projectId = null }) {
  const projects = useProducaoProjetos();
  const project = projects.find((item) => String(item.id) === String(projectId));
  const initial = useMemo(() => createCarouselDocument({ project }), [project]);
  const [document, setDocument] = useState(initial);
  const [record, setRecord] = useState(null);
  const [status, setStatus] = useState('Rascunho local');
  const [importText, setImportText] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    listCreativeDocuments('carousel').then((items) => {
      if (!active || !items?.length) return;
      setRecord(items[0]); setDocument(items[0].content); setStatus(`Salvo · revisão ${items[0].revision}`);
    }).catch(() => { if (active) setMessage('API indisponível; o rascunho ainda não foi salvo.'); });
    return () => { active = false; };
  }, []);

  function patch(field, value) { setDocument((current) => ({ ...current, [field]: value })); setStatus('Alterações não salvas'); }
  function patchSlide(index, field, value) {
    setDocument((current) => ({ ...current, slides: current.slides.map((slide, i) => i === index ? { ...slide, [field]: value } : slide) }));
    setStatus('Alterações não salvas');
  }
  function addSlide() {
    setDocument((current) => ({ ...current, slides: [...current.slides, { id: crypto.randomUUID(), type: 'content', title: 'Novo slide', body: '', badge: '', action: '', image: null }] }));
    setStatus('Alterações não salvas');
  }
  async function save() {
    setMessage('');
    try {
      const saved = record
        ? await updateCreativeDocument(record.id, { content: document })
        : await createCreativeDocument({ tool_type: 'carousel', content: document });
      setRecord(saved); setDocument(saved.content); setStatus(`Salvo · revisão ${saved.revision}`);
    } catch (error) { setMessage(error.message || 'Não foi possível salvar.'); setStatus('Não salvo'); }
  }
  async function approve() {
    if (!record) { setMessage('Salve o carrossel antes de aprovar.'); return; }
    try {
      const approved = await approveCreativeDocument(record.id);
      setRecord(approved); setStatus(`Aprovado · revisão ${approved.revision}`); setMessage('Revisão aprovada.');
    } catch (error) { setMessage(error.message || 'Não foi possível aprovar.'); }
  }
  async function exportZip() {
    if (!record) { setMessage('Salve o carrossel antes de exportar.'); return; }
    setStatus('Gerando exportação…');
    try {
      const elements = [...window.document.querySelectorAll('[data-carousel-slide]')];
      const blob = await buildCarouselZip(document, elements);
      const exported = await uploadCreativeExport(record.id, record.revision, document.format, blob);
      const link = window.document.createElement('a');
      link.href = creativeExportDownloadUrl(exported.id); link.download = 'carrossel.zip'; link.click();
      setStatus(`Exportado · revisão ${record.revision}`); setMessage('ZIP com PNGs e JSON registrado no histórico.');
    } catch (error) { setStatus('Falha na exportação'); setMessage(error.message || 'Não foi possível exportar.'); }
  }
  function importJson() {
    try { const parsed = parseCarouselImport(importText, document); setDocument(parsed.document); setMessage(parsed.warnings.join(' ')); setStatus('Alterações não salvas'); }
    catch (error) { setMessage(error.message); }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-2xl font-bold text-white">Carrossel IA</h2><p className="mt-1 text-sm text-slate-400">Documento editável vinculado ao acervo e à produção.</p></div>
        <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">{status}</span><button onClick={save} className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-slate-950"><Save size={16}/>Salvar</button><button onClick={approve} className="flex items-center gap-2 rounded-xl border border-emerald-500/40 px-4 py-2 text-sm text-emerald-300"><CheckCircle2 size={16}/>Aprovar</button><button onClick={exportZip} className="flex items-center gap-2 rounded-xl border border-violet-500/40 px-4 py-2 text-sm text-violet-300"><Download size={16}/>Exportar ZIP</button></div>
      </div>
      {message && <div role="status" className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">{message}</div>}
      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <label className="block text-xs font-semibold text-slate-400">Título do carrossel<input aria-label="Título do carrossel" value={document.title} onChange={(e) => patch('title', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label>
          <label className="block text-xs font-semibold text-slate-400">Formato<select value={document.format} onChange={(e) => patch('format', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"><option>4:5</option><option>1:1</option></select></label>
          <button onClick={addSlide} className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-500/40 px-3 py-2 text-sm text-sky-300"><Plus size={16}/>Adicionar slide</button>
          <div className="border-t border-slate-800 pt-4"><label className="text-xs font-semibold text-slate-400">Importar JSON<textarea aria-label="JSON do carrossel" value={importText} onChange={(e) => setImportText(e.target.value)} rows={6} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-slate-200" /></label><button onClick={importJson} className="mt-2 flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-sm text-white"><Upload size={15}/>Importar</button></div>
          <label className="block text-xs font-semibold text-slate-400">Legenda<textarea value={document.caption} onChange={(e) => patch('caption', e.target.value)} rows={4} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white" /></label>
        </div>
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {document.slides.length === 0 && <button onClick={addSlide} className="min-h-80 rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 text-slate-400">Adicione um slide ou importe um JSON</button>}
          {document.slides.map((slide, index) => <div key={slide.id} className="space-y-2"><CarouselSlideCanvas slide={slide} format={document.format} index={index}/><input value={slide.title} onChange={(e) => patchSlide(index, 'title', e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"/><textarea value={slide.body} onChange={(e) => patchSlide(index, 'body', e.target.value)} rows={3} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"/><button aria-label={`Remover slide ${index + 1}`} onClick={() => patch('slides', document.slides.filter((_, i) => i !== index))} className="text-slate-500 hover:text-red-300"><Trash2 size={15}/></button></div>)}
        </div>
      </div>
    </section>
  );
}
