import React, { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, FolderOpen, History, Instagram, Layers, Lightbulb, Link2, Send, Sparkles, Youtube } from 'lucide-react';
import { MOCK_ASSETS, MOCK_PUBLICATION_CALENDAR, MOCK_PUBLICATIONS, MOCK_SOCIAL_METRICS } from '../../../data';
import { listMediaAssets, uploadMediaAsset } from '../../../../api/media';
import { createEditorialBar } from '../../../lib/graphicTemplates';
import { downloadGraphicPackage } from '../../../lib/graphicPackage';

const cards = {
  selecao: [
    { icon: Layers, title: 'Versões do corte', lines: ['V3 · corte vertical atual', 'V2 · versão com legendas', 'V1 · primeiro recorte'] },
    { icon: FolderOpen, title: 'Biblioteca disponível', lines: MOCK_ASSETS.slice(0, 3).map((asset) => asset.title) },
    { icon: History, title: 'Histórico', lines: ['Trecho criado a partir do Acervo', 'IN e OUT preservados', 'Versão original protegida'] },
  ],
  ia: [
    { icon: Sparkles, title: 'Sugestões da IA', lines: ['Gancho forte nos primeiros 3s', 'Formato vertical recomendado', 'Remover pausa entre 00:21–00:23'] },
    { icon: Lightbulb, title: 'Preparo editorial', lines: ['Legenda automática PT-BR', 'Palavras-chave e hashtags', 'Área segura para títulos e CGs'] },
    { icon: CheckCircle2, title: 'Qualidade', lines: ['Transcrição revisável', 'Detecção de silêncio', 'Score de potencial por trecho'] },
  ],
  legendas: [
    { icon: Link2, title: 'Edição externa', lines: ['Exportar XML para Premiere', 'Baixar legendas em SRT', 'Reconectar mídia master'] },
    { icon: Layers, title: 'Versões não destrutivas', lines: ['Nova versão não sobrescreve a anterior', 'Comparar versões', 'Definir versão atual'] },
    { icon: FolderOpen, title: 'Materiais vinculados', lines: ['Vídeo master', 'Áudio tratado', 'Imagens e documentos de apoio'] },
  ],
  cg: [
    { icon: CheckCircle2, title: 'Fila de aprovação', lines: ['7 apontamentos nesta revisão', '3 comentários resolvidos', 'Versão V3 aguardando decisão'] },
    { icon: History, title: 'Histórico da revisão', lines: ['Alex enviou V3', 'Marcelo solicitou ajustes', 'João enviou V2'] },
    { icon: Send, title: 'Próximas ações', lines: ['Aprovar versão', 'Solicitar alterações', 'Devolver para edição'] },
  ],
  reimport: [
    { icon: CalendarDays, title: 'Calendário', lines: MOCK_PUBLICATION_CALENDAR.slice(0, 3).map((item) => `${item.date} · ${item.title}`) },
    { icon: Send, title: 'Fila e publicação', lines: MOCK_PUBLICATIONS.slice(0, 3).map((item) => `${item.title} · ${item.status}`) },
    { icon: Clock3, title: 'Desempenho e melhor horário', lines: MOCK_SOCIAL_METRICS.slice(0, 3).map((item) => `${item.platform} · ${item.engagement} engajamento`) },
  ],
};

export default function ClipStageResources({ stage, clip, onChange }) {
  const [assets, setAssets] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  useEffect(() => {
    let active = true;
    if (stage === 'selecao' && clip) listMediaAssets().then((items) => { if (active) setAssets(items.filter((item) => item.origin === 'clipsfree-assets')); }).catch(() => { if (active) setMessage('Não foi possível carregar os arquivos da biblioteca.'); });
    return () => { active = false; };
  }, [stage, Boolean(clip)]);
  async function addFiles(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    setBusy(true); setMessage('');
    let failed = 0;
    for (const file of files) {
      try { const asset = await uploadMediaAsset(file, { origin: 'clipsfree-assets' }); setAssets((current) => [asset, ...current]); }
      catch { failed += 1; }
    }
    setMessage(failed ? `${failed} arquivo(s) não puderam ser enviados. Verifique tipo, permissão ou conexão.` : 'Arquivo(s) adicionados à biblioteca.');
    setBusy(false);
  }
  async function downloadGc() {
    setExporting(true); setMessage('');
    try {
      await downloadGraphicPackage((clip.cgs || []).find((layer) => layer.template === 'barra-editorial') || {});
      setMessage('Pacote PNG pronto para download.');
    } catch { setMessage('Não foi possível gerar o pacote PNG.'); }
    finally { setExporting(false); }
  }
  const items = cards[stage] || [];
  if (!items.length) return null;
  return (
    <section className="grid gap-2 xl:grid-cols-3">
      {items.map(({ icon: Icon, title, lines }) => (
        <article key={title} className="rounded-xl border border-slate-800 bg-slate-950/45 p-2.5">
          <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-sky-300"><Icon size={12} />{title}</p>
          {title === 'Biblioteca disponível' && clip && onChange && <div className="mt-2 space-y-2 border-b border-slate-800 pb-2">
            <button type="button" onClick={() => onChange({ cgs: [...(clip.cgs || []), createEditorialBar(clip.in_ms || 0)] })} className="w-full rounded border border-violet-700 px-2 py-1 text-left text-xs text-violet-200">Adicionar GC barra animada</button>
            <button type="button" disabled={exporting} onClick={downloadGc} className="w-full rounded border border-slate-700 px-2 py-1 text-left text-xs text-slate-300 disabled:opacity-50">{exporting ? 'Preparando sequência PNG…' : 'Baixar ZIP do GC (PNGs sem texto)'}</button>
            <label className="block cursor-pointer rounded border border-slate-700 px-2 py-1 text-xs text-slate-300">{busy ? 'Enviando…' : 'Adicionar arquivos'}<input aria-label="Adicionar arquivos aos assets" type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm,audio/mpeg,audio/wav" multiple disabled={busy} onChange={addFiles} className="sr-only" /></label>
            {assets.map((asset) => <div key={asset.id} className="flex items-center justify-between gap-2 text-xs text-slate-300"><span className="truncate">{asset.title || asset.filename}</span>{asset.asset_type === 'image' && asset.stream_url && <button type="button" aria-label={`Adicionar imagem ${asset.title || asset.filename} ao corte`} onClick={() => { const start = clip.in_ms || 0; onChange({ cgs: [...(clip.cgs || []), { id: `image-${globalThis.crypto?.randomUUID?.() || Date.now()}`, tipo: 'imagem', titulo: asset.title || asset.filename, asset_id: asset.id, source_url: asset.stream_url, start_ms: start, end_ms: start + 5000 }] }); }} className="text-violet-300">Usar</button>}</div>)}
            {message && <p role="status" className="text-xs text-slate-400">{message}</p>}
            <p className="text-[10px] text-slate-500">Arquivos enviados ao acervo da empresa. Imagens podem ser adicionadas à prévia; vídeos e áudios ficam no acervo. Camadas ainda não são aplicadas no MP4.</p>
          </div>}
          <div className="mt-2 space-y-1">
            {lines.map((line, index) => <button type="button" key={`${line}-${index}`} className="flex w-full items-center gap-2 border-b border-slate-800/70 py-1 text-left text-[9px] text-slate-400 last:border-0 hover:text-slate-200"><span className="size-1 rounded-full bg-sky-400" />{line}</button>)}
          </div>
        </article>
      ))}
    </section>
  );
}
