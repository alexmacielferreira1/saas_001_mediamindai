import React, { useState, useEffect, useCallback } from 'react';
import { Scale, Save, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { logAudit } from '../lib/audit';

const TIPO_LABEL = { exclusivo: 'Exclusivo', nao_exclusito: 'Não exclusivo', cedido: 'Cedido', dominio_publico: 'Domínio público' };
const STATUS_LABEL = { ativo: 'Ativo', expirado: 'Expirado', pendente: 'Pendente', renovacao: 'Renovação' };
const STATUS_TONE = {
  ativo: 'bg-emerald-400/15 text-emerald-300',
  expirado: 'bg-rose-400/15 text-rose-300',
  pendente: 'bg-amber-400/15 text-amber-300',
  renovacao: 'bg-sky-400/15 text-sky-300',
};

export default function WorkspaceDireitosPanel({ asset }) {
  const [direito, setDireito] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    titular: '', tipo_direito: 'cedido', vigencia_inicio: '', vigencia_fim: '', restricoes: '', status: 'ativo',
  });

  const load = useCallback(async () => {
    if (!asset) return;
    setLoading(true);
    try {
      const list = await base44.entities.DireitoAsset.filter({ asset_id: asset.id }, '-updated_date', 1);
      const d = list[0] || null;
      setDireito(d);
      if (d) {
        setForm({
          titular: d.titular || '',
          tipo_direito: d.tipo_direito || 'cedido',
          vigencia_inicio: d.vigencia_inicio || '',
          vigencia_fim: d.vigencia_fim || '',
          restricoes: d.restricoes || '',
          status: d.status || 'ativo',
        });
      }
    } catch {
      setDireito(null);
    } finally {
      setLoading(false);
    }
  }, [asset]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!asset) return;
    setSaving(true);
    try {
      if (direito) {
        await base44.entities.DireitoAsset.update(direito.id, { ...form, asset_title: asset.title });
      } else {
        const created = await base44.entities.DireitoAsset.create({ ...form, asset_id: asset.id, asset_title: asset.title });
        setDireito(created);
      }
      logAudit('Direitos', 'Asset', `Direitos de "${asset.title}" atualizados (${TIPO_LABEL[form.tipo_direito]})`);
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (!asset) return null;

  return (
    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40">
      <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2">
        <Scale size={13} className="text-amber-400" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Direitos e governança</span>
        {direito?.status && (
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${STATUS_TONE[direito.status] || ''}`}>
            {STATUS_LABEL[direito.status] || direito.status}
          </span>
        )}
      </div>

      {loading ? (
        <div className="px-3 py-3 text-[11px] text-slate-500">Carregando…</div>
      ) : (
        <div className="space-y-2 p-3">
          <input
            value={form.titular}
            onChange={(e) => setForm({ ...form, titular: e.target.value })}
            placeholder="Titular dos direitos"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs outline-none focus:border-sky-500"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={form.tipo_direito}
              onChange={(e) => setForm({ ...form, tipo_direito: e.target.value })}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs outline-none focus:border-sky-500"
            >
              {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs outline-none focus:border-sky-500"
            >
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-500">Vigência início</span>
              <input
                type="date"
                value={form.vigencia_inicio}
                onChange={(e) => setForm({ ...form, vigencia_inicio: e.target.value })}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs outline-none focus:border-sky-500"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-500">Vigência fim</span>
              <input
                type="date"
                value={form.vigencia_fim}
                onChange={(e) => setForm({ ...form, vigencia_fim: e.target.value })}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs outline-none focus:border-sky-500"
              />
            </label>
          </div>
          <textarea
            value={form.restricoes}
            onChange={(e) => setForm({ ...form, restricoes: e.target.value })}
            placeholder="Restrições de uso (geográfica, prazo, plataformas)…"
            rows={2}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs outline-none focus:border-sky-500"
          />
          <button
            onClick={save}
            disabled={saving}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500/20 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/30 disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {direito ? 'Atualizar direitos' : 'Registrar direitos'}
          </button>
        </div>
      )}
    </div>
  );
}