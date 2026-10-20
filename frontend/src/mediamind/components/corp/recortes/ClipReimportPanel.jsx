import React, { useState, useEffect } from 'react';
import { Upload, CheckCircle2, Send, FileVideo, FileText, History, Loader2, Check, Download } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { exportMediaClip } from '../../../../api/media';
import { useAuth } from '../../../auth';
import { useEmpresa } from '../../../lib/empresaContext';
import { baixarXmlPremiereClip, baixarSrtClip, baixarTexto } from '../../../lib/premiereXml';
import { createVersion, listVersions, setCurrentVersion } from '../../../lib/clipEngineService';
import { fmt } from './clipModel';
import { EXPORT_PRESETS, buildClipRenderOptions, captionsToVtt, DEFAULT_CAPTION_SETTINGS } from '../../../lib/captionTools';

const isRealClipId = (id) => !!id && !String(id).startsWith('clip-');

// Reimportar: exporta o corte (Premiere XML + SRT), recebe a versão editada e
// versiona — cada reimport vira uma ClipVersion (não destrutiva). Sem id real
// (clip de demonstração), opera só localmente.
export default function ClipReimportPanel({ clip, onChange, onProsseguir, onEnsureAsset }) {
  const { user } = useAuth();
  const { current: empresaId, isGlobal } = useEmpresa();
  const [url, setUrl] = useState(clip.edited_url || '');
  const [label, setLabel] = useState('');
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [download, setDownload] = useState(null);
  const [aspect, setAspect] = useState(clip.formato || '');
  const [burnCaptions, setBurnCaptions] = useState((clip.legendas || []).length > 0);
  const [burnTitles, setBurnTitles] = useState((clip.cgs || []).some((layer) => layer.tipo === 'titulo'));
  const [applyCuts, setApplyCuts] = useState((clip.cortes_video || []).length > 0);
  const eid = isGlobal ? '' : empresaId;
  const realId = isRealClipId(clip.id);

  async function loadVersions() {
    if (!realId) return;
    try { setVersions(await listVersions(clip.id)); } catch { /* silencioso */ }
  }
  useEffect(() => { loadVersions(); /* eslint-disable-next-line */ }, [clip.id]);
  useEffect(() => () => { if (download?.url) URL.revokeObjectURL(download.url); }, [download]);

  async function exportMp4() {
    if ((!clip.source_asset_id && !onEnsureAsset) || clip.out_ms <= clip.in_ms) return;
    setExporting(true);
    setExportError('');
    try {
      const assetId = clip.source_asset_id || await onEnsureAsset();
      if (!assetId) throw new Error('Não foi possível enviar o vídeo de origem.');
      const renderOptions = buildClipRenderOptions(clip, { aspect, burnCaptions, burnTitles, applyCuts });
      const result = await exportMediaClip({ asset_id: assetId, source_in: clip.in_ms / 1000, duration: (clip.out_ms - clip.in_ms) / 1000, properties: renderOptions ? { clip_render: renderOptions } : {} });
      setDownload({ url: URL.createObjectURL(result.blob), filename: result.filename, clipId: clip.id, inMs: clip.in_ms, outMs: clip.out_ms, optionsKey: JSON.stringify(renderOptions) });
    } catch (error) {
      setExportError(error.message || 'Não foi possível gerar o MP4.');
    } finally { setExporting(false); }
  }

  async function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      setLoading(true);
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file: f });
      setUrl(file_url);
    } finally { setLoading(false); }
  }

  async function aplicar() {
    if (!url) return;
    onChange({ edited_url: url, pronto: true });
    if (realId) {
      try {
        setSaving(true);
        const ver = await createVersion(clip.id, {
          edited_url: url, version_label: label, empresaId: eid, authorName: user?.name || user?.email || '',
        });
        setLabel('');
        await loadVersions();
        onChange({ current_version_id: ver.id });
      } catch (e) { /* versão não crítica — o edited_url já está setado */ }
      finally { setSaving(false); }
    }
  }

  async function trocarVersao(vId) {
    if (!realId) return;
    try {
      const v = await setCurrentVersion(clip.id, vId);
      setUrl(v.edited_url || '');
      onChange({ edited_url: v.edited_url || '', current_version_id: v.id, pronto: !!v.edited_url });
      await loadVersions();
    } catch { /* */ }
  }

  const currentOptionsKey = JSON.stringify(buildClipRenderOptions(clip, { aspect, burnCaptions, burnTitles, applyCuts }));

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Exportação real */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        <p className="text-xs text-slate-400">Exporte um projeto XML ou as legendas SRT para edição externa e reconecte a mídia master. Os intervalos removidos na prévia, o reenquadramento e a aparência das camadas ainda não estão garantidos no arquivo exportado; revise o resultado no editor externo.</p>
        <div className="mt-3 grid gap-2 text-[10px] text-slate-400 md:grid-cols-2" aria-label="Opções do MP4">
          <label>Formato do MP4<select aria-label="Formato do MP4" value={aspect} onChange={(e) => setAspect(e.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-slate-200"><option value="">Original (1280×720)</option>{EXPORT_PRESETS.map((preset) => <option key={preset.id} value={preset.aspect}>{preset.label}</option>)}</select></label>
          <div className="flex flex-col justify-end gap-1">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={burnCaptions} disabled={!(clip.legendas || []).length} onChange={(e) => setBurnCaptions(e.target.checked)} />Gravar legendas no vídeo</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={burnTitles} disabled={!(clip.cgs || []).some((layer) => layer.tipo === 'titulo')} onChange={(e) => setBurnTitles(e.target.checked)} />Gravar textos/título de gancho</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={applyCuts} disabled={!(clip.cortes_video || []).length} onChange={(e) => setApplyCuts(e.target.checked)} />Aplicar cortes internos</label>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={exportMp4} disabled={(!clip.source_asset_id && !onEnsureAsset) || clip.out_ms <= clip.in_ms || exporting} className="flex items-center gap-1.5 rounded-md bg-sky-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 disabled:opacity-40"><Download size={12} /> {exporting ? 'Gerando MP4...' : 'Gerar MP4 do trecho'}</button>
          {download && download.clipId === clip.id && download.inMs === clip.in_ms && download.outMs === clip.out_ms && download.optionsKey === currentOptionsKey && <a href={download.url} download={download.filename} className="flex items-center gap-1.5 rounded-md border border-emerald-600 px-3 py-1.5 text-[11px] font-bold text-emerald-300"><Download size={12} /> Baixar MP4 gerado</a>}
          {clip.source_url && <a href={clip.source_url} download className="flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-[11px] text-slate-300"><Download size={12} /> Baixar vídeo original</a>}
          <button
            onClick={() => baixarXmlPremiereClip(clip, { legendas: clip.legendas || [], cgs: clip.cgs || [] })}
            className="flex items-center gap-1.5 rounded-md border border-sky-700 px-3 py-1.5 text-[11px] font-bold text-sky-300 hover:bg-sky-950/40"
          >
            <FileVideo size={12} /> Premiere XML
          </button>
          <button
            onClick={() => baixarSrtClip(clip, clip.legendas || [])}
            disabled={!(clip.legendas || []).length}
            className="flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          >
            <FileText size={12} /> Legendas (SRT)
          </button>
          <button
            type="button"
            onClick={() => baixarTexto(`${(clip.titulo || clip.title || 'corte').replace(/[^a-z0-9-_]+/gi, '_')}.vtt`, captionsToVtt(clip.legendas || [], { inMs: clip.in_ms || 0, maxChars: { ...DEFAULT_CAPTION_SETTINGS, ...(clip.legenda_config || {}) }.maxChars }), 'text/vtt')}
            disabled={!(clip.legendas || []).length}
            className="flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          >
            <FileText size={12} /> Legendas (VTT)
          </button>
          <span className="self-center text-[10px] text-slate-500">
            IN {fmt(clip.in_ms)} · OUT {fmt(clip.out_ms)} · {(clip.legendas || []).length} legenda(s) · {(clip.cgs || []).length} CG(s)
          </span>
        </div>
        <p className="mt-2 text-[10px] text-amber-200">O MP4 usa o intervalo IN/OUT e aplica somente as opções marcadas acima (formato com reenquadramento Preencher/Ajustar e foco horizontal, legendas com o modelo global, textos e cortes internos). Imagens, GCs animados e emojis não são gravados. A gravação de legendas depende do FFmpeg do servidor com suporte a legendas (libass).</p>
        {!clip.source_asset_id && <p className="mt-1 text-[10px] text-slate-400">{onEnsureAsset ? 'O vídeo será enviado ao MediaMind ao gerar o MP4.' : 'Selecione novamente o arquivo de origem para gerar o trecho.'}</p>}
        {exportError && <p role="alert" className="mt-2 text-xs text-rose-300">{exportError}</p>}
      </div>

      {/* Reimportar versão editada */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        <p className="mb-2 text-[10px] font-bold uppercase text-slate-500">Reimportar versão editada</p>
        <div className="space-y-2">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://.../versao-editada.mp4" className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500" />
          {realId && (
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Rótulo da versão (ex.: v2-color)" className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500" />
          )}
          <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} Enviar arquivo
            <input type="file" accept="video/*" onChange={onFile} className="hidden" />
          </label>
        </div>
        <button onClick={aplicar} disabled={!url || saving} className="mt-3 flex items-center gap-1.5 rounded-md bg-sky-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-50">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Aplicar versão editada
        </button>
        {!realId && <p className="mt-2 text-[10px] text-slate-500">Recorte de demonstração — a versão fica só local. Promova a Clip (etapa IA) pra versionar de verdade.</p>}
      </div>

      {clip.edited_url && (
        <div className="flex-1 rounded-lg border border-slate-800 bg-black p-2">
          <video src={clip.edited_url} controls className="h-full max-h-[30vh] w-full" />
        </div>
      )}

      {/* Histórico de versões */}
      {realId && versions.length > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500"><History size={11} /> Versões ({versions.length})</p>
          <div className="space-y-1.5">
            {versions.map((v) => (
              <div key={v.id} className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px] ${v.is_current ? 'border-emerald-700 bg-emerald-950/20' : 'border-slate-800 bg-slate-950/40'}`}>
                <span className="font-bold text-slate-200">{v.version_label}</span>
                {v.is_current && <span className="mm-badge mm-badge-success"><Check size={10} /> atual</span>}
                <span className="truncate text-slate-500">{v.edited_url || 'sem arquivo'}</span>
                {!v.is_current && (
                  <button onClick={() => trocarVersao(v.id)} className="ml-auto rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800">Ativar</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end border-t border-slate-800 pt-3">
        <button onClick={onProsseguir} disabled={!clip.edited_url} className="flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"><Send size={12} /> Prosseguir pra Publicações</button>
      </div>
    </div>
  );
}
