import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { resolveMediaUrl } from '@/api/media';
import { listSavedThumbnails } from '../../lib/thumbnailPersistence';
export default function ProjectThumbnails({ projectId, publication, onSelected }) {
  const [records, setRecords] = useState([]); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { let live = true; listSavedThumbnails(projectId).then((r) => { if (live) setRecords(r); }).catch((e) => { if (live) setMessage(e.message); }); return () => { live = false; }; }, [projectId]);
  async function select(record, exported) {
    setBusy(true);
    try { const saved = await base44.entities.Publicacao.update(publication.id, { thumbnail_document_id: record.id, thumbnail_asset_id: exported.assetId, thumbnail_url: exported.url, project_id: record.project_id || publication.project_id }); onSelected?.(saved); setMessage('Thumb vinculada à publicação.'); }
    catch (e) { setMessage(e.message); } finally { setBusy(false); }
  }
  return <section className="rounded-xl border border-slate-800 p-3"><div className="flex justify-between gap-2"><h3 className="text-sm font-bold">Thumbs do projeto</h3><Link className="text-xs text-sky-300" to={`/thumbnails${projectId ? `?project=${encodeURIComponent(projectId)}` : ''}`}>Criar / editar thumb</Link></div>
    <div className="mt-2 space-y-2">{records.map((r) => <div key={r.id} className="rounded-lg bg-slate-950/50 p-2 text-xs"><Link to={`/thumbnails?thumb=${encodeURIComponent(r.id)}`} className="text-sky-300">{r.title} · v{r.revision}</Link><div className="mt-2 flex flex-wrap gap-2">{r.exports?.map((e) => <div key={e.assetId}><img src={resolveMediaUrl(e.url)} alt={`${r.title} ${e.format}`} className="h-20 max-w-40 rounded object-contain" /><a href={resolveMediaUrl(e.url)} target="_blank" rel="noreferrer" className="text-sky-300">Abrir PNG {e.format}</a>{publication && <button disabled={busy} type="button" onClick={() => select(r, e)} className="ml-2 text-emerald-300">Usar nesta publicação</button>}</div>)}</div></div>)}</div>
    {!records.length && <p className="mt-2 text-xs text-slate-500">Nenhuma versão salva disponível.</p>}{message && <p role="status" className="mt-2 text-xs text-amber-200">{message}</p>}
  </section>;
}
