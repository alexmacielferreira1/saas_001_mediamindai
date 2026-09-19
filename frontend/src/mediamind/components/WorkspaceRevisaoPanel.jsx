import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, CheckCircle2, RotateCcw, Trash2, Send, ShieldCheck, ShieldX, Clock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { parseTime, formatTime } from '../data';
import { logAudit } from '../lib/audit';

// Motor de revisão colaborativa — comentários por timecode + aprovação por versão.
// Persiste nas entidades Base44 ComentarioRevisao / AprovacaoVersao.
// Não altera o preview existente; é renderizado como seção adicional dentro do preview.
export default function WorkspaceRevisaoPanel({ asset }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [texto, setTexto] = useState('');
  const [tcLabel, setTcLabel] = useState('00:00:00');
  const [approval, setApproval] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!asset) return;
    setLoading(true);
    try {
      const cs = await base44.entities.ComentarioRevisao.filter({ asset_id: asset.id }, '-created_date', 50);
      setComments(cs);
      const aps = await base44.entities.AprovacaoVersao.filter({ asset_id: asset.id }, '-created_date', 1);
      setApproval(aps[0] || null);
    } catch {
      setComments([]);
      setApproval(null);
    } finally {
      setLoading(false);
    }
  }, [asset]);

  useEffect(() => { load(); }, [load]);

  async function addComment() {
    if (!texto.trim() || !asset) return;
    setSubmitting(true);
    try {
      const ms = parseTime(tcLabel) * 1000;
      await base44.entities.ComentarioRevisao.create({
        asset_id: asset.id,
        asset_title: asset.title,
        timecode_ms: ms,
        timecode_label: tcLabel,
        texto: texto.trim(),
        status: 'aberta',
        versao: 'v1',
      });
      logAudit('Comentário', 'Asset', `Novo comentário em "${asset.title}" (${tcLabel})`);
      setTexto('');
      setTcLabel('00:00:00');
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStatus(c) {
    const next = c.status === 'resolvida' ? 'reaberta' : 'resolvida';
    await base44.entities.ComentarioRevisao.update(c.id, { status: next });
    await load();
  }

  async function removeComment(id) {
    await base44.entities.ComentarioRevisao.delete(id);
    await load();
  }

  async function setDecision(decisao) {
    if (!asset) return;
    setSubmitting(true);
    try {
      if (approval) {
        await base44.entities.AprovacaoVersao.update(approval.id, { decisao });
      } else {
        await base44.entities.AprovacaoVersao.create({
          asset_id: asset.id,
          asset_title: asset.title,
          versao: 'v1',
          decisao,
          comentario: '',
        });
      }
      await load();
      logAudit('Aprovação', 'Asset', `${decisao === 'aprovado' ? 'Aprovada' : 'Reprovada'} versão v1 de "${asset.title}"`);
    } finally {
      setSubmitting(false);
    }
  }

  if (!asset) return null;

  const abertas = comments.filter((c) => c.status !== 'resolvida').length;

  return (
    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <div className="flex items-center gap-2">
          <MessageSquare size={13} className="text-sky-400" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Revisão & comentários</span>
          {abertas > 0 && (
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
              {abertas} aberta{abertas > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setDecision('aprovado')}
            disabled={submitting}
            className="flex items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-1 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
            title="Aprovar versão v1"
          >
            <ShieldCheck size={12} /> Aprovar
          </button>
          <button
            onClick={() => setDecision('reprovado')}
            disabled={submitting}
            className="flex items-center gap-1 rounded-md bg-rose-500/20 px-2 py-1 text-[10px] font-bold text-rose-300 hover:bg-rose-500/30 disabled:opacity-50"
            title="Reprovar versão v1"
          >
            <ShieldX size={12} /> Reprovar
          </button>
        </div>
      </div>

      {approval && (
        <div className="flex items-center gap-2 px-3 py-1.5 text-[11px]">
          <span className="text-slate-500">Versão {approval.versao}:</span>
          <span
            className={
              approval.decisao === 'aprovado'
                ? 'font-bold text-emerald-300'
                : approval.decisao === 'reprovado'
                ? 'font-bold text-rose-300'
                : 'text-amber-300'
            }
          >
            {approval.decisao === 'aprovado' ? 'Aprovada' : approval.decisao === 'reprovado' ? 'Reprovada' : 'Pendente'}
          </span>
        </div>
      )}

      <div className="max-h-48 space-y-1.5 overflow-y-auto px-3 py-2">
        {loading && <p className="text-[11px] text-slate-500">Carregando…</p>}
        {!loading && comments.length === 0 && (
          <p className="text-[11px] text-slate-600">Nenhum comentário. Adicione o primeiro.</p>
        )}
        {comments.map((c) => (
          <div
            key={c.id}
            className={`rounded-lg border px-2.5 py-2 ${
              c.status === 'resolvida' ? 'border-slate-800 bg-slate-900/30 opacity-60' : 'border-slate-700 bg-slate-900/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-sky-300">
                <Clock size={10} /> {c.timecode_label || formatTime((c.timecode_ms || 0) / 1000)}
              </span>
              <span className="text-[10px] text-slate-500">{c.created_by || 'Você'}</span>
              <div className="ml-auto flex gap-1">
                <button
                  onClick={() => toggleStatus(c)}
                  className="text-slate-500 hover:text-emerald-400"
                  title={c.status === 'resolvida' ? 'Reabrir' : 'Resolver'}
                >
                  {c.status === 'resolvida' ? <RotateCcw size={11} /> : <CheckCircle2 size={12} />}
                </button>
                <button
                  onClick={() => removeComment(c.id)}
                  className="text-slate-500 hover:text-rose-400"
                  title="Excluir"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-200">{c.texto}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-800 p-2.5">
        <div className="flex gap-2">
          <input
            value={tcLabel}
            onChange={(e) => setTcLabel(e.target.value)}
            placeholder="00:00:00"
            className="w-24 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-[11px] outline-none focus:border-sky-500"
          />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                addComment();
              }
            }}
            placeholder="Comentar neste timecode…"
            className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs outline-none focus:border-sky-500"
          />
          <button
            onClick={addComment}
            disabled={submitting || !texto.trim()}
            className="flex items-center gap-1 rounded-md bg-sky-500 px-2.5 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
          >
            <Send size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}