import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Save, Loader2, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { MOCK_CORP_PRECHECKLIST } from '../../data';
import { logAudit } from '../../lib/audit';

// Checklist de pré-gravação vinculado a cada rascunho de produção.
// Persiste em BriefingProducao (um registro por draft_id), guardando os itens
// essenciais selecionados + o briefing completo do projeto.
export default function BriefingChecklistPanel({ draft }) {
  const [checked, setChecked] = useState({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [existing, setExisting] = useState(null);

  useEffect(() => {
    let alive = true;
    setSavedAt(null);
    setChecked({});
    setExisting(null);
    if (!draft) return;
    base44.entities.BriefingProducao.filter({ draft_id: draft.id }, '-updated_date', 1)
      .then((list) => {
        if (!alive) return;
        const b = list[0] || null;
        setExisting(b);
        const map = {};
        (b?.checklist || []).forEach((c) => { map[c] = true; });
        setChecked(map);
      })
      .catch(() => setExisting(null));
    return () => { alive = false; };
  }, [draft?.id]);

  function toggle(item) {
    setChecked((c) => ({ ...c, [item]: !c[item] }));
  }

  async function save() {
    setSaving(true);
    try {
      const selecionados = MOCK_CORP_PRECHECKLIST.filter((it) => checked[it]);
      const apresentadores = (draft.apresentadores || []).map((a) => a.nome).filter(Boolean).join(', ');
      const gravacao = draft.gravacao ? `${draft.gravacao.data} ${draft.gravacao.horario} ${draft.gravacao.estudio}` : '';
      const payload = {
        draft_id: draft.id,
        titulo: draft.titulo || '',
        programa: draft.programa || '',
        headline: draft.headline || '',
        descricao: draft.descricao || '',
        convidado_nome: draft.convidado_nome || '',
        convidado_cg: draft.convidado_cg || '',
        apresentadores,
        checklist: selecionados,
        gravacao,
        status: draft.status || 'rascunho',
      };
      if (existing) {
        await base44.entities.BriefingProducao.update(existing.id, payload);
      } else {
        const created = await base44.entities.BriefingProducao.create(payload);
        setExisting(created);
      }
      logAudit('Briefing', 'Corp', `Checklist de pré-gravação salvo para "${draft.titulo}" (${selecionados.length}/${MOCK_CORP_PRECHECKLIST.length} itens)`);
      setSavedAt(new Date().toLocaleTimeString('pt-BR'));
    } finally {
      setSaving(false);
    }
  }

  const done = Object.values(checked).filter(Boolean).length;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={13} className="text-sky-400" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Checklist de pré-gravação</span>
        </div>
        <span className="text-[10px] text-slate-500">{done}/{MOCK_CORP_PRECHECKLIST.length} itens</span>
      </div>
      <div className="space-y-1 p-3">
        {MOCK_CORP_PRECHECKLIST.map((item) => (
          <label key={item} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-800/40 cursor-pointer">
            <input type="checkbox" checked={!!checked[item]} onChange={() => toggle(item)} className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-sky-500 focus:ring-sky-500" />
            <span className={checked[item] ? 'line-through text-slate-500' : ''}>{item}</span>
            {checked[item] && <CheckCircle2 size={12} className="ml-auto text-emerald-400" />}
          </label>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-slate-800 px-3 py-2">
        {savedAt ? <span className="text-[10px] text-emerald-300">Briefing salvo às {savedAt}</span> : <span className="truncate text-[10px] text-slate-600">Vinculado a "{draft?.titulo}"</span>}
        <button onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded-md bg-sky-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-50">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Salvar briefing
        </button>
      </div>
    </div>
  );
}