import React, { useState, useEffect } from 'react';
import { Upload, CheckCircle2, Send, FileVideo, FileText, History, Loader2, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '../../../auth';
import { useEmpresa } from '../../../lib/empresaContext';
import { baixarXmlPremiereClip, baixarSrtClip } from '../../../lib/premiereXml';
import { createVersion, listVersions, setCurrentVersion } from '../../../lib/clipEngineService';
import { fmt } from './clipModel';

const isRealClipId = (id) => !!id && !String(id).startsWith('clip-');

// Reimportar: exporta o corte (Premiere XML + SRT), recebe a versão editada e
// versiona — cada reimport vira uma ClipVersion (não destrutiva). Sem id real
// (clip de demonstração), opera só localmente.
export default function ClipReimportPanel({ clip, onChange, onProsseguir }) {
  const { user } = useAuth();
  const { current: empresaId, isGlobal } = useEmpresa();
  const [url, setUrl] = useState(clip.edited_url || '');
  const [label, setLabel] = useState('');
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const eid = isGlobal ? '' : empresaId;
  const realId = isRealClipId(clip.id);

  async function loadVersions() {
    if (!realId) return;
    try { setVersions(await listVersions(clip.id)); } catch { /* silencioso */ }
  }
  useEffect(() => { loadVersions(); /* eslint-disable-next-line */ }, [clip.id]);

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

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Exportação real */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        <p className="text-xs text-slate-400">Exporte o corte com as decisões do workspace (IN/OUT, legendas, CGs). Abra no Premiere, reconecte a mídia master, edite e traga a versão editada de volta.</p>
        <div className="mt-3 flex flex-wrap gap-2">
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
          <span className="self-center text-[10px] text-slate-500">
            IN {fmt(clip.in_ms)} · OUT {fmt(clip.out_ms)} · {(clip.legendas || []).length} legenda(s) · {(clip.cgs || []).length} CG(s)
          </span>
        </div>
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